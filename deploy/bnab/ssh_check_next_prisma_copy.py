#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
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


env = load(Path(__file__).resolve().parent.parent / "deploy.secrets")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    env["DEPLOY_HOST"],
    port=int(env.get("DEPLOY_SSH_PORT") or 22),
    username=env["DEPLOY_USER"],
    password=env["DEPLOY_SSH_PASSWORD"],
    timeout=60,
    allow_agent=False,
    look_for_keys=False,
)
cmd = r"""
set -euo pipefail
cd /opt/bnab/green/bnab
P=$(ls -d .next/node_modules/@prisma/client-* 2>/dev/null | head -1 || true)
echo "PATH=$P"
if [ -n "$P" ]; then
  grep -c importCategoryRule "$P/index.js" || echo "next_copy_count=0"
  sudo -u deploy bash -lc "cd /opt/bnab/green/bnab && node -e \"const {PrismaClient}=require('$P'); const p=new PrismaClient(); console.log('nextCopy', typeof p.importCategoryRule);\""
fi
grep -c importCategoryRule node_modules/@prisma/client/index.js || echo nm_count=0
"""
_, o, _ = c.exec_command(cmd, get_pty=True, timeout=60)
sys.stdout.write(o.read().decode("utf-8", errors="replace"))
c.close()
