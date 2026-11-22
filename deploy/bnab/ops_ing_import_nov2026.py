#!/usr/bin/env python3
"""Upload Nov 2026 ING CSVs and run ops-ing-import on the active BNAB slot."""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parent.parent.parent
SECRETS = Path(__file__).resolve().parent.parent / "deploy.secrets"

CSV_TINEL = Path.home() / "Downloads" / "Tranzactii_22-11-2026_21-56-00.csv"
CSV_MONICA = Path.home() / "Downloads" / "Tranzactii_22-11-2026_21-57-12.csv"


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
    if not CSV_TINEL.is_file() or not CSV_MONICA.is_file():
        print(f"Missing CSVs:\n  {CSV_TINEL}\n  {CSV_MONICA}", file=sys.stderr)
        sys.exit(1)

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
    remote_dir = "/tmp/bnab-ing-nov2026"
    run(client, f"mkdir -p {remote_dir} && chmod 755 {remote_dir}")
    for local, name in (
        (CSV_TINEL, "tinel.csv"),
        (CSV_MONICA, "monica.csv"),
    ):
        remote = f"{remote_dir}/{name}"
        print(f"upload {local.name} → {remote}", flush=True)
        sftp.put(str(local), remote)
    sftp.close()

    # List accounts then import (names matched loosely)
    base = (
        "ACTIVE=$(tr -d '[:space:]' </opt/bnab/active_slot); "
        "cd /opt/bnab/$ACTIVE/bnab; "
        "set -a; . /opt/bnab/shared/.env; set +a; "
        "export DATABASE_URL=file:/opt/bnab/shared/bnab.db; "
    )

    rc = run(client, base + "npx tsx scripts/ops-ing-import.ts --list-accounts")
    if rc != 0:
        sys.exit(rc)

    # Prefer account names containing Tinel / Constantin / checking for Bogza;
    # Monica for Vlad — operator can adjust needles if list shows different names.
    for csv_name, needle, label in (
        ("tinel.csv", "Tinel", "Tranzactii_22-11-2026_Bogza"),
        ("monica.csv", "Monica", "Tranzactii_22-11-2026_Vlad"),
    ):
        rc = run(
            client,
            base
            + f'npx tsx scripts/ops-ing-import.ts --account "{needle}" '
            + f"--csv {remote_dir}/{csv_name} --label {label}",
            timeout=1200,
        )
        if rc != 0:
            print(f"IMPORT_FAIL {needle}", flush=True)
            sys.exit(rc)

    rc = run(
        client,
        base + "npx tsx scripts/ops-cover-overspend.ts --month 2026-11",
        timeout=600,
    )
    if rc != 0:
        sys.exit(rc)

    rc = run(client, base + "npx tsx scripts/ops-verify-import.ts", timeout=300)
    client.close()
    if rc != 0:
        sys.exit(rc)
    print("\nOPS_ING_IMPORT_OK", flush=True)


if __name__ == "__main__":
    main()
