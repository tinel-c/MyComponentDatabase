#!/usr/bin/env python3
"""Verify Prisma ImportCategoryRule on green and regenerate if missing."""
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


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 180) -> int:
    print(f"\n>>> {cmd[:160]}", flush=True)
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
        run(
            client,
            r"""set -euo pipefail
cd /opt/bnab/green/bnab
echo '--- schema Import ---'
grep -n 'model Import' prisma/schema.prisma || echo NO_IMPORT_MODELS
echo '--- prisma client check ---'
sudo -u deploy bash -lc '
  cd /opt/bnab/green/bnab
  set -a; . /opt/bnab/shared/.env; set +a
  export DATABASE_URL=file:/opt/bnab/shared/bnab.db
  node -e "const {PrismaClient}=require(\"@prisma/client\"); const p=new PrismaClient(); console.log(\"importCategoryRule\", typeof p.importCategoryRule); console.log(\"keys\", Object.keys(p).filter(k=>k.toLowerCase().includes(\"import\")).join(\",\"));"
'
""",
        )
    finally:
        client.close()


if __name__ == "__main__":
    main()
