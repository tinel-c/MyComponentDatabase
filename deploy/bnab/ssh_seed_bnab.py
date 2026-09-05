#!/usr/bin/env python3
"""Seed BNAB DB immediately to break login↔plan redirect loop."""
from __future__ import annotations

import sys
from pathlib import Path

import paramiko

env: dict[str, str] = {}
for line in Path(__file__).resolve().parent.parent.joinpath("deploy.secrets").read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] == '"':
        v = v[1:-1]
    env[k] = v

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
cmd = r"""bash -lc '
set -euo pipefail
cd /opt/bnab/green/bnab
export DATABASE_URL=file:/opt/bnab/shared/bnab.db
set -a
. /opt/bnab/shared/.env
set +a
npx prisma db seed
echo SEED_OK
'
"""
_, o, e = c.exec_command(cmd, get_pty=True, timeout=180)
sys.stdout.write(o.read().decode("utf-8", errors="replace"))
err = e.read().decode("utf-8", errors="replace")
if err.strip():
    print(err[-1000:])
c.close()
