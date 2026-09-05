#!/usr/bin/env python3
"""Diagnose and restart BNAB green after a bad upload restart."""
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


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> int:
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
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        code = run(
            client,
            r"""set -euo pipefail
echo ===SLOT===
cat /opt/bnab/active_slot
cat /opt/bnab/nginx-active-upstream.conf
echo ===PM2===
sudo -u deploy -H pm2 list || true
pm2 list || true
echo ===PORT===
ss -ltnp | grep -E '3010|3011' || true
echo ===LOGS===
sudo -u deploy -H pm2 logs bnab-green --lines 30 --nostream || true
echo ===RESTART===
fuser -k 3011/tcp 2>/dev/null || true
sleep 1
sudo -u deploy -H bash -lc '
  cd /opt/bnab/green/bnab
  set -a; . /opt/bnab/shared/.env; set +a
  export DATABASE_URL=file:/opt/bnab/shared/bnab.db
  pm2 delete bnab-green >/dev/null 2>&1 || true
  PORT=3011 NODE_ENV=production pm2 start ./node_modules/next/dist/bin/next --name bnab-green -- start --port 3011
  pm2 save
'
sleep 3
curl -sS -o /dev/null -w "local=%{http_code}\n" --max-time 15 http://127.0.0.1:3011/ || echo local_fail
curl -sS -o /dev/null -w "vhost=%{http_code}\n" --max-time 15 -H "Host: bnab.bogza.ro" https://127.0.0.1/ -k || echo vhost_fail
sudo -u deploy -H pm2 list | grep bnab || true
echo FIX_OK
""",
            timeout=180,
        )
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
