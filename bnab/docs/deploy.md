# Deploy — bnab.bogza.ro

Parallel stack next to part-db. **Do not** reuse `/opt/warehouse` or `warehouse.db`.

## Layout

| Item | Value |
|------|-------|
| Domain | `bnab.bogza.ro` |
| App root | `/opt/bnab` |
| Shared | `/opt/bnab/shared` (`.env`, `bnab.db`) |
| Blue/green ports | `3010` / `3011` |
| PM2 names | `bnab-blue` / `bnab-green` |
| nginx site | `/etc/nginx/sites-available/bnab` |
| App subdirectory | `bnab/` (sibling to `web/`) |

## DNS

Add an A/AAAA record for `bnab.bogza.ro` → same VPS as part-db.

## Google OAuth

Add authorized redirect URI (same Google client as part-db is fine):

```
https://bnab.bogza.ro/api/auth/callback/google
```

Local:

```
http://localhost:3010/api/auth/callback/google
```

## Shared `.env` (`/opt/bnab/shared/.env`)

```
DATABASE_URL="file:/opt/bnab/shared/bnab.db"
AUTH_SECRET="…"   # openssl rand -base64 32
AUTH_URL="https://bnab.bogza.ro"
AUTH_GOOGLE_ID="…"
AUTH_GOOGLE_SECRET="…"
ADMIN_EMAIL="you@example.com"
```

You can copy Google client ID/secret from `/opt/warehouse/shared/.env`, but use a **new** `AUTH_SECRET` and `AUTH_URL` for BNAB.

## Bootstrap (once)

From a machine with the repo (or after cloning on the VPS):

```bash
# On the server as root — pass the same GitHub repo URL used for warehouse
sudo bash deploy/bnab/setup-bnab-server.sh --repo https://github.com/tinel-c/MyComponentDatabase.git

# Edit secrets
sudo -u deploy nano /opt/bnab/shared/.env

# TLS (after DNS points here)
sudo certbot --nginx -d bnab.bogza.ro

# First deploy as deploy user
sudo -u deploy bash /opt/bnab/blue/deploy/bnab/deploy-bnab.sh

# Seed admin + starter budget (once)
cd /opt/bnab/blue/bnab   # or the active slot
export DATABASE_URL="file:/opt/bnab/shared/bnab.db"
# load AUTH_* from shared .env if needed for seed ADMIN_EMAIL
npx prisma db seed
```

`setup-bnab-server.sh` clones blue/green under `/opt/bnab`, creates shared SQLite + `.env` template, and enables the nginx site (HTTP until certbot).

## Ongoing deploy

**GitHub Actions:** push to `main` that touches `bnab/**` or `deploy/bnab/**` runs [`.github/workflows/deploy-bnab.yml`](../../.github/workflows/deploy-bnab.yml) (reuses `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_PASSWORD`).

**Manual** (from PC, with `deploy/deploy.secrets` loaded):

```bash
sshpass -e ssh … "${DEPLOY_USER}@${DEPLOY_HOST}" 'bash -s' < deploy/bnab/deploy-bnab.sh
```

Or on the VPS:

```bash
bash /opt/bnab/blue/deploy/bnab/deploy-bnab.sh
```

`deploy-bnab.sh` updates the **inactive** slot, runs a **verbose** `npm install` (timestamped lines + heartbeat every 15s showing `node_modules` growth), `prisma migrate deploy`, `npm run build`, switches nginx upstream (ports 3010/3011), stops the previous PM2 process.

If heartbeats freeze (same pkg count for several minutes), install is stuck — kill `npm` and retry after `rm -rf node_modules`.

## CI

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) job **bnab**: migrate, unit tests (`budget-engine`), production build.

## Checklist

1. DNS resolves for `bnab.bogza.ro`
2. Certbot TLS
3. Google redirect URI added
4. `/opt/bnab/shared/.env` filled (separate `bnab.db`)
5. First `deploy-bnab.sh` + optional `prisma db seed`
6. Smoke: login → Plan → add transaction → Reflect
7. Invite partner under **More → Team**
