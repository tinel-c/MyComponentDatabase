#!/usr/bin/env bash
# Blue-green deploy for Hobby Warehouse (Next.js in web/). Run on the VPS as the deploy user.
# Expects: /opt/warehouse layout from setup-server.sh, shared SQLite + .env under /opt/warehouse/shared.
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/warehouse}"
ACTIVE_FILE="${APP_ROOT}/active_slot"
UPSTREAM_FILE="${APP_ROOT}/nginx-active-upstream.conf"
BRANCH="${DEPLOY_BRANCH:-main}"
GIT_REMOTE="${DEPLOY_GIT_REMOTE:-origin}"

log() { printf '[deploy] %s\n' "$*"; }

die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

# Git 2.35+ blocks commands when the repo owner differs from the current user (e.g. root-owned trees, SSH as deploy).
ensure_git_safe_directories() {
  local slot dir
  for slot in blue green; do
    dir="${APP_ROOT}/${slot}"
    if [[ -d "${dir}/.git" ]]; then
      if ! git config --global --get-all safe.directory 2>/dev/null | grep -qxF "$dir"; then
        git config --global --add safe.directory "$dir"
      fi
    fi
  done
}
ensure_git_safe_directories

[[ -f "$ACTIVE_FILE" ]] || die "missing $ACTIVE_FILE — run setup-server.sh first"

ACTIVE="$(tr -d '[:space:]' < "$ACTIVE_FILE" | tr '[:upper:]' '[:lower:]')"
[[ "$ACTIVE" == "blue" || "$ACTIVE" == "green" ]] || die "invalid active slot: $ACTIVE"

if [[ "$ACTIVE" == "blue" ]]; then
  INACTIVE="green"
else
  INACTIVE="blue"
fi

case "$INACTIVE" in
  blue) PORT=3000 PM2_NAME="warehouse-blue" ;;
  green) PORT=3001 PM2_NAME="warehouse-green" ;;
esac

# After nginx switches, stop the slot that was serving traffic (old active).
case "$ACTIVE" in
  blue) PREVIOUS_PM2="warehouse-blue" ;;
  green) PREVIOUS_PM2="warehouse-green" ;;
esac

SLOT_DIR="${APP_ROOT}/${INACTIVE}"
WEB_DIR="${SLOT_DIR}/web"
SHARED_ENV="${APP_ROOT}/shared/.env"
SHARED_DB="${APP_ROOT}/shared/warehouse.db"

[[ -d "$SLOT_DIR/.git" ]] || die "not a git repo: $SLOT_DIR"
[[ -f "$SHARED_ENV" ]] || die "missing $SHARED_ENV"

log "active=$ACTIVE → deploy to inactive slot: $INACTIVE (port $PORT)"

git -C "$SLOT_DIR" fetch "$GIT_REMOTE"
git -C "$SLOT_DIR" checkout "$BRANCH"
git -C "$SLOT_DIR" pull --ff-only "$GIT_REMOTE" "$BRANCH"

mkdir -p "${APP_ROOT}/shared"
touch "$SHARED_DB"
chmod 664 "$SHARED_DB" 2>/dev/null || true

ln -sfn "$SHARED_ENV" "${WEB_DIR}/.env"

export DATABASE_URL="file:${SHARED_DB}"
cd "$WEB_DIR"

log "npm ci"
npm ci --no-audit --no-fund

log "prisma migrate deploy"
npx prisma migrate deploy

log "npm run build"
export NODE_ENV=production
npm run build

log "restart PM2: $PM2_NAME on port $PORT"
if command -v pm2 >/dev/null 2>&1; then
  PORT="$PORT" pm2 delete "$PM2_NAME" 2>/dev/null || true
  PORT="$PORT" NODE_ENV=production pm2 start npm --name "$PM2_NAME" -- start
  pm2 save
else
  die "pm2 not found"
fi

log "health check http://127.0.0.1:${PORT}/"
sleep 2
code="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || echo "000")"
if [[ ! "$code" =~ ^(200|204|302|307|308)$ ]]; then
  die "health check failed: HTTP $code (expected 2xx/3xx)"
fi

log "nginx upstream → $INACTIVE ($PORT)"
printf 'upstream warehouse_app {\n    server 127.0.0.1:%s;\n}\n' "$PORT" >"$UPSTREAM_FILE"

if command -v sudo >/dev/null 2>&1; then
  sudo /usr/sbin/nginx -t
  sudo /bin/systemctl reload nginx
else
  /usr/sbin/nginx -t
  /bin/systemctl reload nginx
fi

echo "$INACTIVE" >"$ACTIVE_FILE"
log "active slot is now: $INACTIVE"

log "stop previous slot PM2: $PREVIOUS_PM2"
pm2 stop "$PREVIOUS_PM2" 2>/dev/null || true
pm2 save

log "done"
