#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

import paramiko


def load(path: Path) -> dict[str, str]:
    env = {}
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
_, o, _ = c.exec_command(
    "tail -n 40 /home/deploy/.pm2/logs/bnab-green-error.log; echo ====; cat /opt/bnab/green/bnab/.next/BUILD_ID; "
    "rg -n 'planAmount' /opt/bnab/green/bnab/.next/server -g '*.js' 2>/dev/null | head -5 || "
    "grep -R 'planAmount' /opt/bnab/green/bnab/.next/server --include='*.js' 2>/dev/null | head -5 || echo NO_PLANAMOUNT_IN_BUILD",
    timeout=60,
)
sys.stdout.write(o.read().decode("utf-8", errors="replace"))
c.close()
