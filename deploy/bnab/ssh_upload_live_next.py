#!/usr/bin/env python3
"""Upload local .next to green (live) BNAB slot with ownership fixes."""
from __future__ import annotations

import re
import sys
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko


def load_secrets(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if not m:
            continue
        k, v = m.group(1), m.group(2).strip()
        if len(v) >= 2 and v[0] == v[-1] == '"':
            v = v[1:-1]
        env[k] = v
    return env


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 300) -> int:
    print(f"\n>>> {cmd[:140]}", flush=True)
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=timeout)
    stdin.close()
    end = time.time() + timeout
    while time.time() < end:
        if stdout.channel.recv_ready():
            raw = stdout.channel.recv(4096)
            if raw:
                sys.stdout.buffer.write(raw.decode("utf-8", errors="replace").encode())
                sys.stdout.flush()
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready():
            break
        time.sleep(0.12)
    if not stdout.channel.exit_status_ready():
        print("(timeout)", flush=True)
        return 1
    return stdout.channel.recv_exit_status()


def main() -> None:
    root = Path(__file__).resolve().parent.parent.parent
    tarball = root / "bnab" / ".next-upload.tgz"
    if not tarball.is_file():
        print(f"missing {tarball}", file=sys.stderr)
        sys.exit(1)

    # Keep Prisma models that are not on origin/main yet (git reset would wipe them).
    schema_files = [
        root / "bnab" / "prisma" / "schema.prisma",
        root / "bnab" / "prisma" / "seed.ts",
    ]
    migrations_dir = root / "bnab" / "prisma" / "migrations"
    overlay_libs = [
        root / "bnab" / "src" / "lib" / "plan-data.ts",
        root / "bnab" / "src" / "lib" / "money.ts",
        root / "bnab" / "src" / "lib" / "yngsb-banner.ts",
        root / "bnab" / "src" / "lib" / "starter-categories.ts",
        root / "bnab" / "src" / "lib" / "email.ts",
        root / "bnab" / "src" / "lib" / "ing-import" / "default-rules.ts",
        root / "bnab" / "src" / "lib" / "budget-engine" / "index.ts",
        root / "bnab" / "src" / "lib" / "receipt-ai",
    ]

    env = load_secrets(Path(__file__).resolve().parent.parent / "deploy.secrets")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=env["DEPLOY_HOST"],
        port=int(env.get("DEPLOY_SSH_PORT") or "22"),
        username=env["DEPLOY_USER"],
        password=env["DEPLOY_SSH_PASSWORD"],
        timeout=90,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        # Stop the app first so it cannot recreate a root-owned .next during extract.
        run(
            client,
            "fuser -k 3011/tcp 2>/dev/null || true; "
            "fuser -k 3010/tcp 2>/dev/null || true; "
            "sudo -u deploy -H bash -lc 'pm2 delete bnab-blue bnab-green >/dev/null 2>&1 || true'; "
            "chown -R deploy:deploy /opt/bnab/green /opt/bnab/shared; "
            "rm -rf /opt/bnab/green/bnab/.next; "
            "install -o deploy -g deploy -m 664 /dev/null /opt/bnab/shared/bnab-next-upload.tgz",
        )
        sftp = client.open_sftp()
        print(f"upload {tarball.stat().st_size/1e6:.1f} MB", flush=True)
        sftp.put(str(tarball), "/opt/bnab/shared/bnab-next-upload.tgz")

        # Overlay schema + key libs after git reset (before prisma generate).
        for local in schema_files:
            remote = f"/opt/bnab/shared/overlay/{local.name}"
            run(
                client,
                f"mkdir -p /opt/bnab/shared/overlay && "
                f"install -o deploy -g deploy -m 664 /dev/null {remote}",
            )
            sftp.put(str(local), remote)
        with tempfile.NamedTemporaryFile(suffix=".tgz", delete=False) as tmp:
            overlay_tgz = Path(tmp.name)
        with tarfile.open(overlay_tgz, "w:gz") as tar:
            tar.add(migrations_dir, arcname="prisma/migrations")
            for lib in overlay_libs:
                if lib.is_file():
                    rel = lib.relative_to(root / "bnab").as_posix()
                    tar.add(lib, arcname=rel)
                elif lib.is_dir():
                    rel = lib.relative_to(root / "bnab").as_posix()
                    tar.add(lib, arcname=rel)
        run(
            client,
            "install -o deploy -g deploy -m 664 /dev/null /opt/bnab/shared/bnab-overlay.tgz",
        )
        sftp.put(str(overlay_tgz), "/opt/bnab/shared/bnab-overlay.tgz")
        sftp.close()
        overlay_tgz.unlink(missing_ok=True)

        code = run(
            client,
            r"""set -euo pipefail
APP=/opt/bnab/green/bnab
sudo -u deploy bash -lc '
  set -euo pipefail
  cd /opt/bnab/green/bnab
  git fetch origin && git reset --hard origin/main || true
  rm -rf .next
  tar -xzf /opt/bnab/shared/bnab-next-upload.tgz
  test -f .next/BUILD_ID
  echo BUILD_ID=$(cat .next/BUILD_ID)
  # Restore Prisma schema / migrations / libs that are ahead of origin/main
  cp -f /opt/bnab/shared/overlay/schema.prisma prisma/schema.prisma
  cp -f /opt/bnab/shared/overlay/seed.ts prisma/seed.ts
  tar -xzf /opt/bnab/shared/bnab-overlay.tgz
  set -a; . /opt/bnab/shared/.env; set +a
  export DATABASE_URL=file:/opt/bnab/shared/bnab.db
  npx prisma generate
  npx prisma migrate deploy
  node -e "const {PrismaClient}=require(\"@prisma/client\"); const p=new PrismaClient(); if(!p.importCategoryRule){console.error(\"MISSING importCategoryRule\"); process.exit(1)}; console.log(\"PRISMA_OK\")"
  # Next vendors a hashed client copy — keep it aligned with generate
  shopt -s nullglob
  for d in .next/node_modules/@prisma/client-*; do
    echo "sync $d"
    rm -rf "$d"
    mkdir -p "$d"
    cp -a node_modules/@prisma/client/. "$d/"
  done
'
rm -f /opt/bnab/shared/bnab-next-upload.tgz /opt/bnab/shared/bnab-overlay.tgz
rm -rf /opt/bnab/shared/overlay
chown -R deploy:deploy /opt/bnab/green/bnab/.next
sudo -u deploy -H bash -lc '
  cd /opt/bnab/green/bnab
  pm2 delete bnab-blue bnab-green >/dev/null 2>&1 || true
  PORT=3011 NODE_ENV=production pm2 start ./node_modules/next/dist/bin/next --name bnab-green -- start --port 3011
  pm2 save
'
printf "upstream bnab_app {\n    server 127.0.0.1:3011;\n}\n" > /opt/bnab/nginx-active-upstream.conf
echo green > /opt/bnab/active_slot
chown deploy:deploy /opt/bnab/nginx-active-upstream.conf /opt/bnab/active_slot
sudo nginx -t && sudo systemctl reload nginx || true
sleep 3
curl -sS -o /dev/null -w "local=%{http_code}\n" --max-time 20 http://127.0.0.1:3011/
echo UPLOAD_OK
""",
            timeout=400,
        )
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
