#!/usr/bin/env bash
# One-time bootstrap for Ubuntu 24.04 (run as root on a fresh VPS).
# Usage:
#   sudo bash deploy/setup-server.sh --repo https://github.com/ORG/MyComponentDatabase.git
# Optional: --branch main
#
# After this script:
#   1. Edit /opt/warehouse/shared/.env (AUTH_*, DATABASE_URL is already set for shared SQLite).
#   2. Ensure SSH password auth is allowed for the deploy user (sshd PasswordAuthentication),
#      set the deploy user's password, and store it in GitHub Secret DEPLOY_SSH_PASSWORD.
#   3. Push to main — GitHub Actions runs deploy/deploy.sh over SSH (sshpass).

set -euo pipefail

REPO=""
BRANCH="main"
NODE_MAJOR="20"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: sudo bash setup-server.sh --repo <git clone URL> [--branch main]"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

[[ -n "$REPO" ]] || { echo "ERROR: --repo is required" >&2; exit 1; }
[[ "$(id -u)" -eq 0 ]] || { echo "ERROR: run as root (sudo)" >&2; exit 1; }

log() { printf '[setup] %s\n' "$*"; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git nginx ufw

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]]; then
  log "install Node.js ${NODE_MAJOR}.x (NodeSource)"
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

ufw allow OpenSSH
ufw allow 'Nginx HTTP'
# ufw allow 'Nginx HTTPS'  # enable after certbot
ufw --force enable || true

APP_ROOT="/opt/warehouse"
mkdir -p "${APP_ROOT}/shared"
chown -R deploy:deploy "${APP_ROOT}"

cat >/etc/sudoers.d/deploy-nginx <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /bin/systemctl reload nginx
EOF
chmod 440 /etc/sudoers.d/deploy-nginx

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
SHARED_DB="${APP_ROOT}/shared/warehouse.db"

if [[ ! -f "$SHARED_ENV" ]]; then
  log "create ${SHARED_ENV} — edit AUTH_* and Google OAuth after setup"
  install -m 640 /dev/null "$SHARED_ENV"
  chown deploy:deploy "$SHARED_ENV"
  sudo -u deploy bash -c "cat >> '$SHARED_ENV'" <<'ENVFILE'
# Production — update AUTH_* and Google OAuth
DATABASE_URL="file:/opt/warehouse/shared/warehouse.db"
AUTH_SECRET="CHANGE_ME_generate_with_openssl_rand_base64_32"
AUTH_URL="https://part-db.bogza.ro"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
ADMIN_EMAIL=""
ENVFILE
fi

touch "$SHARED_DB"
chown deploy:deploy "$SHARED_DB"
chmod 664 "$SHARED_DB"

log "symlink web/.env → shared/.env"
sudo -u deploy bash <<'SYMLINK'
set -euo pipefail
for slot in blue green; do
  ln -sfn ../../shared/.env "/opt/warehouse/${slot}/web/.env"
done
SYMLINK

log "initial Prisma migrate + build blue slot only"
sudo -u deploy bash <<INITIAL
set -euo pipefail
export DATABASE_URL="file:${SHARED_DB}"
cd "${APP_ROOT}/blue/web"
npm ci --no-audit --no-fund
npx prisma migrate deploy
export NODE_ENV=production
npm run build
INITIAL

log "PM2 start blue on port 3000"
sudo -u deploy bash <<'PM2BLUE'
set -euo pipefail
cd /opt/warehouse/blue/web
PORT=3000 NODE_ENV=production pm2 delete warehouse-blue 2>/dev/null || true
PORT=3000 NODE_ENV=production pm2 start npm --name warehouse-blue -- start
pm2 save
PM2BLUE

echo "blue" >"${APP_ROOT}/active_slot"
chown deploy:deploy "${APP_ROOT}/active_slot"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/nginx-active-upstream.conf.example" ]]; then
  cp "${SCRIPT_DIR}/nginx-active-upstream.conf.example" "${APP_ROOT}/nginx-active-upstream.conf"
  chown deploy:deploy "${APP_ROOT}/nginx-active-upstream.conf"
  chmod 644 "${APP_ROOT}/nginx-active-upstream.conf"
fi

log "install nginx site"
cp "${SCRIPT_DIR}/nginx-site.conf" /etc/nginx/sites-available/warehouse
ln -sf /etc/nginx/sites-available/warehouse /etc/nginx/sites-enabled/warehouse
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

log "PM2 systemd startup (run the printed command if needed)"
sudo -u deploy env PATH="$PATH" pm2 startup systemd -u deploy --hp /home/deploy || true

log "done."
log "Next: edit $SHARED_ENV, set real AUTH_SECRET and Google keys."
log "Then: set DEPLOY_SSH_PASSWORD (and DEPLOY_HOST, DEPLOY_USER) in GitHub Actions secrets and push to main."
