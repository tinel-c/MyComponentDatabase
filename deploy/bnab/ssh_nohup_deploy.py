#!/usr/bin/env python3
"""Start BNAB deploy on VPS via nohup; poll /tmp/bnab-deploy.log."""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import paramiko


def load_secrets(path: Path) -> dict[str, str]:
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


def main() -> None:
    env = load_secrets(Path(__file__).resolve().parent.parent / "deploy.secrets")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=env["DEPLOY_HOST"],
        port=int(env.get("DEPLOY_SSH_PORT") or "22"),
        username=env["DEPLOY_USER"],
        password=env["DEPLOY_SSH_PASSWORD"],
        timeout=90,
        banner_timeout=90,
        allow_agent=False,
        look_for_keys=False,
    )
    start = r"""set -euo pipefail
pkill -f '/opt/bnab/.*/bnab/node_modules' || true
pkill -f 'deploy-bnab.sh' || true
sleep 2
for s in blue green; do
  git -C /opt/bnab/$s fetch origin
  git -C /opt/bnab/$s reset --hard origin/main
done
df -h / /opt | head -20
free -h | head -5
nohup bash -lc 'bash /opt/bnab/blue/deploy/bnab/deploy-bnab.sh > /tmp/bnab-deploy.log 2>&1; echo EXIT:$? >> /tmp/bnab-deploy.log' >/dev/null 2>&1 &
echo STARTED_PID:$!
sleep 1
tail -5 /tmp/bnab-deploy.log || true
"""
    stdin, stdout, stderr = client.exec_command(start, timeout=120)
    out = stdout.read().decode("utf-8", errors="replace")
    print(out)
    print(stderr.read().decode("utf-8", errors="replace"))

    for i in range(90):  # up to ~15 min
        time.sleep(10)
        _, so, _ = client.exec_command(
            "tail -n 30 /tmp/bnab-deploy.log; grep -E '^EXIT:' /tmp/bnab-deploy.log || true; "
            "pgrep -af 'deploy-bnab|npm install|next build' | head -5 || true"
        )
        chunk = so.read().decode("utf-8", errors="replace")
        print(f"\n--- poll {i+1} ---\n{chunk}", flush=True)
        if "EXIT:0" in chunk:
            print("SUCCESS")
            # seed + smoke
            _, so2, _ = client.exec_command(
                r"""set -euo pipefail
ACTIVE=$(tr -d '[:space:]' </opt/bnab/active_slot)
cd /opt/bnab/$ACTIVE/bnab
export DATABASE_URL=file:/opt/bnab/shared/bnab.db
set -a; source /opt/bnab/shared/.env; set +a
npx prisma db seed || true
curl -sS -o /dev/null -w 'local:%{http_code}\n' http://127.0.0.1:3010/ || curl -sS -o /dev/null -w 'local:%{http_code}\n' http://127.0.0.1:3011/
curl -sS -o /dev/null -w 'vhost:%{http_code}\n' -H 'Host: bnab.bogza.ro' http://127.0.0.1/ || true
pm2 list | head -20
"""
            )
            print(so2.read().decode("utf-8", errors="replace"))
            client.close()
            return
        if re.search(r"EXIT:[1-9]", chunk):
            print("FAILED")
            client.close()
            sys.exit(1)
    print("TIMEOUT waiting for deploy")
    client.close()
    sys.exit(2)


if __name__ == "__main__":
    main()
