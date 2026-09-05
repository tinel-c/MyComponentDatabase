#!/usr/bin/env python3
"""Upload a local BNAB .next build tarball to the live VPS slot and restart PM2."""
from __future__ import annotations

import re
import sys
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
    print(f"\n>>> {cmd[:160]}", flush=True)
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=timeout)
    stdin.close()
    while True:
        raw = stdout.channel.recv(4096)
        if not raw:
            if stdout.channel.exit_status_ready():
                break
            continue
        sys.stdout.buffer.write(raw.decode("utf-8", errors="replace").encode("utf-8", errors="replace"))
        sys.stdout.flush()
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready():
            break
    return stdout.channel.recv_exit_status()


def main() -> None:
    root = Path(__file__).resolve().parent.parent.parent
    tarball = root / "bnab" / ".next-upload.tgz"
    if not tarball.is_file():
        print(f"missing {tarball}", file=sys.stderr)
        sys.exit(1)

    env = load_secrets(Path(__file__).resolve().parent.parent / "deploy.secrets")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=env["DEPLOY_HOST"],
        port=int(env.get("DEPLOY_SSH_PORT") or "22"),
        username=env["DEPLOY_USER"],
        password=env["DEPLOY_SSH_PASSWORD"],
        timeout=90,
        banner_timeout=90,
        auth_timeout=90,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        # Stop hung remote builds to free RAM
        run(
            client,
            "pkill -f 'next build' || true; pkill -f 'npm run build' || true; "
            "pkill -f 'tsc' || true; echo cleared_builds",
        )

        code = run(
            client,
            r"""set -euo pipefail
SLOT=$(tr -d '[:space:]' </opt/bnab/active_slot | tr '[:upper:]' '[:lower:]')
echo LIVE_SLOT=$SLOT
echo $SLOT > /tmp/bnab-live-slot
""",
        )
        if code != 0:
            sys.exit(code)

        # Read slot from a simple follow-up
        stdin, stdout, stderr = client.exec_command(
            "tr -d '[:space:]' </opt/bnab/active_slot", timeout=30
        )
        slot = stdout.read().decode().strip().lower()
        port = "3011" if slot == "green" else "3010"
        app = f"/opt/bnab/{slot}/bnab"
        pm2_app = f"bnab-{slot}"
        print(f"uploading to {app} (port {port})", flush=True)

        sftp = client.open_sftp()
        remote_tar = "/tmp/bnab-next-upload.tgz"
        size = tarball.stat().st_size
        print(f"sftp put {tarball.name} ({size / 1e6:.1f} MB) → {remote_tar}", flush=True)
        t0 = time.time()

        def progress(transferred: int, total: int) -> None:
            if transferred == total or transferred % (5 * 1024 * 1024) < 32768:
                pct = 100.0 * transferred / total if total else 0
                print(f"  upload {pct:.0f}% ({transferred / 1e6:.1f}/{total / 1e6:.1f} MB)", flush=True)

        sftp.put(str(tarball), remote_tar, callback=progress)
        sftp.close()
        print(f"upload done in {time.time() - t0:.1f}s", flush=True)

        code = run(
            client,
            f"""set -euo pipefail
APP={app}
PM2_APP={pm2_app}
PORT={port}
chown deploy:deploy /tmp/bnab-next-upload.tgz
sudo -u deploy bash -lc "
  set -euo pipefail
  cd '$APP'
  git fetch origin && git reset --hard origin/main
  rm -rf .next
  tar -xzf /tmp/bnab-next-upload.tgz
  test -f .next/BUILD_ID
  echo BUILD_ID=$(cat .next/BUILD_ID)
  set -a; . /opt/bnab/shared/.env; set +a
  export DATABASE_URL=file:/opt/bnab/shared/bnab.db
  npx prisma generate
"
rm -f /tmp/bnab-next-upload.tgz
sudo -u deploy -H bash -lc "
  cd '$APP'
  pm2 delete '$PM2_APP' >/dev/null 2>&1 || true
  PORT=$PORT NODE_ENV=production pm2 start ./node_modules/next/dist/bin/next --name '$PM2_APP' -- start --port $PORT
  pm2 save
"
sleep 2
curl -sI -o /dev/null -w 'local=%{{http_code}}\\n' --max-redirs 0 http://127.0.0.1:$PORT/ || true
curl -sI -o /dev/null -w 'vhost=%{{http_code}}\\n' --max-redirs 0 -H 'Host: bnab.bogza.ro' http://127.0.0.1/ || true
pm2 list | grep bnab || true
echo UPLOAD_OK
""",
            timeout=300,
        )
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
