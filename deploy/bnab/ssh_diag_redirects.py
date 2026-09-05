#!/usr/bin/env python3
"""Diagnose BNAB ERR_TOO_MANY_REDIRECTS."""
from __future__ import annotations

import sys
from pathlib import Path

import paramiko

env: dict[str, str] = {}
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
set +e
echo ===NGINX_BNAB===
cat /etc/nginx/sites-enabled/bnab
echo
echo ===UPSTREAM===
cat /opt/bnab/nginx-active-upstream.conf
echo
echo ===CURL_HTTP===
curl -sS -m 8 -D - -o /dev/null -H "Host: bnab.bogza.ro" http://127.0.0.1/ | tr -d "\r" | grep -iE "^(HTTP|location|set-cookie):" | head -20
echo ===CURL_HTTPS===
curl -sS -m 8 -k -D - -o /dev/null --resolve bnab.bogza.ro:443:127.0.0.1 https://bnab.bogza.ro/ | tr -d "\r" | grep -iE "^(HTTP|location|set-cookie):" | head -20
echo ===CURL_HTTPS_LOGIN===
curl -sS -m 8 -k -D - -o /dev/null --resolve bnab.bogza.ro:443:127.0.0.1 https://bnab.bogza.ro/login | tr -d "\r" | grep -iE "^(HTTP|location|set-cookie):" | head -20
echo ===CURL_LOCAL_3011===
curl -sS -m 5 -D - -o /dev/null http://127.0.0.1:3011/ | tr -d "\r" | grep -iE "^(HTTP|location):" | head -10
curl -sS -m 5 -D - -o /dev/null -H "X-Forwarded-Proto: https" -H "Host: bnab.bogza.ro" http://127.0.0.1:3011/ | tr -d "\r" | grep -iE "^(HTTP|location):" | head -10
echo ===FOLLOW_MAX10===
curl -sS -m 15 -k -L --max-redirs 10 -D - -o /dev/null --resolve bnab.bogza.ro:443:127.0.0.1 https://bnab.bogza.ro/ 2>&1 | tr -d "\r" | grep -iE "^(HTTP|location):|Too many|Maximum" | head -40
echo ===ENV===
grep -E "^AUTH_URL=|^AUTH_SECRET=" /opt/bnab/shared/.env | sed "s/SECRET=.*/SECRET=<set>/"
echo ===PM2===
pm2 list | head -12
'
"""
_, o, e = c.exec_command(cmd, timeout=90)
sys.stdout.write(o.read().decode("utf-8", errors="replace"))
err = e.read().decode("utf-8", errors="replace")
if err.strip():
    print("STDERR:", err[-1500:])
c.close()
