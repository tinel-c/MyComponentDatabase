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
# Reproduce empty-months using the same firstMonth/endMonth logic + require built engine if possible
cmd = r"""
sudo -u deploy bash -lc '
cd /opt/bnab/green/bnab
set -a; . /opt/bnab/shared/.env; set +a
export DATABASE_URL=file:/opt/bnab/shared/bnab.db
node <<'"'"'NODE'"'"'
function addMonths(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function currentMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const firstMonth = "2026-09";
const endMonth = currentMonth();
console.log("now", new Date().toISOString(), "currentMonth", endMonth, "first", firstMonth);
const months = [];
let m = firstMonth;
while (m <= endMonth) {
  months.push(m);
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
console.log("engineMonths", months);

// Try loading compiled plan-data path
const fs = require("fs");
const path = require("path");
function walk(dir, acc=[]) {
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name.includes("plan-data")) acc.push(p);
  }
  return acc;
}
const hits = walk(".next/server").filter(p => p.endsWith(".js")).slice(0, 20);
console.log("plan-data chunks", hits);
NODE
'
"""
_, o, _ = c.exec_command(cmd, get_pty=True, timeout=60)
sys.stdout.write(o.read().decode("utf-8", errors="replace"))
c.close()
