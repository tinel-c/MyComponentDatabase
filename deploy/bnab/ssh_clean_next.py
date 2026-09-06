#!/usr/bin/env python3
"""Stop BNAB and remove green .next so a fresh tarball can extract cleanly."""
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
    print(f">>> {cmd[:140]}", flush=True)
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
            "fuser -k 3011/tcp 2>/dev/null || true; "
            "fuser -k 3010/tcp 2>/dev/null || true; "
            "sudo -u deploy -H bash -lc 'pm2 delete bnab-green bnab-blue >/dev/null 2>&1 || true'; "
            "sleep 1; "
            "chown -R deploy:deploy /opt/bnab/green/bnab; "
            "rm -rf /opt/bnab/green/bnab/.next; "
            "echo CLEAN_OK",
        )
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
