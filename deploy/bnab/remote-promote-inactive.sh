#!/usr/bin/env bash
# Promote a pre-uploaded .next tarball to the INACTIVE blue/green slot, then
# cut nginx over. Never stops the active slot until after a successful switch.
#
# Prerequisites (already on disk):
#   /opt/bnab/shared/bnab-next-upload.tgz
#   /opt/bnab/shared/bnab-overlay.tgz          (optional)
#   /opt/bnab/shared/overlay/schema.prisma     (optional)
#   /opt/bnab/shared/overlay/seed.ts           (optional)
#   /opt/bnab/shared/bnab-public.tgz          (optional brand assets)
#
# Usage (as root or with sudo for nginx): bash remote-promote-inactive.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/bnab}"
ACTIVE_FILE="${APP_ROOT}/active_slot"
UPSTREAM_FILE="${APP_ROOT}/nginx-active-upstream.conf"
SHARED="${APP_ROOT}/shared"

log() { printf '[promote] %s\n' "$*"; }
die() { printf '[promote] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$ACTIVE_FILE" ]] || die "missing $ACTIVE_FILE"
ACTIVE="$(tr -d '[:space:]' < "$ACTIVE_FILE" | tr '[:upper:]' '[:lower:]')"
[[ "$ACTIVE" == "blue" || "$ACTIVE" == "green" ]] || die "invalid active_slot: $ACTIVE"

if [[ "$ACTIVE" == "blue" ]]; then
  INACTIVE="green"
else
  INACTIVE="blue"
fi

case "$INACTIVE" in
  blue) PORT=3010; PM2_NAME="bnab-blue" ;;
  green) PORT=3011; PM2_NAME="bnab-green" ;;
esac

case "$ACTIVE" in
  blue) PREV_PM2="bnab-blue"; PREV_PORT=3010 ;;
  green) PREV_PM2="bnab-green"; PREV_PORT=3011 ;;
esac

SLOT_DIR="${APP_ROOT}/${INACTIVE}"
APP_DIR="${SLOT_DIR}/bnab"
TGZ="${SHARED}/bnab-next-upload.tgz"

[[ -d "$APP_DIR" ]] || die "missing app dir $APP_DIR"
[[ -f "$TGZ" ]] || die "missing $TGZ"

log "active=$ACTIVE (port $PREV_PORT) → promote inactive=$INACTIVE (port $PORT)"
log "live slot stays up until nginx cutover"

# --- prep inactive only (never touch active port) ---
chown -R deploy:deploy "$SLOT_DIR" "$SHARED" 2>/dev/null || true
sudo -u deploy -H bash -lc "
  set -euo pipefail
  pm2 delete '${PM2_NAME}' >/dev/null 2>&1 || true
  pm2 jlist 2>/dev/null | python3 -c \"
import json,sys
try:
  apps=json.load(sys.stdin)
except Exception:
  apps=[]
for a in apps:
  if a.get('name')=='${PM2_NAME}':
    print(a.get('pm_id',''))
