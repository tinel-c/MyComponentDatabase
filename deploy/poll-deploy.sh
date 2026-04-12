#!/usr/bin/env bash
# Poll GitHub for new commits on main and deploy to production (blue-green) when ahead.
# Install on the VPS once:
#   sudo cp deploy/poll-deploy.sh /opt/warehouse/poll-deploy.sh
#   sudo chown deploy:deploy /opt/warehouse/poll-deploy.sh
#   sudo chmod 750 /opt/warehouse/poll-deploy.sh
#
# Cron (every 5 minutes as deploy):
#   crontab -e -u deploy
#   */5 * * * * /opt/warehouse/poll-deploy.sh >> /opt/warehouse/log/poll-deploy.log 2>&1
#
# Requires: same layout as setup-server.sh (/opt/warehouse/{blue,green,shared}, active_slot).

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/warehouse}"
BRANCH="${DEPLOY_BRANCH:-main}"
GIT_REMOTE="${DEPLOY_GIT_REMOTE:-origin}"
LOCK_FILE="${APP_ROOT}/.poll-deploy.lock"
LOG_DIR="${APP_ROOT}/log"

log() { printf '[poll-deploy] %s\n' "$*"; }

die() { printf '[poll-deploy] ERROR: %s\n' "$*" >&2; exit 1; }

for slot in blue green; do
  if [[ -d "${APP_ROOT}/${slot}/.git" ]]; then
    GIT_DIR="${APP_ROOT}/${slot}"
    break
  fi
done
[[ -n "${GIT_DIR:-}" ]] || die "no git clone under ${APP_ROOT}/blue or ${APP_ROOT}/green"

ACTIVE_FILE="${APP_ROOT}/active_slot"
[[ -f "$ACTIVE_FILE" ]] || die "missing $ACTIVE_FILE"

ACTIVE="$(tr -d '[:space:]' < "$ACTIVE_FILE" | tr '[:upper:]' '[:lower:]')"
[[ "$ACTIVE" == "blue" || "$ACTIVE" == "green" ]] || die "invalid active_slot: $ACTIVE"

mkdir -p "$LOG_DIR"

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  log "another run in progress, skip"
  exit 0
fi

git -C "$GIT_DIR" fetch "$GIT_REMOTE" "$BRANCH"

REMOTE_REF="${GIT_REMOTE}/${BRANCH}"
REMOTE_SHA="$(git -C "$GIT_DIR" rev-parse "$REMOTE_REF")"
LOCAL_SHA="$(git -C "${APP_ROOT}/${ACTIVE}" rev-parse HEAD)"

if [[ "$REMOTE_SHA" == "$LOCAL_SHA" ]]; then
  log "up to date ($REMOTE_SHA)"
  exit 0
fi

log "deploy: $LOCAL_SHA -> $REMOTE_SHA ($REMOTE_REF)"

TMP_DEPLOY="$(mktemp)"
trap 'rm -f "$TMP_DEPLOY"' EXIT
git -C "$GIT_DIR" show "${REMOTE_REF}:deploy/deploy.sh" >"$TMP_DEPLOY"
chmod 700 "$TMP_DEPLOY"

# Run latest deploy script from repo (same as GitHub Actions).
bash "$TMP_DEPLOY"

log "done"
