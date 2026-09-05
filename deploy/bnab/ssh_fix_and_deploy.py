#!/usr/bin/env python3
"""Fix HTTP nginx + ensure BNAB slots, then run deploy-bnab.sh."""
from __future__ import annotations

import base64
import re
import secrets
import sys
from pathlib import Path

import paramiko


def load_secrets(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if not m:
            continue
        k, v = m.group(1), m.group(2).strip()
        if len(v) >= 2 and v[0] == v[-1] == '"':
            v = v[1:-1]
        env[k] = v
    return env


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 1200) -> int:
    print(f"\n>>> {cmd[:140]}{'…' if len(cmd) > 140 else ''}", flush=True)
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=timeout)
    stdin.close()
    while True:
        raw = stdout.channel.recv(4096)
        if not raw:
            if stdout.channel.exit_status_ready():
                break
            continue
        text = raw.decode("utf-8", errors="replace")
        sys.stdout.buffer.write(text.encode("utf-8", errors="replace"))
        sys.stdout.flush()
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready():
            break
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        sys.stderr.buffer.write(err.encode("utf-8", errors="replace"))
    return stdout.channel.recv_exit_status()


def main() -> None:
    deploy_dir = Path(__file__).resolve().parent.parent
    env = load_secrets(deploy_dir / "deploy.secrets")
    http_conf = (deploy_dir / "bnab" / "nginx-site.conf").read_text(encoding="utf-8")
    conf_b64 = base64.b64encode(http_conf.encode()).decode()

    google_id = env.get("AUTH_GOOGLE_ID", "")
    google_secret = env.get("AUTH_GOOGLE_SECRET", "")
    admin = env.get("ADMIN_EMAIL", "tinel.c@gmail.com")
    auth_secret = secrets.token_urlsafe(32)
    env_body = "\n".join(
        [
            'DATABASE_URL="file:/opt/bnab/shared/bnab.db"',
            f'AUTH_SECRET="{auth_secret}"',
            'AUTH_URL="https://bnab.bogza.ro"',
            f'AUTH_GOOGLE_ID="{google_id}"',
            f'AUTH_GOOGLE_SECRET="{google_secret}"',
            f'ADMIN_EMAIL="{admin}"',
            "",
        ]
    )
    env_b64 = base64.b64encode(env_body.encode()).decode()

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=env["DEPLOY_HOST"],
        port=int(env.get("DEPLOY_SSH_PORT") or "22"),
        username=env["DEPLOY_USER"],
        password=env["DEPLOY_SSH_PASSWORD"],
        timeout=45,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        code = run(
            client,
            f"echo '{conf_b64}' | base64 -d > /etc/nginx/sites-available/bnab && "
            "ln -sfn /etc/nginx/sites-available/bnab /etc/nginx/sites-enabled/bnab && "
            "nginx -t && systemctl reload nginx && echo NGINX_OK",
        )
        if code != 0:
            sys.exit(code)

        code = run(
            client,
            r"""set -euo pipefail
REPO=https://github.com/tinel-c/MyComponentDatabase.git
mkdir -p /opt/bnab/shared
id deploy >/dev/null 2>&1 || useradd -m -s /bin/bash deploy
chown -R deploy:deploy /opt/bnab
for slot in blue green; do
  target=/opt/bnab/$slot
  if [[ ! -d "$target/.git" ]]; then
    sudo -u deploy git clone "$REPO" "$target"
    sudo -u deploy git -C "$target" checkout main
  else
    sudo -u deploy git -C "$target" fetch origin
    sudo -u deploy git -C "$target" reset --hard origin/main
  fi
done
echo blue > /opt/bnab/active_slot
printf 'upstream bnab_app {\n    server 127.0.0.1:3010;\n}\n' > /opt/bnab/nginx-active-upstream.conf
touch /opt/bnab/shared/bnab.db
chown deploy:deploy /opt/bnab/active_slot /opt/bnab/nginx-active-upstream.conf /opt/bnab/shared/bnab.db
echo SETUP_SLOTS_OK
""",
        )
        if code != 0:
            sys.exit(code)

        code = run(
            client,
            f"echo '{env_b64}' | base64 -d > /opt/bnab/shared/.env && "
            "chown deploy:deploy /opt/bnab/shared/.env && chmod 640 /opt/bnab/shared/.env && "
            "echo ENV_OK",
        )
        if code != 0:
            sys.exit(code)

        # Pull latest nginx fix into slots after we push — for now use local conf already installed.
        # Deploy inactive slot (green while active=blue)
        code = run(client, "bash /opt/bnab/blue/deploy/bnab/deploy-bnab.sh", timeout=1200)
        if code != 0:
            sys.exit(code)

        code = run(
            client,
            r"""set -euo pipefail
ACTIVE=$(tr -d '[:space:]' </opt/bnab/active_slot)
cd /opt/bnab/$ACTIVE/bnab
export DATABASE_URL=file:/opt/bnab/shared/bnab.db
set -a
source /opt/bnab/shared/.env
set +a
npx prisma db seed || true
echo SEED_DONE
""",
            timeout=180,
        )

        run(
            client,
            "certbot --nginx -d bnab.bogza.ro --non-interactive --agree-tos "
            "--register-unsafely-without-email --redirect 2>&1 || echo CERTBOT_SKIPPED",
            timeout=180,
        )
        run(
            client,
            "curl -sS -o /dev/null -w 'local3010:%{http_code}\\n' http://127.0.0.1:3010/ || true; "
            "curl -sS -o /dev/null -w 'local3011:%{http_code}\\n' http://127.0.0.1:3011/ || true; "
            "curl -sS -o /dev/null -w 'vhost:%{http_code}\\n' -H 'Host: bnab.bogza.ro' http://127.0.0.1/ || true; "
            "pm2 list | head -40",
        )
        print("\n[bnab] deploy finished", flush=True)
    finally:
        client.close()


if __name__ == "__main__":
    main()
