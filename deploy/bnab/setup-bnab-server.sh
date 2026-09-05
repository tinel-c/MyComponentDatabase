#!/usr/bin/env bash
# One-time BNAB bootstrap on a VPS that already has Node/nginx/pm2 (or installs them).
# Usage: sudo bash deploy/bnab/setup-bnab-server.sh --repo https://github.com/ORG/MyComponentDatabase.git
set -euo pipefail

REPO=""
BRANCH="main"
NODE_MAJOR="20"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: sudo bash setup-bnab-server.sh --repo <git clone URL> [--branch main]"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

[[ -n "$REPO" ]] || { echo "ERROR: --repo is required" >&2; exit 1; }
[[ "$(id -u)" -eq 0 ]] || { echo "ERROR: run as root (sudo)" >&2; exit 1; }

log() { printf '[setup-bnab] %s\n' "$*"; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git nginx

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]]; then
  log "install Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

if ! id deploy >/dev/null 2>&1; then
  useradd -m -s /bin/bash deploy
  mkdir -p /home/deploy/.ssh
  chmod 700 /home/deploy/.ssh
  chown -R deploy:deploy /home/deploy/.ssh
fi

APP_ROOT="/opt/bnab"
mkdir -p "${APP_ROOT}/shared"
chown -R deploy:deploy "${APP_ROOT}"

if [[ ! -f /etc/sudoers.d/deploy-nginx ]]; then
  cat >/etc/sudoers.d/deploy-nginx <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /bin/systemctl reload nginx
EOF
  chmod 440 /etc/sudoers.d/deploy-nginx
fi

log "clone repository into blue and green slots"
sudo -u deploy env APP_ROOT="$APP_ROOT" REPO="$REPO" BRANCH="$BRANCH" bash <<'DEPLOY_CLONE'
set -euo pipefail
for slot in blue green; do
  target="${APP_ROOT}/${slot}"
  if [[ ! -d "${target}/.git" ]]; then
    git clone "$REPO" "$target"
    git -C "$target" checkout "$BRANCH"
  else
    git -C "$target" fetch origin
    git -C "$target" checkout "$BRANCH"
    git -C "$target" pull --ff-only origin "$BRANCH"
  fi
  git config --global --add safe.directory "$target" || true
done
DEPLOY_CLONE

SHARED_ENV="${APP_ROOT}/shared/.env"
SHARED_DB="${APP_ROOT}/shared/bnab.db"
touch "$SHARED_DB"
chown deploy:deploy "$SHARED_DB"

if [[ ! -f "$SHARED_ENV" ]]; then
  log "create ${SHARED_ENV}"
  install -m 640 /dev/null "$SHARED_ENV"
  chown deploy:deploy "$SHARED_ENV"
  sudo -u deploy bash -c "cat >> '$SHARED_ENV'" <<'ENVFILE'
DATABASE_URL="file:/opt/bnab/shared/bnab.db"
AUTH_SECRET="CHANGE_ME_generate_with_openssl_rand_base64_32"
AUTH_URL="https://bnab.bogza.ro"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
ADMIN_EMAIL="tinel.c@gmail.com"
ENVFILE
fi

echo "blue" >"${APP_ROOT}/active_slot"
chown deploy:deploy "${APP_ROOT}/active_slot"
printf 'upstream bnab_app {\n    server 127.0.0.1:3010;\n}\n' >"${APP_ROOT}/nginx-active-upstream.conf"
chown deploy:deploy "${APP_ROOT}/nginx-active-upstream.conf"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install -m 644 "${SCRIPT_DIR}/nginx-site.conf" /etc/nginx/sites-available/bnab
ln -sfn /etc/nginx/sites-available/bnab /etc/nginx/sites-enabled/bnab
nginx -t
systemctl reload nginx

log "BNAB bootstrap done."
log "1. Edit ${SHARED_ENV}"
log "2. Add Google redirect https://bnab.bogza.ro/api/auth/callback/google"
log "3. certbot --nginx -d bnab.bogza.ro"
log "4. As deploy: bash ${APP_ROOT}/blue/deploy/bnab/deploy-bnab.sh"
