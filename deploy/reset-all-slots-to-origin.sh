#!/usr/bin/env bash
# One-time or emergency: reset BOTH blue/green deploy slots to match GitHub (discards local edits on the VPS).
# Run on the server as the same user used for deploy (e.g. deploy), from your laptop:
#   ssh -p "${DEPLOY_SSH_PORT:-22}" "${DEPLOY_USER}@${DEPLOY_HOST}" 'bash -s' < deploy/reset-all-slots-to-origin.sh
# Or copy this file to the server and: bash reset-all-slots-to-origin.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/warehouse}"
BRANCH="${DEPLOY_BRANCH:-main}"
GIT_REMOTE="${DEPLOY_GIT_REMOTE:-origin}"

log() { printf '[reset-slots] %s\n' "$*"; }

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

for slot in blue green; do
  dir="${APP_ROOT}/${slot}"
  if [[ ! -d "${dir}/.git" ]]; then
    log "skip ${slot}: not a git repo (${dir})"
    continue
  fi
  log "${slot}: fetch ${GIT_REMOTE} && checkout ${BRANCH} && reset --hard ${GIT_REMOTE}/${BRANCH}"
  git -C "$dir" fetch "$GIT_REMOTE"
  git -C "$dir" checkout "$BRANCH"
  git -C "$dir" reset --hard "${GIT_REMOTE}/${BRANCH}"
  log "${slot}: now at $(git -C "$dir" rev-parse --short HEAD)"
done

log "done — both slots match ${GIT_REMOTE}/${BRANCH}; run your normal GitHub deploy or npm run build in web/ if needed."
