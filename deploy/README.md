# VPS deployment (blue / green)

This folder contains scripts and config for deploying the Next.js app under `/opt/warehouse` on your VPS. Non-sensitive defaults live in `deploy.config.yml`. **Secrets never belong in git.**

## Secret locations

| Place | Purpose |
|--------|---------|
| **GitHub → Settings → Secrets and variables → Actions** | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_PASSWORD`, optional `DEPLOY_SSH_PORT`. Used by the **Deploy** workflow (SSH + `deploy.sh`). |
| **`deploy/deploy.secrets` (local, gitignored)** | Same names as above, plus production app env (`AUTH_*`, etc.) for your own use when SSH-ing or copying to the server. **Do not commit this file.** Create it by copying `deploy.secrets.example` and filling in values. |
| **`deploy/.env.deploy` (optional, gitignored)** | Mentioned in `deploy.secrets.example` as another local-only place some teams use for deploy-related env vars. |

If `deploy/deploy.secrets` is missing from the repo, that is intentional: it is listed in `.gitignore`.

## How deploy works

1. **CI** (`.github/workflows/ci.yml`) runs on GitHub: `npm ci`, Prisma migrate, lint, `npm run build` on `ubuntu-latest`. This validates the same tree as `main`.
2. **Deploy** (`.github/workflows/deploy.yml`) runs after CI succeeds on `main`. It SSHs to the VPS and runs `deploy/deploy.sh` on the server.
3. On the VPS, `deploy.sh` updates the **inactive** slot (`blue` or `green`), runs `npm ci`, `prisma migrate deploy`, `npm run build`, switches nginx/PM2. It uses **`git fetch` + `git reset --hard origin/main`** so the slot matches GitHub and **local edits on the server cannot persist** across deploys.

Logs from `npm run build` in **Deploy** are from the **VPS**, not from GitHub’s runner. If only the Deploy workflow fails with a Turbopack error, the checkout on the server was wrong or dirty before `reset --hard` was added; see [Emergency: reset both slots](#emergency-reset-both-git-slots-on-the-vps).

## One-time server setup

Use `setup-server.sh` and nginx samples as documented in comments inside those files. Paths and ports match `deploy.config.yml` (`/opt/warehouse`, blue `3000`, green `3001`).

## Emergency: reset both git slots on the VPS

Use this if a slot still has **dirty** tracked files (e.g. `git status` shows `M web/src/lib/sync/auth.ts`) or a broken local edit that never existed on GitHub. This discards **all** uncommitted changes in `/opt/warehouse/blue` and `/opt/warehouse/green`.

### Option A — from your PC, repo root (recommended)

1. Ensure `deploy/deploy.secrets` exists (copy from `deploy.secrets.example`) and contains at least `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_PASSWORD`, and optionally `DEPLOY_SSH_PORT`.

2. Load the SSH variables and run the reset script over SSH (same idea as CI: `sshpass` + password):

   **PowerShell (Windows)** — set env vars from your secrets file manually or use WSL/Git Bash for the `export` variant below.

   **Bash (Linux, macOS, Git Bash, WSL):**

   ```bash
   cd /path/to/MyComponentDatabase

   # Load ONLY deploy SSH vars from your local gitignored file (adjust path if needed).
   set -a
   # shellcheck disable=SC1091
   source deploy/deploy.secrets
   set +a

   export SSHPASS="$DEPLOY_SSH_PASSWORD"
   PORT="${DEPLOY_SSH_PORT:-22}"

   sshpass -e ssh -o StrictHostKeyChecking=accept-new \
     -p "$PORT" \
     -o PreferredAuthentications=password \
     -o PubkeyAuthentication=no \
     "${DEPLOY_USER}@${DEPLOY_HOST}" \
     'bash -s' < deploy/reset-all-slots-to-origin.sh
   ```

   `sshpass` must be installed (e.g. `sudo apt install sshpass`, or use Chocolatey/WSL on Windows).

3. Push to `main` or re-run the **Deploy** workflow so `deploy.sh` runs a full build on the cleaned slot.

### Option B — interactive SSH

1. Connect using values from `deploy/deploy.secrets`:

   ```bash
   ssh -p "${DEPLOY_SSH_PORT:-22}" "${DEPLOY_USER}@${DEPLOY_HOST}"
   ```

2. On the server:

   ```bash
   for s in blue green; do
     d=/opt/warehouse/$s
     if [ -d "$d/.git" ]; then
       git -C "$d" fetch origin
       git -C "$d" checkout main
       git -C "$d" reset --hard origin/main
       echo "$s: $(git -C "$d" rev-parse --short HEAD)"
     fi
   done
   ```

### Option C — pipe script without `sshpass`

If you use SSH keys and normal `ssh` works without a password:

```bash
ssh -p "${DEPLOY_SSH_PORT:-22}" "${DEPLOY_USER}@${DEPLOY_HOST}" 'bash -s' < deploy/reset-all-slots-to-origin.sh
```

## Files in this directory

| File | Role |
|------|------|
| `deploy.sh` | Blue-green deploy on the VPS (called by GitHub Actions over SSH). |
| `reset-all-slots-to-origin.sh` | Emergency reset of both slots to `origin/main`. |
| `setup-server.sh` | Initial server layout. |
| `deploy.config.yml` | Non-sensitive host/paths/ports/repo URL. |
| `deploy.secrets.example` | Template for GitHub Secrets and local `deploy.secrets`. |
| `deploy.secrets` | **Local only** — real credentials; gitignored. |

## GitHub Actions

- Required repository secrets match the names in `deploy.secrets.example`.
- **CI** should be the required check for merges; **Deploy** can still fail for SSH or server-only issues while CI stays green.
