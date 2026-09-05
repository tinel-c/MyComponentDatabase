#!/usr/bin/env python3
"""Fix login: warehouse zombie port + BNAB TLS so OAuth redirect_uri is correct."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import paramiko


def load_secrets() -> dict[str, str]:
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
    return env


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 300) -> int:
    print(f"\n>>> {cmd[:160]}", flush=True)
    transport = client.get_transport()
    assert transport is not None
    chan = transport.open_session(timeout=60)
    chan.get_pty(width=200, height=60)
    chan.settimeout(0.0)
    chan.exec_command(cmd)
    deadline = time.time() + timeout
    buf = b""
    while True:
        if time.time() > deadline:
            print("TIMEOUT", flush=True)
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
        time.sleep(0.15)


def main() -> None:
    env = load_secrets()
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
        code = run(
            client,
            r"""bash -lc '
set -euo pipefail

echo "[1] Kill listeners on 3000/3001 and broken warehouse PM2 apps"
pm2 delete warehouse-blue warehouse-green 2>/dev/null || true
for pid in $(ss -ltnp | sed -n "s/.*:\(3000\|3001\) .*pid=\([0-9]*\).*/\2/p" | sort -u); do
  echo kill_port_holder:$pid
  kill -9 "$pid" 2>/dev/null || true
done
sleep 2

echo "[2] Start only warehouse-green on 3001 with shared .env"
cd /opt/warehouse/green/web
ln -sfn /opt/warehouse/shared/.env .env
# Strip accidental quotes from AUTH_URL if present
sed -i -E "s/^AUTH_URL=\"(.*)\"$/AUTH_URL=\1/" /opt/warehouse/shared/.env || true
sed -i -E "s/^AUTH_URL=\"(.*)\"$/AUTH_URL=\1/" /opt/bnab/shared/.env || true
PORT=3001 NODE_ENV=production pm2 start npm --name warehouse-green --cwd /opt/warehouse/green/web -- start
printf "upstream warehouse_app {\n    server 127.0.0.1:3001;\n}\n" > /opt/warehouse/nginx-active-upstream.conf
echo green > /opt/warehouse/active_slot

echo "[3] Ensure BNAB on 3011"
pm2 describe bnab-green >/dev/null 2>&1 || true
# restart bnab cleanly with next binary
pm2 delete bnab-green 2>/dev/null || true
ln -sfn /opt/bnab/shared/.env /opt/bnab/green/bnab/.env
PORT=3011 NODE_ENV=production pm2 start ./node_modules/next/dist/bin/next \
  --name bnab-green --cwd /opt/bnab/green/bnab -- start --port 3011
printf "upstream bnab_app {\n    server 127.0.0.1:3011;\n}\n" > /opt/bnab/nginx-active-upstream.conf
echo green > /opt/bnab/active_slot

echo "[4] Write BNAB nginx HTTP site (for certbot)"
cat > /tmp/bnab-http.conf << "EOF"
include /opt/bnab/nginx-active-upstream.conf;

server {
    listen 80;
    listen [::]:80;
    server_name bnab.bogza.ro;

    client_max_body_size 25m;

    location / {
        proxy_pass http://bnab_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
sudo cp /tmp/bnab-http.conf /etc/nginx/sites-available/bnab
sudo ln -sfn /etc/nginx/sites-available/bnab /etc/nginx/sites-enabled/bnab
sudo nginx -t
sudo systemctl reload nginx

echo "[5] Issue/renew BNAB cert so https://bnab does not hit warehouse SSL"
if [[ ! -f /etc/letsencrypt/live/bnab.bogza.ro/fullchain.pem ]]; then
  sudo certbot --nginx -d bnab.bogza.ro --non-interactive --agree-tos \
    --register-unsafely-without-email --redirect || echo CERTBOT_FAILED
fi

# If cert exists (now or already), force SSL site with correct proxy + X-Forwarded-Proto=https
if [[ -f /etc/letsencrypt/live/bnab.bogza.ro/fullchain.pem ]]; then
  cat > /tmp/bnab-ssl.conf << "EOF"
include /opt/bnab/nginx-active-upstream.conf;

server {
    listen 80;
    listen [::]:80;
    server_name bnab.bogza.ro;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name bnab.bogza.ro;

    ssl_certificate /etc/letsencrypt/live/bnab.bogza.ro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bnab.bogza.ro/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 25m;

    location / {
        proxy_pass http://bnab_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
  sudo cp /tmp/bnab-ssl.conf /etc/nginx/sites-available/bnab
  sudo nginx -t
  sudo systemctl reload nginx
  echo BNAB_SSL_OK
else
  echo BNAB_SSL_MISSING
fi

pm2 save
sleep 4

echo "[6] Verify callbacks"
ss -ltnp | grep -E ":(3001|3011) " || true
pm2 list | head -12
echo -n wh:; curl -sS -m 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/; echo
echo -n bnab:; curl -sS -m 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:3011/; echo
echo AUTH_URLS:
grep "^AUTH_URL=" /opt/warehouse/shared/.env /opt/bnab/shared/.env
echo HTTPS_BNAB_PROVIDERS:
curl -sS -m 8 -k --resolve bnab.bogza.ro:443:127.0.0.1 https://bnab.bogza.ro/api/auth/providers || true
echo
echo HTTPS_WH_PROVIDERS:
curl -sS -m 8 -k --resolve part-db.bogza.ro:443:127.0.0.1 https://part-db.bogza.ro/api/auth/providers || true
echo
echo FIX_LOGIN_DONE
'
""",
            timeout=420,
        )
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
