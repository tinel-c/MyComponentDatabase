#!/usr/bin/env python3
"""Sync GEMINI_API_KEY from local bnab/.env into VPS /opt/bnab/shared/.env (no commit)."""
from __future__ import annotations

import re
import sys
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


def main() -> None:
    root = Path(__file__).resolve().parent.parent.parent
    local = load(root / "bnab" / ".env")
    key = local.get("GEMINI_API_KEY", "").strip()
    if not key:
        print("GEMINI_API_KEY missing in bnab/.env", file=sys.stderr)
        sys.exit(1)
    model = local.get("GEMINI_MODEL", "").strip() or "gemini-3.6-flash"

    secrets = load(Path(__file__).resolve().parent.parent / "deploy.secrets")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=secrets["DEPLOY_HOST"],
        port=int(secrets.get("DEPLOY_SSH_PORT") or "22"),
        username=secrets["DEPLOY_USER"],
        password=secrets["DEPLOY_SSH_PASSWORD"],
        timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        # Read remote .env via sftp without printing secrets
        sftp = client.open_sftp()
        remote_path = "/opt/bnab/shared/.env"
        with sftp.open(remote_path, "r") as f:
            text = f.read().decode("utf-8")
        lines = text.splitlines()
        keys = {
            "GEMINI_API_KEY": key,
            "GEMINI_MODEL": model,
            "BNAB_RECEIPT_DIR": "/opt/bnab/shared/receipts",
        }

        out: list[str] = []
        seen: set[str] = set()
        for line in lines:
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=", line.strip())
            if m and m.group(1) in keys:
                k = m.group(1)
                out.append(f'{k}="{keys[k]}"')
                seen.add(k)
            else:
                out.append(line)
        for k, v in keys.items():
            if k not in seen:
                out.append(f'{k}="{v}"')
        new_text = "\n".join(out).rstrip() + "\n"
        tmp = "/opt/bnab/shared/.env.gemini.tmp"
        run = client.exec_command
        # Write via install + sftp put then mv
        stdin, stdout, stderr = client.exec_command(
            f"install -o deploy -g deploy -m 640 /dev/null {tmp} && "
            f"mkdir -p /opt/bnab/shared/receipts && chown deploy:deploy /opt/bnab/shared/receipts"
        )
        stdout.channel.recv_exit_status()
        with sftp.open(tmp, "w") as f:
            f.write(new_text)
        stdin, stdout, stderr = client.exec_command(
            f"mv -f {tmp} {remote_path} && chown deploy:deploy {remote_path} && chmod 640 {remote_path}"
        )
        code = stdout.channel.recv_exit_status()
        sftp.close()
        if code != 0:
            print(stderr.read().decode(), file=sys.stderr)
            sys.exit(code or 1)
        print("GEMINI_ENV_OK")
    finally:
        client.close()


if __name__ == "__main__":
    main()
