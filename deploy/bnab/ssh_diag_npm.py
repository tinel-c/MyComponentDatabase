#!/usr/bin/env python3
"""Quick SSH diagnostics for stuck BNAB npm install."""
from __future__ import annotations

import re
import sys
from pathlib import Path

import paramiko


def load_secrets(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] == '"':
            v = v[1:-1]
        env[k] = v
    return env


def main() -> None:
    env = load_secrets(Path(__file__).resolve().parent.parent / "deploy.secrets")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        hostname=env["DEPLOY_HOST"],
        port=int(env.get("DEPLOY_SSH_PORT") or "22"),
        username=env["DEPLOY_USER"],
        password=env["DEPLOY_SSH_PASSWORD"],
        timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    cmd = r"""bash -lc '
echo "=== status file ==="
cat /opt/bnab/green/bnab/.deploy-npm-status 2>/dev/null || echo none
echo "=== df ==="
df -h / /opt /tmp 2>/dev/null | sed -n "1,10p"
echo "=== free ==="
free -h | head -3
echo "=== npm/node procs ==="
ps -eo pid,ppid,stat,etime,cmd | grep -E "[n]pm|[n]ode" | head -30
echo "=== npm cwd / fds sample ==="
for pid in $(pgrep -x npm || true); do
  echo "pid=$pid cwd=$(readlink -f /proc/$pid/cwd 2>/dev/null)"
  ls -l /proc/$pid/fd 2>/dev/null | head -20
  tr "\0" " " < /proc/$pid/cmdline; echo
done
echo "=== node_modules size ==="
du -sh /opt/bnab/green/bnab/node_modules 2>/dev/null || true
ls /opt/bnab/green/bnab/node_modules 2>/dev/null | wc -l
echo "=== recent npm debug log ==="
ls -lt ~/.npm/_logs 2>/dev/null | head -5
log=$(ls -t ~/.npm/_logs/*debug*.log 2>/dev/null | head -1)
if [[ -n "$log" ]]; then echo "log=$log"; tail -40 "$log"; fi
'
"""
    _, stdout, stderr = c.exec_command(cmd, timeout=90)
    sys.stdout.write(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err:
        sys.stderr.write(err)
    c.close()


if __name__ == "__main__":
    main()
