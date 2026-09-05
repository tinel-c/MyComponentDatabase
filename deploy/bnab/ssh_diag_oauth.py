#!/usr/bin/env python3
"""Diagnose OAuth redirect_uri_mismatch for warehouse + BNAB."""
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
echo ===AUTH_URL===
grep "^AUTH_URL=" /opt/warehouse/shared/.env /opt/bnab/shared/.env

echo ===NGINX===
echo -- bnab --
grep -E "listen|server_name|ssl_certificate|proxy_pass|return" /etc/nginx/sites-enabled/bnab 2>/dev/null | head -40
echo -- warehouse --
grep -E "listen|server_name|ssl_certificate|proxy_pass|return" /etc/nginx/sites-enabled/warehouse 2>/dev/null | head -40

echo ===CERTS===
ls /etc/letsencrypt/live/ 2>/dev/null || true

echo ===PROVIDERS_HTTP===
curl -sS -m 5 -H "Host: part-db.bogza.ro" http://127.0.0.1/api/auth/providers; echo
curl -sS -m 5 -H "Host: bnab.bogza.ro" http://127.0.0.1/api/auth/providers; echo

echo ===PROVIDERS_HTTPS_SNI===
curl -sS -m 5 -k --resolve part-db.bogza.ro:443:127.0.0.1 https://part-db.bogza.ro/api/auth/providers; echo
curl -sS -m 5 -k --resolve bnab.bogza.ro:443:127.0.0.1 https://bnab.bogza.ro/api/auth/providers; echo

echo ===SIGNIN_REDIRECT_BNAB===
# Follow Location from signin to see redirect_uri Google gets
curl -sS -m 8 -k -D - -o /dev/null --resolve bnab.bogza.ro:443:127.0.0.1 \
  "https://bnab.bogza.ro/api/auth/signin/google" | tr -d "\r" | grep -iE "^(HTTP|location):" | head -10
curl -sS -m 8 -D - -o /dev/null -H "Host: bnab.bogza.ro" \
  "http://127.0.0.1/api/auth/signin/google" | tr -d "\r" | grep -iE "^(HTTP|location):" | head -10

echo ===SIGNIN_REDIRECT_WH===
curl -sS -m 8 -k -D - -o /dev/null --resolve part-db.bogza.ro:443:127.0.0.1 \
  "https://part-db.bogza.ro/api/auth/signin/google" | tr -d "\r" | grep -iE "^(HTTP|location):" | head -10

echo ===PORTS===
ss -ltnp | grep -E ":(3000|3001|3011) " || true
pm2 list | head -15
'
"""
_, out, err = c.exec_command(cmd, timeout=90)
sys.stdout.write(out.read().decode("utf-8", errors="replace"))
e = err.read().decode("utf-8", errors="replace")
if e.strip():
    print("STDERR:", e[-1500:])
c.close()
