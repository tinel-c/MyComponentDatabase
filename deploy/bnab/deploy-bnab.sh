#!/usr/bin/env bash
# Blue-green deploy for BNAB (Next.js in bnab/). Run on the VPS as the deploy user.
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/bnab}"
ACTIVE_FILE="${APP_ROOT}/active_slot"
UPSTREAM_FILE="${APP_ROOT}/nginx-active-upstream.conf"
BRANCH="${DEPLOY_BRANCH:-main}"
GIT_REMOTE="${DEPLOY_GIT_REMOTE:-origin}"

log() { printf '[deploy-bnab] %s\n' "$*"; }
die() { printf '[deploy-bnab] ERROR: %s\n' "$*" >&2; exit 1; }

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

[[ -f "$ACTIVE_FILE" ]] || die "missing $ACTIVE_FILE — run setup-bnab-server.sh first"

ACTIVE="$(tr -d '[:space:]' < "$ACTIVE_FILE" | tr '[:upper:]' '[:lower:]')"
[[ "$ACTIVE" == "blue" || "$ACTIVE" == "green" ]] || die "invalid active slot: $ACTIVE"

if [[ "$ACTIVE" == "blue" ]]; then
  INACTIVE="green"
else
  INACTIVE="blue"
fi

case "$INACTIVE" in
  blue) PORT=3010 PM2_NAME="bnab-blue" ;;
  green) PORT=3011 PM2_NAME="bnab-green" ;;
esac

case "$ACTIVE" in
  blue) PREVIOUS_PM2="bnab-blue" ;;
  green) PREVIOUS_PM2="bnab-green" ;;
esac

SLOT_DIR="${APP_ROOT}/${INACTIVE}"
APP_DIR="${SLOT_DIR}/bnab"
SHARED_ENV="${APP_ROOT}/shared/.env"
SHARED_DB="${APP_ROOT}/shared/bnab.db"

[[ -d "$SLOT_DIR/.git" ]] || die "not a git repo: $SLOT_DIR"
[[ -f "$SHARED_ENV" ]] || die "missing $SHARED_ENV"

log "active=$ACTIVE → deploy to inactive slot: $INACTIVE (port $PORT)"

git -C "$SLOT_DIR" fetch "$GIT_REMOTE"
git -C "$SLOT_DIR" checkout "$BRANCH"
git -C "$SLOT_DIR" reset --hard "${GIT_REMOTE}/${BRANCH}"

# Re-exec from the freshly updated slot copy so we never run a stale deploy-bnab.sh
# (common when invoking /opt/bnab/blue/... while blue is behind origin).
UPDATED_SCRIPT="${SLOT_DIR}/deploy/bnab/deploy-bnab.sh"
if [[ "${BNAB_DEPLOY_REEXEC:-}" != "1" && -f "$UPDATED_SCRIPT" ]]; then
  log "re-exec updated script from $INACTIVE ($(git -C "$SLOT_DIR" rev-parse --short HEAD))"
  export BNAB_DEPLOY_REEXEC=1
  exec bash "$UPDATED_SCRIPT"
fi

mkdir -p "${APP_ROOT}/shared"
touch "$SHARED_DB"
chmod 664 "$SHARED_DB" 2>/dev/null || true

ln -sfn "$SHARED_ENV" "${APP_DIR}/.env"

export DATABASE_URL="file:${SHARED_DB}"
cd "$APP_DIR"

log "clean node_modules (+ leftover caches)"
# ENOTEMPTY races are common under memory pressure; wipe aggressively with retries.
wipe_node_modules() {
  local i
  for i in 1 2 3; do
    rm -rf node_modules 2>/dev/null || true
    if [[ ! -e node_modules ]]; then
      return 0
    fi
    find node_modules -mindepth 1 -delete 2>/dev/null || true
    rmdir node_modules 2>/dev/null || rm -rf node_modules 2>/dev/null || true
    sleep 1
  done
  [[ ! -e node_modules ]] || die "could not remove node_modules"
}
wipe_node_modules
rm -f package-lock.json.bak

