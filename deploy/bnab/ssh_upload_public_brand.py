#!/usr/bin/env python3
"""Upload BNAB public brand assets (icons/favicon) to green after git reset."""
from __future__ import annotations

import re
import sys
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko


def load(path: Path) -> dict[str, str]:
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


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> int:
    print(f"\n>>> {cmd[:140]}", flush=True)
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=timeout)
    stdin.close()
    end = time.time() + timeout
    while time.time() < end:
        if stdout.channel.recv_ready():
            raw = stdout.channel.recv(8192)
            if raw:
                sys.stdout.buffer.write(raw)
                sys.stdout.flush()
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready():
            break
        time.sleep(0.1)
    if not stdout.channel.exit_status_ready():
        return 1
    return stdout.channel.recv_exit_status()


def main() -> None:
    root = Path(__file__).resolve().parent.parent.parent
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
    with tarfile.open(tgz, "w:gz") as tar:
        for rel in files:
            path = pub / rel
            if path.is_file():
                tar.add(path, arcname=rel)
                print(f"pack {rel}", flush=True)

    env = load(Path(__file__).resolve().parent.parent / "deploy.secrets")
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
            "install -o deploy -g deploy -m 664 /dev/null /opt/bnab/shared/bnab-public.tgz",
        )
        sftp = client.open_sftp()
        sftp.put(str(tgz), "/opt/bnab/shared/bnab-public.tgz")
        sftp.close()
        code = run(
            client,
            r"""set -euo pipefail
sudo -u deploy bash -lc '
  set -euo pipefail
  cd /opt/bnab/green/bnab/public
  mkdir -p brand
  tar -xzf /opt/bnab/shared/bnab-public.tgz
  ls -la favicon.ico icon.svg icon-192.png icon-512-maskable.png apple-touch-icon.png manifest.webmanifest sw.js brand/mark.svg
  echo PUBLIC_OK
'
rm -f /opt/bnab/shared/bnab-public.tgz
""",
        )
        sys.exit(code)
    finally:
        client.close()
        tgz.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
