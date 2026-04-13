#!/usr/bin/env python3
"""
Reset /opt/warehouse/blue and green to origin/main over SSH.
Reads credentials from deploy/deploy.secrets (gitignored). Requires: pip install paramiko

Usage (from repo root): python deploy/ssh_reset_slots.py
"""
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
            v = v[1:-1].replace('\\"', '"')
        env[k] = v
    return env


REMOTE_SCRIPT = r"""set -euo pipefail
for s in blue green; do
  d=/opt/warehouse/$s
  if [ -d "$d/.git" ]; then
    echo "[reset] slot=$s"
    git -C "$d" fetch origin
    git -C "$d" checkout main
    git -C "$d" reset --hard origin/main
    echo "[reset] $s -> $(git -C "$d" rev-parse --short HEAD)"
  else
    echo "[reset] skip $s (no git repo at $d)"
  fi
done
echo "[reset] done"
"""


def main() -> None:
    root = Path(__file__).resolve().parent
    secrets_path = root / "deploy.secrets"
    if not secrets_path.is_file():
        print(f"Missing {secrets_path} (copy from deploy.secrets.example)", file=sys.stderr)
        sys.exit(1)

    env = load_secrets(secrets_path)
    host = env.get("DEPLOY_HOST")
    user = env.get("DEPLOY_USER")
    password = env.get("DEPLOY_SSH_PASSWORD")
    port_s = env.get("DEPLOY_SSH_PORT") or "22"
    if not host or not user or not password:
        print("deploy.secrets must define DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_PASSWORD", file=sys.stderr)
        sys.exit(1)
    port = int(port_s)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            hostname=host,
            port=port,
            username=user,
            password=password,
            timeout=45,
            allow_agent=False,
            look_for_keys=False,
        )
        stdin, stdout, stderr = client.exec_command(REMOTE_SCRIPT, get_pty=True)
        stdin.close()
        for line in iter(stdout.readline, ""):
            sys.stdout.write(line)
        err = stderr.read().decode("utf-8", errors="replace")
        if err:
            sys.stderr.write(err)
        code = stdout.channel.recv_exit_status()
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
