# Agent deploy playbook — BNAB (bnab.bogza.ro)

Zero-downtime blue/green: keep the live slot up, promote the **inactive** slot, then cut nginx over.

## Prerequisites

- Repo root with `deploy/deploy.secrets` (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_PASSWORD`)
- Network access to the VPS
- Prefer pushing commits to `main` before promote (server does `git reset --hard origin/main` on the inactive slot; overlays restore local prisma/libs)

## One command

```powershell
python deploy/bnab/bnab_deploy.py all
```

This runs: **build** (local, site stays up) → **upload/promote inactive** → **status**.

## Do not

- Kill both PM2 apps or `fuser` both ports before build
- Force green-only deploys
- Run the old “clean then build” downtime path

## Optional steps

```powershell
python deploy/bnab/bnab_deploy.py status   # active slot, health, public HTTP
python deploy/bnab/bnab_deploy.py build   # npm run build + .next-upload.tgz
python deploy/bnab/bnab_deploy.py upload  # promote inactive only
python deploy/bnab/bnab_deploy.py clean   # wipe inactive .next only (live stays up)
python deploy/bnab/bnab_deploy.py brand   # public assets to current active (upload already includes brand)
```

## Rollback

Previous PM2 app is **stopped**, not deleted. Flip upstream back:

```bash
# on VPS — example: roll back to blue (3010)
printf 'upstream bnab_app {\n    server 127.0.0.1:3010;\n}\n' > /opt/bnab/nginx-active-upstream.conf
echo blue > /opt/bnab/active_slot
sudo -u deploy -H bash -lc 'pm2 start bnab-blue'   # or restart if already known
sudo nginx -t && sudo systemctl reload nginx
```

## Success signals

- During local build, `https://bnab.bogza.ro/` stays HTTP 200
- Upload logs show `active=… → promote inactive=…` and `PROMOTE_OK`
- `active_slot` flips; public site 200
