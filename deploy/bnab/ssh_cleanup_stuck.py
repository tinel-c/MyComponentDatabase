#!/usr/bin/env python3
from pathlib import Path
import paramiko

env = {}
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
for pid in $(pgrep -x npm || true); do
  cwd=$(readlink -f /proc/$pid/cwd 2>/dev/null || true)
  case "$cwd" in /opt/bnab/*) echo kill:$pid:$cwd; kill -9 $pid;; esac
done
pm2 start warehouse-green warehouse-blue 2>/dev/null || true
free -h | head -2
pm2 list | head -12
'"""
_, o, e = c.exec_command(cmd, timeout=90)
print(o.read().decode("utf-8", errors="replace"))
err = e.read().decode("utf-8", errors="replace")
if err:
    print(err)
c.close()
