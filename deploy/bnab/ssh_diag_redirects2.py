#!/usr/bin/env python3
from pathlib import Path
import paramiko
import sys

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
c.connect(env["DEPLOY_HOST"], port=int(env.get("DEPLOY_SSH_PORT") or 22), username=env["DEPLOY_USER"], password=env["DEPLOY_SSH_PASSWORD"], timeout=60, allow_agent=False, look_for_keys=False)

cmd = r"""bash -lc '
set +e
echo ===VERBOSE_HTTPS===
curl -sS -m 10 -k -v --resolve bnab.bogza.ro:443:127.0.0.1 https://bnab.bogza.ro/ 2>&1 | tail -60

echo ===HEADERS_ONLY===
curl -sS -m 10 -k -I --resolve bnab.bogza.ro:443:127.0.0.1 https://bnab.bogza.ro/ 2>&1

echo ===APP_DIRECT===
curl -sS -m 5 -I http://127.0.0.1:3011/ 2>&1
curl -sS -m 5 -I -H "Host: bnab.bogza.ro" -H "X-Forwarded-Proto: https" http://127.0.0.1:3011/ 2>&1
curl -sS -m 5 -I -H "Host: bnab.bogza.ro" -H "X-Forwarded-Proto: http" http://127.0.0.1:3011/ 2>&1

echo ===CERTBOT_DUPES===
ls -la /etc/nginx/sites-enabled/
grep -n "bnab\|return 301\|listen 443" /etc/nginx/sites-enabled/* /etc/nginx/sites-available/bnab 2>/dev/null | head -40

echo ===WH_COMPARE===
curl -sS -m 5 -k -I --resolve part-db.bogza.ro:443:127.0.0.1 https://part-db.bogza.ro/ 2>&1 | head -20
'
"""
_, o, e = c.exec_command(cmd, timeout=90)
sys.stdout.write(o.read().decode("utf-8", errors="replace"))
c.close()
