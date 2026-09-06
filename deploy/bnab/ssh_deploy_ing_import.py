#!/usr/bin/env python3
"""Deploy ING import: sync prisma migrations + .next, migrate DB, ensure snapshots dir, restart."""
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


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 400) -> int:
    print(f"\n>>> {cmd[:160]}", flush=True)
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
    next_tgz = root / "bnab" / ".next-upload.tgz"
    if not next_tgz.is_file():
        print(f"missing {next_tgz} — run: cd bnab && tar -czf .next-upload.tgz .next", file=sys.stderr)
        sys.exit(1)

    prisma_dir = root / "bnab" / "prisma"
    with tempfile.NamedTemporaryFile(suffix=".tgz", delete=False) as tmp:
        prisma_tgz = Path(tmp.name)
    with tarfile.open(prisma_tgz, "w:gz") as tar:
        tar.add(prisma_dir / "schema.prisma", arcname="schema.prisma")
        tar.add(
            prisma_dir / "migrations",
            arcname="migrations",
            filter=lambda ti: None if ti.name.endswith(".db") else ti,
        )

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
        run(
            client,
            "fuser -k 3011/tcp 2>/dev/null || true; "
            "sudo -u deploy -H bash -lc 'pm2 delete bnab-blue bnab-green >/dev/null 2>&1 || true'; "
            "chown -R deploy:deploy /opt/bnab/green /opt/bnab/shared; "
            "mkdir -p /opt/bnab/shared/snapshots && chown deploy:deploy /opt/bnab/shared/snapshots; "
            "install -o deploy -g deploy -m 664 /dev/null /opt/bnab/shared/bnab-next-upload.tgz; "
            "install -o deploy -g deploy -m 664 /dev/null /opt/bnab/shared/bnab-prisma-upload.tgz",
        )
        sftp = client.open_sftp()
        print(f"upload .next {next_tgz.stat().st_size/1e6:.1f} MB", flush=True)
        sftp.put(str(next_tgz), "/opt/bnab/shared/bnab-next-upload.tgz")
        print(f"upload prisma {prisma_tgz.stat().st_size/1e3:.1f} KB", flush=True)
        sftp.put(str(prisma_tgz), "/opt/bnab/shared/bnab-prisma-upload.tgz")
        sftp.close()

        code = run(
            client,
            r"""set -euo pipefail
APP=/opt/bnab/green/bnab
sudo -u deploy bash -lc '
  set -euo pipefail
  cd /opt/bnab/green/bnab
  rm -rf .next
  tar -xzf /opt/bnab/shared/bnab-next-upload.tgz
  test -f .next/BUILD_ID
  echo BUILD_ID=$(cat .next/BUILD_ID)
  mkdir -p prisma
  tar -xzf /opt/bnab/shared/bnab-prisma-upload.tgz -C prisma
  set -a; . /opt/bnab/shared/.env; set +a
  export DATABASE_URL=file:/opt/bnab/shared/bnab.db
  export BNAB_SNAPSHOT_DIR=/opt/bnab/shared/snapshots
  npx prisma generate
  npx prisma migrate deploy
  echo MIGRATE_OK
'
rm -f /opt/bnab/shared/bnab-next-upload.tgz /opt/bnab/shared/bnab-prisma-upload.tgz
chown -R deploy:deploy /opt/bnab/green/bnab/.next /opt/bnab/green/bnab/prisma
# Persist snapshot dir for the app
grep -q '^BNAB_SNAPSHOT_DIR=' /opt/bnab/shared/.env || echo 'BNAB_SNAPSHOT_DIR=/opt/bnab/shared/snapshots' >> /opt/bnab/shared/.env
sudo -u deploy -H bash -lc '
  cd /opt/bnab/green/bnab
  set -a; . /opt/bnab/shared/.env; set +a
  export DATABASE_URL=file:/opt/bnab/shared/bnab.db
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
curl -sS -o /dev/null -w "vhost=%{http_code}\n" --max-time 20 -H "Host: bnab.bogza.ro" http://127.0.0.1/more/import || true
echo DEPLOY_ING_OK
""",
            timeout=500,
        )
        sys.exit(code)
    finally:
        client.close()
        try:
            prisma_tgz.unlink(missing_ok=True)
        except Exception:
            pass


if __name__ == "__main__":
    main()
