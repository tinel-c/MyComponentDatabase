#!/usr/bin/env python3
"""Kill stuck BNAB npm installs, free a bit of memory, redeploy once."""
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
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] == '"':
            v = v[1:-1]
        env[k] = v
    return env


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> int:
    print(f"\n>>> {cmd[:220]}", flush=True)
    transport = client.get_transport()
    assert transport is not None
    chan = transport.open_session(timeout=60)
    chan.get_pty(width=200, height=50)
    chan.settimeout(0.0)
    chan.exec_command(cmd)
    deadline = time.time() + timeout
    buf = b""
    while True:
        if time.time() > deadline:
            chan.close()
            print(f"\nTIMEOUT after {timeout}s", flush=True)
            return 124
        if chan.recv_ready():
            chunk = chan.recv(16384)
            if chunk:
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    sys.stdout.buffer.write(line + b"\n")
                    sys.stdout.flush()
        if chan.exit_status_ready():
            while chan.recv_ready():
                buf += chan.recv(16384)
            if buf:
                sys.stdout.buffer.write(buf if buf.endswith(b"\n") else buf + b"\n")
                sys.stdout.flush()
            return chan.recv_exit_status()
        time.sleep(0.2)


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
        run(
            client,
            "bash -lc '"
            "echo before:; free -h | head -2; "
            "for pid in $(pgrep -x npm || true); do "
            "cwd=$(readlink -f /proc/$pid/cwd 2>/dev/null || true); "
            'case "$cwd" in /opt/bnab/*) echo kill_npm:$pid:$cwd; kill -9 $pid;; esac; '
            "done; "
            "pkill -9 -f /opt/bnab/.*/deploy-bnab.sh || true; "
            "rm -f /opt/bnab/blue/.git/index.lock /opt/bnab/green/.git/index.lock; "
            "sync; sleep 2; echo after:; free -h | head -2; "
            "ps -eo pid,stat,etime,cmd | grep -E \"[n]pm|[d]eploy-bnab\" | head -20"
            "'",
            timeout=90,
        )
        for slot in ("blue", "green"):
            code = run(
                client,
                f"bash -lc 'git -C /opt/bnab/{slot} fetch origin && "
                f"git -C /opt/bnab/{slot} reset --hard origin/main && "
                f"echo {slot}=$(git -C /opt/bnab/{slot} rev-parse --short HEAD)'",
                timeout=180,
            )
            if code != 0:
                sys.exit(code)
        code = run(client, "bash /opt/bnab/blue/deploy/bnab/deploy-bnab.sh", timeout=3600)
        print("deploy_exit", code, flush=True)
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
