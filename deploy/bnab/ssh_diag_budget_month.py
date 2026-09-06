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
sudo -u deploy bash -lc '
  cd /opt/bnab/green/bnab
  set -a; . /opt/bnab/shared/.env; set +a
  export DATABASE_URL=file:/opt/bnab/shared/bnab.db
  node <<'"'"'NODE'"'"'
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const budgets = await p.budget.findMany({ select: { id: true, name: true, firstMonth: true, currency: true } });
  console.log("budgets", JSON.stringify(budgets, null, 2));
  for (const b of budgets) {
    const acct = await p.financeAccount.count({ where: { budgetId: b.id } });
    const cats = await p.category.count({ where: { group: { budgetId: b.id } } });
    const tx = await p.transaction.count({ where: { account: { budgetId: b.id } } });
    console.log(b.name, "accounts", acct, "cats", cats, "tx", tx, "firstMonth", JSON.stringify(b.firstMonth));
  }
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE
'
"""
_, o, _ = c.exec_command(cmd, get_pty=True, timeout=60)
sys.stdout.write(o.read().decode("utf-8", errors="replace"))
c.close()
