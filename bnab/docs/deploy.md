# Deploy — bnab.bogza.ro

Parallel stack next to part-db. **Do not** reuse `/opt/warehouse` or `warehouse.db`.

## Layout

| Item | Value |
|------|-------|
| Domain | `bnab.bogza.ro` |
| App root | `/opt/bnab` |
| Shared | `/opt/bnab/shared` (`.env`, `bnab.db`, optional `snapshots/`) |
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
GEMINI_API_KEY="…"          # Google AI — receipt bill detailing
# GEMINI_MODEL="gemini-3.6-flash"
# BNAB_RECEIPT_DIR="/opt/bnab/shared/receipts"
```

You can copy Google client ID/secret from `/opt/warehouse/shared/.env`, but use a **new** `AUTH_SECRET` and `AUTH_URL` for BNAB. Add `GEMINI_API_KEY` for bill detailing (see [receipt-agent.md](./receipt-agent.md)).

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
npx prisma db seed
```

`setup-bnab-server.sh` clones blue/green under `/opt/bnab`, creates shared SQLite + `.env` template, and enables the nginx site (HTTP until certbot).

---

## Recommended: PC build → live upload (fast path)

On a **1 GB RAM** VPS, remote `next build` OOMs. Prefer building on your PC (or GitHub Actions) and uploading `.next`.

Requires local `deploy/deploy.secrets` (gitignored) with `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_PASSWORD`.

```powershell
# One command pipeline:
python deploy/bnab/bnab_deploy.py all

# Or step-by-step:
python deploy/bnab/bnab_deploy.py clean    # stop PM2, wipe green .next
python deploy/bnab/bnab_deploy.py build    # npm run build + .next-upload.tgz
python deploy/bnab/bnab_deploy.py upload   # extract + migrate + PM2
python deploy/bnab/bnab_deploy.py brand    # favicons / PWA / sw.js
python deploy/bnab/bnab_deploy.py status
```

### GitHub Actions

`Deploy BNAB` runs **after CI succeeds** on `main`: builds `.next` on the runner, SCPs the tarball, then on the VPS only extracts / migrates / restarts (no remote `next build`). Manual `workflow_dispatch` also works.

### What `ssh_upload_live_next.py` / upload step does

1. Stops BNAB PM2 processes on ports 3010/3011  
2. Uploads `.next-upload.tgz`  
3. On green: `git fetch` + `git reset --hard origin/main` (slot matches GitHub)  
4. Extracts `.next`  
5. **Overlays** local Prisma schema/migrations + key `src/lib` files (features ahead of `origin/main`)  
6. `prisma generate` + `migrate deploy`  
7. Syncs generated Prisma client into Next’s traced `.next/node_modules/@prisma/client-*` copy  
8. Starts `bnab-green` on **3011**, reloads nginx  

### Why overlays + Prisma sync

`git reset --hard origin/main` drops uncommitted server files. Until BNAB changes are on GitHub, the upload script restores schema/libs from your PC. After a release is pushed, overlays still keep Prisma generate aligned with the live schema.

If Plan 500s with `importCategoryRule` / `findMany` undefined, run:

```powershell
python ../deploy/bnab/ssh_resync_prisma.py
python ../deploy/bnab/ssh_sync_prisma_next_copy.py
python ../deploy/bnab/ssh_quick_restart_bnab.py
```

### Public brand assets

`.next` does **not** include `public/` favicons or `sw.js`. After upload (or after any `git reset` on the server), sync icons + service worker:

```powershell
python ../deploy/bnab/ssh_upload_public_brand.py
```

### Android install / PWA

- Manifest: `/manifest.webmanifest` (standalone, maskable icons, `start_url=/plan?source=pwa`)
- Service worker: `/sw.js` (caches `/_next/static` + icons)
- In-app **Install on Android** banner + **More** install card

### YNGSB reset / reseed (destructive)

```powershell
# Sets BNAB_RESET=1 style wipe + seed — only when you intend to reset household data
python ../deploy/bnab/ssh_reset_seed_yngsb.py
```

---

## Ongoing deploy (full remote build)

**GitHub Actions:** push to `main` that touches `bnab/**` or `deploy/bnab/**` runs [`.github/workflows/deploy-bnab.yml`](../../.github/workflows/deploy-bnab.yml).

**Manual** on the VPS:

```bash
bash /opt/bnab/blue/deploy/bnab/deploy-bnab.sh
```

`deploy-bnab.sh` updates the **inactive** slot, `npm install`, `prisma migrate deploy`, `npm run build`, switches nginx upstream, stops the previous PM2 process.

On a **1 GB RAM** VPS prefer the PC-build path above.

## CI

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) job **bnab**: migrate, unit tests, production build.

## Checklist

1. DNS resolves for `bnab.bogza.ro`
2. Certbot TLS
3. Google redirect URI added
4. `/opt/bnab/shared/.env` filled (separate `bnab.db`)
5. First deploy + optional `prisma db seed`
6. Smoke: login → Plan → add / import transaction → Reflect
7. Invite partner under **More → Team**
8. After PC upload: confirm `/favicon.ico` and `/icon-192.png` return 200
