#!/usr/bin/env python3
"""BNAB status: active slot, both PM2 apps, local health, public site."""
from __future__ import annotations

import sys
from pathlib import Path

import paramiko

# PM2 tables use box-drawing chars; Windows consoles are often cp1252.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


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


def emit(stream, data: bytes) -> None:
    text = data.decode("utf-8", errors="replace")
    try:
        stream.write(text)
    except UnicodeEncodeError:
        enc = getattr(stream, "encoding", None) or "utf-8"
        stream.buffer.write(text.encode(enc, errors="replace"))


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
    r"""bash -lc '
set +e
echo -n "active_slot="
cat /opt/bnab/active_slot 2>/dev/null
echo
echo "==== upstream ===="
cat /opt/bnab/nginx-active-upstream.conf 2>/dev/null
echo "==== pm2 ===="
sudo -u deploy -H pm2 jlist 2>/dev/null | python3 -c "
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  n=a.get(\"name\",\"\")
  if n.startswith(\"bnab-\"):
    print(n, a.get(\"pm_id\"), a.get(\"pm2_env\",{}).get(\"status\"), a.get(\"pm2_env\",{}).get(\"status\"))
" 2>/dev/null
sudo -u deploy -H pm2 list 2>/dev/null | head -40
echo "==== local health ===="
for p in 3010 3011; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:$p/api/health 2>/dev/null || echo 000)
  echo "port $p /api/health=$code"
done
echo "==== public ===="
curl -sS -o /dev/null -w "site=%{http_code}\n" --max-time 15 https://bnab.bogza.ro/ || echo site=000
echo "==== ports ===="
ss -ltnp 2>/dev/null | grep -E "3010|3011" || true
'
""",
    timeout=90,
)
emit(sys.stdout, o.read())
emit(sys.stderr, e.read())
c.close()