log "npm install (timestamps + heartbeat; status file for stuck checks)"
# Spinners look frozen over SSH. Emit timestamped lines + a heartbeat that tracks
# node_modules growth. Also write APP_DIR/.deploy-npm-status for `tail -f`.
npm_install_with_progress() {
  local hb_pid=""
  local start_ts status_file last_line_file
  start_ts="$(date +%s)"
  status_file="${APP_DIR}/.deploy-npm-status"
  last_line_file="${APP_DIR}/.deploy-npm-last-line"
  : >"$last_line_file"
  printf 'phase=starting elapsed=0s pkgs=0 size=0 last_line_age=0s\n' >"$status_file"
  log "progress: watch this file on the server → tail -f $status_file"
  log "progress: heartbeats every 10s; STALL warning if no npm line for 60s"

  (
    while true; do
      sleep 10
      now="$(date +%s)"
      elapsed=$((now - start_ts))
      dirs="$(find node_modules -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
      size="$(du -sh node_modules 2>/dev/null | awk '{print $1}')"
      last_ts="$(stat -c %Y "$last_line_file" 2>/dev/null || echo "$start_ts")"
      last_age=$((now - last_ts))
      if [[ "$last_age" -lt 0 ]]; then last_age=0; fi
      printf 'phase=installing elapsed=%ss pkgs=%s size=%s last_line_age=%ss updated=%s\n' \
        "$elapsed" "${dirs:-0}" "${size:-0}" "$last_age" "$(date -u +%H:%M:%S)" >"$status_file"
      printf '[deploy-bnab][heartbeat +%ss] pkgs=%s node_modules=%s last_npm_line=%ss_ago\n' \
        "$elapsed" "${dirs:-0}" "${size:-0}" "$last_age"
      if [[ "$last_age" -ge 60 ]]; then
        printf '[deploy-bnab][STALL?] no npm output for %ss — check network or kill stuck npm\n' "$last_age"
      fi
    done
  ) &
  hb_pid=$!

  # Disable ANSI progress spinner; force line-buffered readable output.
  local npm_bin=(npm)
  if command -v stdbuf >/dev/null 2>&1; then
    npm_bin=(stdbuf -oL -eL npm)
  fi

  # Low-RAM VPS: limit parallel fetches so install doesn't thrash swap into a silent hang.
  set +e
  NPM_CONFIG_PROGRESS=false \
  NPM_CONFIG_COLOR=false \
  NPM_CONFIG_MAXSOCKETS=3 \
  CI=true \
  NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=384" \
  "${npm_bin[@]}" install \
    --no-audit \
    --no-fund \
    --legacy-peer-deps \
    --loglevel info \
    --foreground-scripts \
    --timing \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=120000 \
    --maxsockets=3 \
    2>&1 | while IFS= read -r line || [[ -n "$line" ]]; do
      # Touch marker so heartbeat can detect silence.
      : >"$last_line_file"
      printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$line"
    done
  local npm_rc=${PIPESTATUS[0]}
  set -e

  kill "$hb_pid" 2>/dev/null || true
  wait "$hb_pid" 2>/dev/null || true

  if [[ "$npm_rc" -ne 0 ]]; then
    printf 'phase=failed elapsed=%ss\n' "$(( $(date +%s) - start_ts ))" >"$status_file"
    return "$npm_rc"
  fi
  printf 'phase=done elapsed=%ss\n' "$(( $(date +%s) - start_ts ))" >"$status_file"
  rm -f "$last_line_file"
  log "npm install finished in $(( $(date +%s) - start_ts ))s"
  return 0
}

if ! npm_install_with_progress; then
  log "npm install failed — wiping node_modules and retrying once"
  wipe_node_modules
  npm_install_with_progress || die "npm install failed after retry — if heartbeats stopped / STALL? appeared, install was stuck"
fi

log "prisma migrate deploy"
npx prisma migrate deploy

log "npm run build"
export NODE_ENV=production
npm run build

log "restart PM2: $PM2_NAME on port $PORT"
if command -v pm2 >/dev/null 2>&1; then
  PORT="$PORT" pm2 delete "$PM2_NAME" 2>/dev/null || true
  # Next.js reads PORT; keep cwd so `npm start` runs in APP_DIR.
  PORT="$PORT" NODE_ENV=production pm2 start npm --name "$PM2_NAME" --cwd "$APP_DIR" -- start
  pm2 save
else
  die "pm2 not found"
fi

log "health check http://127.0.0.1:${PORT}/"
code="000"
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  sleep 2
  code="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" 2>/dev/null || echo "000")"
  log "health attempt $i → HTTP $code"
  if [[ "$code" =~ ^(200|204|302|307|308)$ ]]; then
    break
  fi
done
if [[ ! "$code" =~ ^(200|204|302|307|308)$ ]]; then
  die "health check failed: HTTP $code"
fi

log "nginx upstream → $INACTIVE ($PORT)"
printf 'upstream bnab_app {\n    server 127.0.0.1:%s;\n}\n' "$PORT" >"$UPSTREAM_FILE"

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
