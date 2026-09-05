#!/usr/bin/env python3
"""Finish BNAB green switch using next binary under PM2."""
from __future__ import annotations

import sys
import time
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


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> int:
    print(f"\n>>> {cmd[:220]}", flush=True)
    transport = client.get_transport()
    assert transport is not None
    chan = transport.open_session(timeout=60)
    chan.get_pty(width=200, height=50)
    chan.settimeout(0.0)
    chan.exec_command(cmd)
    deadline = time.time() + timeout
    buf = b""
    while True:
        if time.time() > deadline:
            print("\nTIMEOUT", flush=True)
            return 124
        if chan.recv_ready():
            chunk = chan.recv(16384)
            if chunk:
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    sys.stdout.buffer.write(line + b"\n")
                    sys.stdout.flush()
        if chan.exit_status_ready():
            while chan.recv_ready():
                buf += chan.recv(16384)
            if buf:
                sys.stdout.buffer.write(buf if buf.endswith(b"\n") else buf + b"\n")
                sys.stdout.flush()
            return chan.recv_exit_status()
        time.sleep(0.2)


CMD = r"""bash -lc '
set -euo pipefail
rm -f /opt/bnab/green/.git/index.lock
git -C /opt/bnab/green fetch origin
git -C /opt/bnab/green reset --hard origin/main
test -f /opt/bnab/green/bnab/node_modules/next/dist/bin/next
pm2 delete bnab-green >/dev/null 2>&1 || true
PORT=3011 NODE_ENV=production pm2 start ./node_modules/next/dist/bin/next \
  --name bnab-green \
  --cwd /opt/bnab/green/bnab \
  -- start --port 3011
pm2 save
code=000
i=0
while [ "$i" -lt 20 ]; do
  i=$((i+1))
  sleep 2
  code=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3011/ 2>/dev/null || echo 000)
  echo "health $i -> $code"
  case "$code" in 200|204|302|307|308) break ;; esac
done
case "$code" in
  200|204|302|307|308) ;;
  *) pm2 logs bnab-green --lines 40 --nostream; exit 1 ;;
esac
printf "upstream bnab_app {\n    server 127.0.0.1:3011;\n}\n" > /opt/bnab/nginx-active-upstream.conf
echo green > /opt/bnab/active_slot
sudo nginx -t
sudo systemctl reload nginx
echo -n local:; curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3011/; echo
echo -n vhost:; curl -sS -o /dev/null -w "%{http_code}" -H "Host: bnab.bogza.ro" http://127.0.0.1/; echo
pm2 list | head -20
echo SWITCH_OK
'"""


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
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        code = run(client, CMD, timeout=300)
        print("exit", code, flush=True)
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
