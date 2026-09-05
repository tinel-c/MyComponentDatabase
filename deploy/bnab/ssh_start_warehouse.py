#!/usr/bin/env python3
"""Start warehouse green after reboot (BNAB already handled separately)."""
from __future__ import annotations

import re
import sys
import time
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


def main() -> None:
    env = load_secrets(Path(__file__).resolve().parent.parent / "deploy.secrets")
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
    cmds = [
        "cat /opt/warehouse/active_slot; cat /opt/warehouse/nginx-active-upstream.conf",
        "fuser -k 3001/tcp 2>/dev/null; echo cleared_3001",
        """sudo -u deploy -H bash -lc '
SLOT=$(tr -d "[:space:]" </opt/warehouse/active_slot)
PORT=$( [ "$SLOT" = green ] && echo 3001 || echo 3000 )
APP=/opt/warehouse/$SLOT/web
NAME=warehouse-$SLOT
cd "$APP"
set -a; . /opt/warehouse/shared/.env; set +a
pm2 delete "$NAME" >/dev/null 2>&1 || true
PORT=$PORT NODE_ENV=production pm2 start ./node_modules/next/dist/bin/next --name "$NAME" -- start --port $PORT
pm2 save
echo STARTED_$NAME:$PORT
'""",
        "sleep 4; curl -sS -o /dev/null -w 'wh=%{http_code}\\n' --max-time 20 http://127.0.0.1:3001/ || curl -sS -o /dev/null -w 'wh3000=%{http_code}\\n' --max-time 20 http://127.0.0.1:3000/ || echo wh_fail",
        "curl -sS -o /dev/null -w 'bnab=%{http_code}\\n' --max-time 20 http://127.0.0.1:3011/ || echo bnab_fail",
    ]
    try:
        for cmd in cmds:
            print(f"\n>>> {cmd[:100]}", flush=True)
            stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=90)
            stdin.close()
            end = time.time() + 85
            while time.time() < end:
                if stdout.channel.recv_ready():
                    raw = stdout.channel.recv(4096)
                    if raw:
                        sys.stdout.buffer.write(raw)
                        sys.stdout.flush()
                if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready():
                    break
                time.sleep(0.15)
            if stdout.channel.exit_status_ready():
                print(f"\nexit={stdout.channel.recv_exit_status()}", flush=True)
        print("WH_DONE", flush=True)
    finally:
        client.close()


if __name__ == "__main__":
    main()