\" | while read -r id; do
    [ -n \"\$id\" ] && pm2 delete \"\$id\" >/dev/null 2>&1 || true
  done
" || true
# Free inactive port only
fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
rm -rf "${APP_DIR}/.next"
mkdir -p "${APP_DIR}"

# --- extract + prisma as deploy ---
sudo -u deploy bash -lc '
  set -euo pipefail
  cd "'"${APP_DIR}"'"
  git fetch origin && git reset --hard origin/main || true
  rm -rf .next
  tar -xzf "'"${TGZ}"'"
  test -f .next/BUILD_ID
  echo BUILD_ID=$(cat .next/BUILD_ID)
  # Inactive slot deps often lag; always mirror live slot node_modules for PC builds
  if [ -d "'"${APP_ROOT}/${ACTIVE}"'"/bnab/node_modules/next ]; then
    echo "sync node_modules from active='"${ACTIVE}"'"
    rm -rf node_modules
    cp -a "'"${APP_ROOT}/${ACTIVE}"'"/bnab/node_modules node_modules
  elif [ ! -d node_modules/next ]; then
    echo "ERROR: no node_modules on active or inactive" >&2
    exit 1
  fi
  if [ -f "'"${SHARED}"'"/overlay/schema.prisma ]; then
    cp -f "'"${SHARED}"'"/overlay/schema.prisma prisma/schema.prisma
  fi
  if [ -f "'"${SHARED}"'"/overlay/seed.ts ]; then
    cp -f "'"${SHARED}"'"/overlay/seed.ts prisma/seed.ts
  fi
  if [ -f "'"${SHARED}"'"/bnab-overlay.tgz ]; then
    tar -xzf "'"${SHARED}"'"/bnab-overlay.tgz
  fi
  if [ -f "'"${SHARED}"'"/bnab-public.tgz ]; then
    mkdir -p public/brand
    tar -xzf "'"${SHARED}"'"/bnab-public.tgz -C public
  fi
  set -a; . "'"${SHARED}"'"/.env; set +a
  export DATABASE_URL=file:'"${SHARED}"'/bnab.db
  ln -sfn "'"${SHARED}"'"/.env .env
  npx prisma generate
  npx prisma migrate deploy
  node -e "const {PrismaClient}=require(\"@prisma/client\"); const p=new PrismaClient(); if(!p.importCategoryRule){console.error(\"MISSING importCategoryRule\"); process.exit(1)}; console.log(\"PRISMA_OK\")"
  shopt -s nullglob
  for d in .next/node_modules/@prisma/client-*; do
    echo "sync $d"
    rm -rf "$d"; mkdir -p "$d"
    cp -a node_modules/@prisma/client/. "$d/"
  done
  if [ -d node_modules/.prisma ]; then
    echo "sync .next/node_modules/.prisma"
    rm -rf .next/node_modules/.prisma
    mkdir -p .next/node_modules
    cp -a node_modules/.prisma .next/node_modules/
  fi
'
chown -R deploy:deploy "${APP_DIR}/.next"

# --- start inactive ---
sudo -u deploy -H bash -lc "
  set -euo pipefail
  cd '${APP_DIR}'
  set -a; . '${SHARED}/.env'; set +a
  export DATABASE_URL=file:${SHARED}/bnab.db
  export BNAB_SLOT='${INACTIVE}'
  export PORT='${PORT}'
  export NODE_ENV=production
  PORT='${PORT}' BNAB_SLOT='${INACTIVE}' NODE_ENV=production \\
    pm2 start ./node_modules/next/dist/bin/next \\
      --name '${PM2_NAME}' \\
      --cwd '${APP_DIR}' \\
      -- start --port '${PORT}'
  pm2 save
"

# --- health ---
code="000"
for i in $(seq 1 20); do
  sleep 2
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${PORT}/api/health" 2>/dev/null || echo 000)"
  if [[ "$code" == "200" ]]; then
    log "health /api/health attempt $i → HTTP $code"
    break
  fi
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${PORT}/" 2>/dev/null || echo 000)"
  log "health attempt $i → HTTP $code"
  if [[ "$code" =~ ^(200|204|302|307|308)$ ]]; then
    break
  fi
done
if [[ ! "$code" =~ ^(200|204|302|307|308)$ ]]; then
  die "inactive health check failed: HTTP $code — leaving active=$ACTIVE untouched"
fi

# --- cutover ---
log "nginx upstream → $INACTIVE ($PORT)"
printf 'upstream bnab_app {\n    server 127.0.0.1:%s;\n}\n' "$PORT" >"$UPSTREAM_FILE"
echo "$INACTIVE" >"$ACTIVE_FILE"
chown deploy:deploy "$UPSTREAM_FILE" "$ACTIVE_FILE" 2>/dev/null || true
if command -v sudo >/dev/null 2>&1; then
  sudo /usr/sbin/nginx -t
  sudo /bin/systemctl reload nginx
else
  /usr/sbin/nginx -t
  /bin/systemctl reload nginx
fi

log "stop previous PM2: $PREV_PM2 (kept for rollback; not deleted)"
sudo -u deploy -H bash -lc "pm2 stop '${PREV_PM2}' >/dev/null 2>&1 || true; pm2 save" || true

# cleanup artifacts
rm -f "${SHARED}/bnab-next-upload.tgz" "${SHARED}/bnab-overlay.tgz" "${SHARED}/bnab-public.tgz"
rm -rf "${SHARED}/overlay"

site="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 https://bnab.bogza.ro/ 2>/dev/null || echo 000)"
log "site=HTTPS $site active_slot=$INACTIVE"
echo "PROMOTE_OK active=$INACTIVE port=$PORT"
