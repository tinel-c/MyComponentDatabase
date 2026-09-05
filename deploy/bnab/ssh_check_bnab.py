#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

import paramiko


def load(path: Path) -> dict[str, str]:
    env = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip()
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
_, o, e = c.exec_command(
    "bash -lc 'pm2 describe bnab-green | head -60; echo ====; pm2 logs bnab-green --lines 40 --nostream; echo ====; ss -ltnp | grep -E \"3010|3011|next\" || true; echo ====; tr \"\\0\" \" \" < /proc/$(pgrep -n -f \"next start\" || echo 1)/cmdline 2>/dev/null; echo'",
    timeout=60,
)
sys.stdout.write(o.read().decode("utf-8", errors="replace"))
sys.stderr.write(e.read().decode("utf-8", errors="replace"))
c.close()
