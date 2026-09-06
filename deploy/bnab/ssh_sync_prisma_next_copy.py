#!/usr/bin/env python3
"""Sync generated Prisma client into Next traced copy and restart."""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import paramiko


def load(path: Path) -> dict[str, str]:
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


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 180) -> int:
    print(f"\n>>> {cmd[:140]}", flush=True)
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=timeout)
    stdin.close()
    end = time.time() + timeout
    while time.time() < end:
        if stdout.channel.recv_ready():
            raw = stdout.channel.recv(8192)
            if raw:
                sys.stdout.buffer.write(raw)
                sys.stdout.flush()
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready():
            break
        time.sleep(0.1)
    if not stdout.channel.exit_status_ready():
        return 1
    return stdout.channel.recv_exit_status()


def main() -> None:
    env = load(Path(__file__).resolve().parent.parent / "deploy.secrets")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=env["DEPLOY_HOST"],
        port=int(env.get("DEPLOY_SSH_PORT") or "22"),
        username=env["DEPLOY_USER"],
        password=env["DEPLOY_SSH_PASSWORD"],
        timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        code = run(
            client,
            r"""set -euo pipefail
sudo -u deploy bash -lc '
  set -euo pipefail
  cd /opt/bnab/green/bnab
  set -a; . /opt/bnab/shared/.env; set +a
  export DATABASE_URL=file:/opt/bnab/shared/bnab.db
  npx prisma generate
  # Next vendors a hashed @prisma/client copy; keep it in sync with generate
  shopt -s nullglob
  for d in .next/node_modules/@prisma/client-*; do
    echo "sync $d"
    rm -rf "$d"
    mkdir -p "$d"
    cp -a node_modules/@prisma/client/. "$d/"
  done
  echo SYNC_OK
'
: > /home/deploy/.pm2/logs/bnab-green-error.log
fuser -k 3011/tcp 2>/dev/null || true
sudo -u deploy -H bash -lc '
  cd /opt/bnab/green/bnab
  set -a; . /opt/bnab/shared/.env; set +a
  export DATABASE_URL=file:/opt/bnab/shared/bnab.db
  pm2 delete bnab-green >/dev/null 2>&1 || true
  PORT=3011 NODE_ENV=production pm2 start ./node_modules/next/dist/bin/next --name bnab-green -- start --port 3011
  pm2 save
'
sleep 4
curl -sS -o /dev/null -w "local=%{http_code}\n" --max-time 20 http://127.0.0.1:3011/
echo DONE
""",
        )
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
