#!/usr/bin/env python3
"""Diagnose BNAB 500 / page-load failures on green."""
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


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 90) -> int:
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
        print("(timeout)", flush=True)
        return 1
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
        timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        cmds = [
            "sudo -u deploy -H bash -lc 'pm2 describe bnab-green | head -50'",
            "sudo -u deploy -H bash -lc 'pm2 logs bnab-green --lines 100 --nostream'",
            "curl -sS -o /tmp/bnab_home.html -w 'home=%{http_code}\\n' --max-time 15 http://127.0.0.1:3011/ || echo fail",
            "curl -sS -o /tmp/bnab_login.html -w 'login=%{http_code}\\n' --max-time 15 http://127.0.0.1:3011/login || echo fail",
            "curl -sS -o /tmp/bnab_plan.html -w 'plan=%{http_code}\\n' --max-time 15 http://127.0.0.1:3011/plan || echo fail",
            "echo '--- home ---'; head -c 1500 /tmp/bnab_home.html; echo; echo '--- plan ---'; head -c 1500 /tmp/bnab_plan.html",
            "ls -la /opt/bnab/green/bnab/.next/BUILD_ID",
            "ls /opt/bnab/green/bnab/src/components/plan/ 2>&1 | head -30",
            "ls /opt/bnab/green/bnab/src/components/transactions/ 2>&1 | head -30",
            "cd /opt/bnab/green/bnab && git log -1 --oneline && git status -sb | head -20",
        ]
        for cmd in cmds:
            run(client, cmd)
    finally:
        client.close()


if __name__ == "__main__":
    main()
