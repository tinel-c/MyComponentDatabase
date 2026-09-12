#!/usr/bin/env python3
"""
Zero-downtime BNAB promote: upload local .next to the INACTIVE blue/green slot,
health-check it, then cut nginx over. The active slot stays up during build/upload.
"""
from __future__ import annotations

import re
import sys
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko

DEPLOY_DIR = Path(__file__).resolve().parent
ROOT = DEPLOY_DIR.parent.parent
PROMOTE_SCRIPT = DEPLOY_DIR / "remote-promote-inactive.sh"


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
        time.sleep(0.12)
    if not stdout.channel.exit_status_ready():
        print("(timeout)", flush=True)
        return 1
    return stdout.channel.recv_exit_status()


def pack_brand_tarball(root: Path) -> Path | None:
    pub = root / "bnab" / "public"
    files = [
        "favicon.ico",
        "favicon-16.png",
        "favicon-32.png",
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
        "icon-192-maskable.png",
        "icon-512-maskable.png",
        "apple-touch-icon.png",
        "manifest.webmanifest",
        "sw.js",
        "brand/mark.svg",
        "brand/icon-master.png",
        "brand/logo-lockup.png",
        "brand/favicon-16.png",
        "brand/favicon-32.png",
    ]
    with tempfile.NamedTemporaryFile(suffix=".tgz", delete=False) as tmp:
        tgz = Path(tmp.name)
    count = 0
    with tarfile.open(tgz, "w:gz") as tar:
        for rel in files:
            path = pub / rel
            if path.is_file():
                tar.add(path, arcname=rel)
                count += 1
    if count == 0:
        tgz.unlink(missing_ok=True)
        return None
    return tgz


def main() -> None:
    t0 = time.time()
    tarball = ROOT / "bnab" / ".next-upload.tgz"
    if not tarball.is_file():
        print(f"missing {tarball}", file=sys.stderr)
        sys.exit(1)
    if not PROMOTE_SCRIPT.is_file():
        print(f"missing {PROMOTE_SCRIPT}", file=sys.stderr)
        sys.exit(1)

    schema_files = [
        ROOT / "bnab" / "prisma" / "schema.prisma",
        ROOT / "bnab" / "prisma" / "seed.ts",
    ]
    migrations_dir = ROOT / "bnab" / "prisma" / "migrations"
    overlay_libs = [
        ROOT / "bnab" / "src" / "lib" / "plan-data.ts",
        ROOT / "bnab" / "src" / "lib" / "money.ts",
        ROOT / "bnab" / "src" / "lib" / "yngsb-banner.ts",
        ROOT / "bnab" / "src" / "lib" / "starter-categories.ts",
        ROOT / "bnab" / "src" / "lib" / "email.ts",
        ROOT / "bnab" / "src" / "lib" / "ing-import" / "default-rules.ts",
        ROOT / "bnab" / "src" / "lib" / "budget-engine" / "index.ts",
        ROOT / "bnab" / "src" / "lib" / "receipt-ai",
    ]

    env = load_secrets(DEPLOY_DIR.parent / "deploy.secrets")
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
        # Show current active — do NOT kill it
        run(
            client,
            "echo -n 'active_slot='; cat /opt/bnab/active_slot; "
            "echo; curl -sS -o /dev/null -w 'live_local=%{http_code}\\n' --max-time 10 "
            "$(python3 -c \"s=open('/opt/bnab/active_slot').read().strip(); "
            "print('http://127.0.0.1:3010/' if s=='blue' else 'http://127.0.0.1:3011/')\") "
            "|| true",
        )

        # Stage empty targets with deploy ownership
        run(
            client,
            "mkdir -p /opt/bnab/shared/overlay && "
            "chown -R deploy:deploy /opt/bnab/shared && "
            "install -o deploy -g deploy -m 664 /dev/null /opt/bnab/shared/bnab-next-upload.tgz && "
            "install -o deploy -g deploy -m 775 /dev/null /opt/bnab/shared/remote-promote-inactive.sh",
        )

        sftp = client.open_sftp()
        print(f"upload .next {tarball.stat().st_size / 1e6:.1f} MB", flush=True)
        sftp.put(str(tarball), "/opt/bnab/shared/bnab-next-upload.tgz")
        sftp.put(str(PROMOTE_SCRIPT), "/opt/bnab/shared/remote-promote-inactive.sh")

        for local in schema_files:
            remote = f"/opt/bnab/shared/overlay/{local.name}"
            run(
                client,
                f"install -o deploy -g deploy -m 664 /dev/null {remote}",
            )
            sftp.put(str(local), remote)

        with tempfile.NamedTemporaryFile(suffix=".tgz", delete=False) as tmp:
            overlay_tgz = Path(tmp.name)
        with tarfile.open(overlay_tgz, "w:gz") as tar:
            tar.add(migrations_dir, arcname="prisma/migrations")
            for lib in overlay_libs:
                if lib.is_file() or lib.is_dir():
                    rel = lib.relative_to(ROOT / "bnab").as_posix()
                    tar.add(lib, arcname=rel)
        run(
            client,
            "install -o deploy -g deploy -m 664 /dev/null /opt/bnab/shared/bnab-overlay.tgz",
        )
        sftp.put(str(overlay_tgz), "/opt/bnab/shared/bnab-overlay.tgz")
        overlay_tgz.unlink(missing_ok=True)

        brand = pack_brand_tarball(ROOT)
        if brand:
            run(
                client,
                "install -o deploy -g deploy -m 664 /dev/null /opt/bnab/shared/bnab-public.tgz",
            )
            sftp.put(str(brand), "/opt/bnab/shared/bnab-public.tgz")
            brand.unlink(missing_ok=True)
            print("upload brand assets", flush=True)

        sftp.close()

        code = run(
            client,
            "chmod +x /opt/bnab/shared/remote-promote-inactive.sh && "
            "bash /opt/bnab/shared/remote-promote-inactive.sh",
            timeout=500,
        )
        elapsed = time.time() - t0
        print(f"\nUPLOAD_PHASE_SEC={elapsed:.1f}", flush=True)
        if code == 0:
            print("UPLOAD_OK", flush=True)
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
