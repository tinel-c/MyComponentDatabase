#!/usr/bin/env python3
"""Pull latest BNAB on the live slot, rebuild, restart — no npm install."""
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


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 900) -> int:
    print(f"\n>>> {cmd[:160]}", flush=True)
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
        code = run(
            client,
            r"""set -euo pipefail
chown -R deploy:deploy /opt/bnab/green /opt/bnab/blue /opt/bnab/shared || true
SLOT=$(tr -d '[:space:]' </opt/bnab/active_slot | tr '[:upper:]' '[:lower:]')
echo "LIVE_SLOT=$SLOT"
APP=/opt/bnab/$SLOT/bnab
sudo -u deploy bash -lc "git -C /opt/bnab/$SLOT fetch origin && git -C /opt/bnab/$SLOT reset --hard origin/main && echo HEAD=\$(git -C /opt/bnab/$SLOT rev-parse --short HEAD)"
PORT=$( [ "$SLOT" = green ] && echo 3011 || echo 3010 )
PM2_APP="bnab-$SLOT"
sudo -u deploy -H bash -lc "cd '$APP' && set -a && . /opt/bnab/shared/.env && set +a && export DATABASE_URL=file:/opt/bnab/shared/bnab.db && npx prisma generate && npm run build"
sudo -u deploy -H bash -lc "cd '$APP' && pm2 delete '$PM2_APP' >/dev/null 2>&1 || true; PORT=$PORT NODE_ENV=production pm2 start ./node_modules/next/dist/bin/next --name '$PM2_APP' -- start --port $PORT && pm2 save"
curl -sI -o /dev/null -w "local=%{http_code}\n" --max-redirs 0 "http://127.0.0.1:$PORT/" || true
curl -sI -o /dev/null -w "vhost=%{http_code}\n" --max-redirs 0 -H 'Host: bnab.bogza.ro' http://127.0.0.1/ || true
pm2 list | grep bnab || true
echo HOTPATCH_OK
""",
            timeout=900,
        )
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
