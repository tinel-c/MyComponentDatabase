#!/usr/bin/env python3
"""Quick restart BNAB on green without hanging pm2 list."""
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
        banner_timeout=60,
        auth_timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    # Short commands only — avoid pm2 list (can hang under OOM)
    cmds = [
        "fuser -k 3011/tcp 2>/dev/null; pkill -f 'bnab-green' 2>/dev/null; pkill -f 'next start --port 3011' 2>/dev/null; echo killed",
        "free -m | head -2",
        "test -f /opt/bnab/green/bnab/.next/BUILD_ID && cat /opt/bnab/green/bnab/.next/BUILD_ID",
        """sudo -u deploy -H bash -lc 'cd /opt/bnab/green/bnab && set -a && . /opt/bnab/shared/.env && set +a && export DATABASE_URL=file:/opt/bnab/shared/bnab.db && (pm2 delete bnab-green || true) && PORT=3011 NODE_ENV=production pm2 start ./node_modules/next/dist/bin/next --name bnab-green -- start --port 3011 && pm2 save'""",
        "sleep 4; curl -sS -o /dev/null -w 'local=%{http_code}\\n' --max-time 20 http://127.0.0.1:3011/ || echo local_fail",
    ]
    try:
        for cmd in cmds:
            print(f"\n>>> {cmd[:120]}", flush=True)
            stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=90)
            stdin.close()
            # Read with deadline
            end = time.time() + 85
            while time.time() < end:
                if stdout.channel.recv_ready():
                    raw = stdout.channel.recv(4096)
                    if raw:
                        sys.stdout.buffer.write(raw)
                        sys.stdout.flush()
                if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready():
                    break
                time.sleep(0.2)
            if not stdout.channel.exit_status_ready():
                print("\n(timeout waiting for command)", flush=True)
                stdout.channel.close()
            else:
                code = stdout.channel.recv_exit_status()
                print(f"\nexit={code}", flush=True)
        print("DONE", flush=True)
    finally:
        client.close()


if __name__ == "__main__":
    main()
