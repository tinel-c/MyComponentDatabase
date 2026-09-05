#!/usr/bin/env python3
"""Bootstrap + deploy BNAB on the VPS. Reads deploy/deploy.secrets. Does not print secrets."""
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
            v = v[1:-1].replace('\\"', '"')
        env[k] = v
    return env


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> int:
    print(f"\n>>> {cmd[:120]}{'…' if len(cmd) > 120 else ''}")
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=timeout)
    stdin.close()
    for raw in iter(lambda: stdout.channel.recv(4096), b""):
        if not raw:
            break
        text = raw.decode("utf-8", errors="replace")
        try:
            sys.stdout.write(text)
        except UnicodeEncodeError:
            sys.stdout.buffer.write(text.encode(sys.stdout.encoding or "utf-8", errors="replace"))
        sys.stdout.flush()
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready():
            break
    err = stderr.read().decode("utf-8", errors="replace")
    if err:
        try:
            sys.stderr.write(err)
        except UnicodeEncodeError:
            pass
    return stdout.channel.recv_exit_status()


def main() -> None:
    root = Path(__file__).resolve().parent.parent  # deploy/
    secrets_path = root / "deploy.secrets"
    if not secrets_path.is_file():
        print(f"Missing {secrets_path}", file=sys.stderr)
        sys.exit(1)
    env = load_secrets(secrets_path)
    host = env["DEPLOY_HOST"]
    user = env["DEPLOY_USER"]
    password = env["DEPLOY_SSH_PASSWORD"]
    port = int(env.get("DEPLOY_SSH_PORT") or "22")
    google_id = env.get("AUTH_GOOGLE_ID", "")
    google_secret = env.get("AUTH_GOOGLE_SECRET", "")
    admin = env.get("ADMIN_EMAIL", "tinel.c@gmail.com")
    auth_secret = secrets.token_urlsafe(32)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=host,
        port=port,
        username=user,
        password=password,
        timeout=45,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        code = run(client, "test -d /opt/bnab/blue/.git && echo BNAB_EXISTS || echo BNAB_MISSING")
        _, out, _ = client.exec_command("test -d /opt/bnab/blue/.git; echo $?")
        exists = out.read().decode().strip() == "0"

        if not exists:
            prep = r"""set -euo pipefail
REPO='https://github.com/tinel-c/MyComponentDatabase.git'
if [[ -d /opt/warehouse/blue/.git ]]; then
  git -C /opt/warehouse/blue fetch origin
  git -C /opt/warehouse/blue reset --hard origin/main
  bash /opt/warehouse/blue/deploy/bnab/setup-bnab-server.sh --repo "$REPO"
else
  tmp=$(mktemp -d)
  git clone "$REPO" "$tmp/repo"
  bash "$tmp/repo/deploy/bnab/setup-bnab-server.sh" --repo "$REPO"
  rm -rf "$tmp"
fi
"""
            code = run(client, prep, timeout=900)
            if code != 0:
                sys.exit(code)

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
        b64 = base64.b64encode(env_body.encode()).decode()
        write_env = f"""set -euo pipefail
ENVF=/opt/bnab/shared/.env
echo '{b64}' | base64 -d > "$ENVF"
chown deploy:deploy "$ENVF" 2>/dev/null || true
chmod 640 "$ENVF"
echo "[bnab] wrote shared .env (secrets redacted)"
"""
        code = run(client, write_env)
        if code != 0:
            sys.exit(code)

        # Ensure slots have latest main before deploy
        sync = r"""set -euo pipefail
for s in blue green; do
  d=/opt/bnab/$s
  if [[ -d "$d/.git" ]]; then
    git -C "$d" fetch origin
    git -C "$d" checkout main
    git -C "$d" reset --hard origin/main
    echo "[bnab] $s -> $(git -C "$d" rev-parse --short HEAD)"
  fi
done
"""
        code = run(client, sync)
        if code != 0:
            sys.exit(code)

        code = run(client, "bash /opt/bnab/blue/deploy/bnab/deploy-bnab.sh", timeout=1200)
        if code != 0:
            # try green path if blue script missing somehow
            code = run(client, "bash /opt/bnab/green/deploy/bnab/deploy-bnab.sh", timeout=1200)
            if code != 0:
                sys.exit(code)

        seed = r"""set -euo pipefail
ACTIVE=$(tr -d '[:space:]' </opt/bnab/active_slot)
APP=/opt/bnab/$ACTIVE/bnab
cd "$APP"
export DATABASE_URL='file:/opt/bnab/shared/bnab.db'
set -a
# shellcheck disable=SC1091
source /opt/bnab/shared/.env
set +a
npx prisma db seed
echo "[bnab] seed done"
"""
        code = run(client, seed, timeout=180)
        if code != 0:
            print("[bnab] seed failed (may already be seeded)", file=sys.stderr)

        # Certbot — may fail if DNS not ready
        run(
            client,
            "certbot --nginx -d bnab.bogza.ro --non-interactive --agree-tos --register-unsafely-without-email --redirect 2>&1 || echo CERTBOT_SKIPPED",
            timeout=180,
        )

        run(client, "curl -sS -o /dev/null -w 'local:%{http_code}\\n' http://127.0.0.1:3010/ || curl -sS -o /dev/null -w 'local:%{http_code}\\n' http://127.0.0.1:3011/")
        run(client, "curl -sS -o /dev/null -w 'host80:%{http_code}\\n' -H 'Host: bnab.bogza.ro' http://127.0.0.1/ || true")
        run(client, "pm2 list | grep -E 'bnab|name' || pm2 list")
        print("\n[bnab] deploy script finished")
    finally:
        client.close()


if __name__ == "__main__":
    main()
