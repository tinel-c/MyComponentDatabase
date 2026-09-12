#!/usr/bin/env python3
"""
Prep the INACTIVE BNAB slot for a fresh .next extract.

Does NOT kill the active (live) slot — safe to run while the site is up.
"""
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


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> int:
    print(f">>> {cmd[:160]}", flush=True)
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=timeout)
    stdin.close()
    end = time.time() + timeout
    while time.time() < end:
        if stdout.channel.recv_ready():
            sys.stdout.buffer.write(stdout.channel.recv(8192))
            sys.stdout.flush()
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready():
            break
        time.sleep(0.1)
    return stdout.channel.recv_exit_status() if stdout.channel.exit_status_ready() else 1


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
ACTIVE=$(tr -d '[:space:]' < /opt/bnab/active_slot | tr '[:upper:]' '[:lower:]')
if [ "$ACTIVE" = blue ]; then INACTIVE=green; PORT=3011; PM2=bnab-green
elif [ "$ACTIVE" = green ]; then INACTIVE=blue; PORT=3010; PM2=bnab-blue
else echo "invalid active_slot=$ACTIVE"; exit 1; fi
echo "prep inactive=$INACTIVE (active=$ACTIVE stays live)"
chown -R deploy:deploy "/opt/bnab/$INACTIVE" /opt/bnab/shared || true
sudo -u deploy -H bash -lc "pm2 delete $PM2 >/dev/null 2>&1 || true" || true
fuser -k "${PORT}/tcp" 2>/dev/null || true
rm -rf "/opt/bnab/$INACTIVE/bnab/.next"
echo CLEAN_OK inactive=$INACTIVE
""",
        )
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
