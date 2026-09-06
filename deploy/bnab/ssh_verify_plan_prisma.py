#!/usr/bin/env python3
"""Clear error log, hit authenticated plan if possible, show fresh errors."""
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


def run(c: paramiko.SSHClient, cmd: str, timeout: int = 90) -> None:
    print(f"\n>>> {cmd[:140]}", flush=True)
    _, stdout, _ = c.exec_command(cmd, get_pty=True, timeout=timeout)
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
run(
    c,
    r"""set -euo pipefail
: > /home/deploy/.pm2/logs/bnab-green-error.log
# Simulate what Next does: require prisma from app cwd after generate
sudo -u deploy bash -lc '
  cd /opt/bnab/green/bnab
  set -a; . /opt/bnab/shared/.env; set +a
  export DATABASE_URL=file:/opt/bnab/shared/bnab.db
  node <<'"'"'NODE'"'"'
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    const rows = await p.importCategoryRule.findMany({ take: 1, select: { id: true } });
    console.log("FIND_OK", rows.length);
  } catch (e) {
    console.log("FIND_FAIL", e);
  } finally {
    await p.$disconnect();
  }
})();
NODE
'
# Check for traced prisma copy inside .next
ls -d /opt/bnab/green/bnab/.next/node_modules/@prisma/client* 2>/dev/null | head -5 || echo NO_NEXT_PRISMA_COPY
# Force one server-side plan render via next if possible - at least curl login+home
curl -sS -o /dev/null -w "home=%{http_code}\n" --max-time 15 http://127.0.0.1:3011/
sleep 1
echo "--- errors after curl ---"
cat /home/deploy/.pm2/logs/bnab-green-error.log | tail -30 || true
""",
)
c.close()
