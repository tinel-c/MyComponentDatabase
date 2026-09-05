#!/usr/bin/env python3
"""Diagnose login breakage for warehouse + BNAB."""
from __future__ import annotations

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
echo ===PM2===
pm2 jlist 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin);
[print(p[\"name\"], p[\"pm2_env\"].get(\"status\"), \"restarts\", p[\"pm2_env\"].get(\"restart_time\"), \"cwd\", p[\"pm2_env\"].get(\"pm_cwd\"), \"script\", p[\"pm2_env\"].get(\"pm_exec_path\"), \"args\", p[\"pm2_env\"].get(\"args\")) for p in d]"

echo ===PORTS===
ss -ltnp 2>/dev/null | grep -E ":(3000|3001|3010|3011) " || netstat -ltnp 2>/dev/null | grep -E ":(3000|3001|3010|3011) "

echo ===ACTIVE===
echo -n warehouse:; cat /opt/warehouse/active_slot 2>/dev/null; echo
echo -n bnab:; cat /opt/bnab/active_slot 2>/dev/null; echo
echo ===UPSTREAM===
echo warehouse:; cat /opt/warehouse/nginx-active-upstream.conf 2>/dev/null
echo bnab:; cat /opt/bnab/nginx-active-upstream.conf 2>/dev/null

echo ===ENV_KEYS===
for f in /opt/warehouse/shared/.env /opt/bnab/shared/.env; do
  echo "-- $f"
  grep -E "^(AUTH_URL|AUTH_SECRET|AUTH_GOOGLE_ID|AUTH_GOOGLE_SECRET|ADMIN_EMAIL)=" "$f" 2>/dev/null | sed -E "s/(SECRET|ID)=.*/\1=<set>/" 
done

echo ===SYMLINKS===
ls -l /opt/warehouse/blue/web/.env /opt/warehouse/green/web/.env /opt/bnab/green/bnab/.env /opt/bnab/blue/bnab/.env 2>&1

echo ===AUTH_URL_VALUES===
grep "^AUTH_URL=" /opt/warehouse/shared/.env /opt/bnab/shared/.env 2>/dev/null

echo ===START_SCRIPTS===
grep -n "\"start\"" /opt/warehouse/green/web/package.json /opt/warehouse/blue/web/package.json /opt/bnab/green/bnab/package.json 2>/dev/null

echo ===CURL_LOCAL===
for p in 3000 3001 3010 3011; do
  code=$(curl -sS -m 3 -o /dev/null -w "%{http_code}" http://127.0.0.1:$p/ 2>/dev/null || echo err)
  echo "port $p -> $code"
done

echo ===CURL_AUTH===
for host in part-db.bogza.ro bnab.bogza.ro; do
  echo "-- $host"
  curl -sS -m 5 -o /dev/null -w "root:%{http_code} proto_redir:%{redirect_url}\n" -H "Host: $host" http://127.0.0.1/ || true
  curl -sS -m 5 -w "\nproviders:%{http_code}\n" -H "Host: $host" http://127.0.0.1/api/auth/providers || true
  curl -sS -m 5 -w "\ncsrf:%{http_code}\n" -H "Host: $host" http://127.0.0.1/api/auth/csrf || true
  curl -sS -m 5 -k -w "\nhttps_providers:%{http_code}\n" -H "Host: $host" https://127.0.0.1/api/auth/providers 2>/dev/null | tail -5 || true
done

echo ===NGINX_SITES===
ls -la /etc/nginx/sites-enabled/ 2>/dev/null
for f in /etc/nginx/sites-enabled/*; do
  echo "-- $f"
  grep -E "server_name|listen|proxy_pass|ssl_certificate|return" "$f" 2>/dev/null | head -30
done

echo ===LOGS_WH===
pm2 logs warehouse-green --lines 25 --nostream 2>&1 | tail -35
echo ===LOGS_WH_BLUE===
pm2 logs warehouse-blue --lines 15 --nostream 2>&1 | tail -20
echo ===LOGS_BNAB===
pm2 logs bnab-green --lines 25 --nostream 2>&1 | tail -35

echo ===FREE===
free -h | head -2
'
"""

_, stdout, stderr = c.exec_command(cmd, timeout=120)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print("STDERR:", err[-2000:])
c.close()
