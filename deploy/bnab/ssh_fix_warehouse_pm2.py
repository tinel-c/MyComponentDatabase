#!/usr/bin/env python3
"""Clean restart warehouse-green on 3001 (no EADDRINUSE)."""
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
pm2 delete warehouse-green >/dev/null 2>&1 || true
sleep 1
fuser -k 3001/tcp >/dev/null 2>&1 || true
sleep 2
ln -sfn /opt/warehouse/shared/.env /opt/warehouse/green/web/.env
PORT=3001 NODE_ENV=production pm2 start /opt/warehouse/green/web/node_modules/next/dist/bin/next \
  --name warehouse-green \
  --cwd /opt/warehouse/green/web \
  -- start --port 3001
pm2 save
sleep 5
echo -n status:; pm2 jlist | python3 -c "import sys,json; d=json.load(sys.stdin);
print([(p[\"name\"], p[\"pm2_env\"][\"status\"], p[\"pm2_env\"].get(\"restart_time\"), p[\"pid\"]) for p in d])"
echo -n local:; curl -sS -m 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/; echo
echo -n https:; curl -sS -m 5 -k --resolve part-db.bogza.ro:443:127.0.0.1 -o /dev/null -w "%{http_code}" https://part-db.bogza.ro/; echo
'
"""
_, o, _ = c.exec_command(cmd, get_pty=True, timeout=90)
sys.stdout.write(o.read().decode("utf-8", errors="replace"))
c.close()
