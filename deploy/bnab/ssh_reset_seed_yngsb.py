#!/usr/bin/env python3
"""Wipe live BNAB data and reseed YNGSB categories + import rules."""
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
        time.sleep(0.1)
    if not stdout.channel.exit_status_ready():
        print("(timeout)", flush=True)
        return 1
    return stdout.channel.recv_exit_status()


def main() -> None:
    root = Path(__file__).resolve().parent.parent.parent
    bnab = root / "bnab"

    with tempfile.NamedTemporaryFile(suffix=".tgz", delete=False) as tmp:
        seed_tgz = Path(tmp.name)
    with tarfile.open(seed_tgz, "w:gz") as tar:
        tar.add(bnab / "prisma" / "seed.ts", arcname="prisma/seed.ts")
        tar.add(
            bnab / "src" / "lib" / "starter-categories.ts",
            arcname="src/lib/starter-categories.ts",
        )
        tar.add(
            bnab / "src" / "lib" / "ing-import" / "default-rules.ts",
            arcname="src/lib/ing-import/default-rules.ts",
        )
        # seed imports these
        for rel in (
            "src/lib/email.ts",
            "src/lib/money.ts",
        ):
            tar.add(bnab / rel, arcname=rel)

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
            "install -o deploy -g deploy -m 664 /dev/null /opt/bnab/shared/bnab-seed-upload.tgz",
        )
        sftp = client.open_sftp()
        sftp.put(str(seed_tgz), "/opt/bnab/shared/bnab-seed-upload.tgz")
        sftp.close()

        code = run(
            client,
            r"""set -euo pipefail
# Snapshot DB before wipe
TS=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p /opt/bnab/shared/snapshots
cp -a /opt/bnab/shared/bnab.db "/opt/bnab/shared/snapshots/pre-reset-${TS}.db" || true
chown deploy:deploy "/opt/bnab/shared/snapshots/pre-reset-${TS}.db" 2>/dev/null || true

sudo -u deploy -H bash -lc '
  set -euo pipefail
  cd /opt/bnab/green/bnab
  tar -xzf /opt/bnab/shared/bnab-seed-upload.tgz
  mkdir -p src/lib/ing-import
  set -a; . /opt/bnab/shared/.env; set +a
  export DATABASE_URL=file:/opt/bnab/shared/bnab.db
  export BNAB_RESET=1
  npx prisma db seed
'
rm -f /opt/bnab/shared/bnab-seed-upload.tgz
echo RESET_SEED_OK
""",
            timeout=300,
        )
        sys.exit(code)
    finally:
        client.close()
        seed_tgz.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
