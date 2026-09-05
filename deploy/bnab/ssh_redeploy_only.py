#!/usr/bin/env python3
"""Deploy BNAB only (slots already bootstrapped)."""
from __future__ import annotations

import re
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
    print(f"\n>>> {cmd[:140]}", flush=True)
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=timeout)
    stdin.close()
    while True:
        raw = stdout.channel.recv(4096)
        if not raw:
            if stdout.channel.exit_status_ready():
                break
            continue
        sys.stdout.buffer.write(raw.decode("utf-8", errors="replace").encode("utf-8", errors="replace"))
        sys.stdout.flush()
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready():
            break
    return stdout.channel.recv_exit_status()


def main() -> None:
    env = load_secrets(Path(__file__).resolve().parent.parent / "deploy.secrets")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=env["DEPLOY_HOST"],
        port=int(env.get("DEPLOY_SSH_PORT") or "22"),
        username=env["DEPLOY_USER"],
        password=env["DEPLOY_SSH_PASSWORD"],
        timeout=90,
        banner_timeout=90,
        auth_timeout=90,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        # Kill any stuck npm from prior attempt
        run(client, "pkill -f 'npm (ci|install)' || true; pkill -f 'next build' || true; echo cleared")
        code = run(
            client,
            r"""set -euo pipefail
for s in blue green; do
  sudo -u deploy git -C /opt/bnab/$s fetch origin
  sudo -u deploy git -C /opt/bnab/$s reset --hard origin/main
  echo $s=$(git -C /opt/bnab/$s rev-parse --short HEAD)
done
""",
        )
        if code != 0:
            sys.exit(code)
        code = run(client, "bash /opt/bnab/blue/deploy/bnab/deploy-bnab.sh", timeout=1500)
        if code != 0:
            sys.exit(code)
        run(
            client,
            r"""set -euo pipefail
ACTIVE=$(tr -d '[:space:]' </opt/bnab/active_slot)
cd /opt/bnab/$ACTIVE/bnab
export DATABASE_URL=file:/opt/bnab/shared/bnab.db
set -a; source /opt/bnab/shared/.env; set +a
npx prisma db seed || true
curl -sS -o /dev/null -w 'local:%{http_code}\n' http://127.0.0.1:3010/ || curl -sS -o /dev/null -w 'local:%{http_code}\n' http://127.0.0.1:3011/
curl -sS -o /dev/null -w 'vhost:%{http_code}\n' -H 'Host: bnab.bogza.ro' http://127.0.0.1/ || true
pm2 list | head -30
echo DEPLOY_OK
""",
            timeout=180,
        )
        run(
            client,
            "certbot --nginx -d bnab.bogza.ro --non-interactive --agree-tos "
            "--register-unsafely-without-email --redirect 2>&1 || echo CERTBOT_SKIPPED",
            timeout=180,
        )
        print("\nDONE", flush=True)
    finally:
        client.close()


if __name__ == "__main__":
    main()
