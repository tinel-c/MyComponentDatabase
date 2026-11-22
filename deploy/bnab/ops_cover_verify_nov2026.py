#!/usr/bin/env python3
"""Hotpatch plan-data + ops scripts, then cover Nov 2026 overspend and verify (imports already done)."""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parent.parent.parent
SECRETS = Path(__file__).resolve().parent.parent / "deploy.secrets"


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


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 900) -> int:
    print(f"\n>>> {cmd[:200]}", flush=True)
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=timeout)
    stdin.close()
    end = time.time() + timeout
    while time.time() < end:
        if stdout.channel.recv_ready():
            raw = stdout.channel.recv(8192)
            if raw:
                sys.stdout.write(raw.decode("utf-8", errors="replace"))
                sys.stdout.flush()
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready():
            break
        time.sleep(0.15)
    if not stdout.channel.exit_status_ready():
        print("(timeout)", flush=True)
        return 1
    return stdout.channel.recv_exit_status()


def main() -> None:
    env = load_secrets(SECRETS)
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

    sftp = client.open_sftp()
    # Patch both slots so active green has the fix
    files = [
        (
            ROOT / "bnab" / "src" / "lib" / "plan-data.ts",
            "src/lib/plan-data.ts",
        ),
        (
            ROOT / "bnab" / "scripts" / "ops-cover-overspend.ts",
            "scripts/ops-cover-overspend.ts",
        ),
        (
            ROOT / "bnab" / "scripts" / "ops-verify-import.ts",
            "scripts/ops-verify-import.ts",
        ),
    ]
    for slot in ("green", "blue"):
        for local, rel in files:
            remote = f"/opt/bnab/{slot}/bnab/{rel}"
            print(f"put {rel} → {remote}", flush=True)
            sftp.put(str(local), remote)
    sftp.close()

    base = (
        "ACTIVE=$(tr -d '[:space:]' </opt/bnab/active_slot); "
        "cd /opt/bnab/$ACTIVE/bnab; "
        "set -a; . /opt/bnab/shared/.env; set +a; "
        "export DATABASE_URL=file:/opt/bnab/shared/bnab.db; "
        "TSX=./node_modules/.bin/tsx; "
        "if [ ! -x \"$TSX\" ]; then TSX='npx --yes tsx'; fi; "
    )

    rc = run(
        client,
        base + "$TSX scripts/ops-cover-overspend.ts --month 2026-11",
        timeout=600,
    )
    if rc != 0:
        sys.exit(rc)

    rc = run(client, base + "$TSX scripts/ops-verify-import.ts", timeout=300)
    client.close()
    if rc != 0:
        sys.exit(rc)
    print("\nOPS_COVER_VERIFY_OK", flush=True)


if __name__ == "__main__":
    main()
