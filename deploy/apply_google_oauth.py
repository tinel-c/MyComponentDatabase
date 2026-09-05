#!/usr/bin/env python3
"""Apply deploy/google-oauth.secrets to local + VPS warehouse/BNAB env and restart PM2."""
from __future__ import annotations

import io
import re
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parent.parent
DEPLOY = ROOT / "deploy"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        env[k] = v
    return env


def upsert_env_file(content: str, updates: dict[str, str]) -> str:
    lines = content.splitlines()
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if m and m.group(1) in updates:
            key = m.group(1)
            out.append(f"{key}={updates[key]}")
            seen.add(key)
        else:
            out.append(line)
    for key, val in updates.items():
        if key not in seen:
            out.append(f"{key}={val}")
    return "\n".join(out) + "\n"


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str]:
    transport = client.get_transport()
    assert transport is not None
    chan = transport.open_session(timeout=60)
    chan.get_pty(width=160, height=40)
    chan.settimeout(0.0)
    chan.exec_command(cmd)
    deadline = time.time() + timeout
    buf = b""
    while True:
        if time.time() > deadline:
            return 124, buf.decode("utf-8", errors="replace")
        if chan.recv_ready():
            buf += chan.recv(16384)
        if chan.exit_status_ready():
            while chan.recv_ready():
                buf += chan.recv(16384)
            return chan.recv_exit_status(), buf.decode("utf-8", errors="replace")
        time.sleep(0.1)


def sftp_upsert(sftp: paramiko.SFTPClient, remote_path: str, updates: dict[str, str]) -> None:
    try:
        with sftp.open(remote_path, "r") as f:
            content = f.read().decode("utf-8")
    except FileNotFoundError:
        content = ""
    new_content = upsert_env_file(content, updates)
    with sftp.open(remote_path, "w") as f:
        f.write(new_content)
    print(f"Patched {remote_path}")


def main() -> None:
    oauth = load_env(DEPLOY / "google-oauth.secrets")
    deploy = load_env(DEPLOY / "deploy.secrets")
    gid = oauth.get("AUTH_GOOGLE_ID", "").strip()
    gsecret = oauth.get("AUTH_GOOGLE_SECRET", "").strip()
    admin = deploy.get("ADMIN_EMAIL", "tinel.c@gmail.com").strip()
    if not gid or not gsecret:
        print("ERROR: AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET empty in google-oauth.secrets")
        sys.exit(1)

    deploy_path = DEPLOY / "deploy.secrets"
    deploy_path.write_text(
        upsert_env_file(
            deploy_path.read_text(encoding="utf-8"),
            {"AUTH_GOOGLE_ID": gid, "AUTH_GOOGLE_SECRET": gsecret},
        ),
        encoding="utf-8",
    )
    print("Updated deploy/deploy.secrets")

    auth_secret = deploy.get("AUTH_SECRET") or "local-dev-secret-change-me-32chars-min!!"
    for app, auth_url in (("web", "http://localhost:3000"), ("bnab", "http://localhost:3010")):
        local_env = ROOT / app / ".env"
        updates = {
            "AUTH_GOOGLE_ID": gid,
            "AUTH_GOOGLE_SECRET": gsecret,
            "AUTH_URL": auth_url,
            "ADMIN_EMAIL": admin,
        }
        if local_env.exists():
            local_env.write_text(
                upsert_env_file(local_env.read_text(encoding="utf-8"), updates),
                encoding="utf-8",
            )
        else:
            db = "file:./dev.db"
            local_env.write_text(
                f'DATABASE_URL="{db}"\n'
                f'AUTH_SECRET="{auth_secret}"\n'
                f"AUTH_URL={auth_url}\n"
                f"AUTH_GOOGLE_ID={gid}\n"
                f"AUTH_GOOGLE_SECRET={gsecret}\n"
                f"ADMIN_EMAIL={admin}\n",
                encoding="utf-8",
            )
        print(f"Updated {app}/.env")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=deploy["DEPLOY_HOST"],
        port=int(deploy.get("DEPLOY_SSH_PORT") or "22"),
        username=deploy["DEPLOY_USER"],
        password=deploy["DEPLOY_SSH_PASSWORD"],
        timeout=90,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        sftp = client.open_sftp()
        sftp_upsert(
            sftp,
            "/opt/warehouse/shared/.env",
            {
                "AUTH_GOOGLE_ID": gid,
                "AUTH_GOOGLE_SECRET": gsecret,
                "AUTH_URL": "https://part-db.bogza.ro",
                "ADMIN_EMAIL": admin,
            },
        )
        sftp_upsert(
            sftp,
            "/opt/bnab/shared/.env",
            {
                "AUTH_GOOGLE_ID": gid,
                "AUTH_GOOGLE_SECRET": gsecret,
                "AUTH_URL": "https://bnab.bogza.ro",
                "ADMIN_EMAIL": admin,
            },
        )
        sftp.close()

        code, out = run(
            client,
            r"""bash -lc '
set -euo pipefail
ln -sfn /opt/warehouse/shared/.env /opt/warehouse/green/web/.env
ln -sfn /opt/bnab/shared/.env /opt/bnab/green/bnab/.env
# Confirm keys present without printing secrets
grep -E "^AUTH_GOOGLE_ID=" /opt/warehouse/shared/.env /opt/bnab/shared/.env | sed -E "s/=.*/=<set>/"
grep -E "^AUTH_URL=" /opt/warehouse/shared/.env /opt/bnab/shared/.env
pm2 restart warehouse-green --update-env
pm2 restart bnab-green --update-env
sleep 4
echo -n wh:
curl -sS -m 8 -k --resolve part-db.bogza.ro:443:127.0.0.1 https://part-db.bogza.ro/api/auth/providers | head -c 200
echo
echo -n bnab:
curl -sS -m 8 -k --resolve bnab.bogza.ro:443:127.0.0.1 https://bnab.bogza.ro/api/auth/providers | head -c 200
echo
pm2 list | head -12
echo APPLY_OK
'""",
            timeout=120,
        )
        print(out)
        if code != 0:
            sys.exit(code)
        print(f"Applied Google client …{gid[-16:]}")
    finally:
        client.close()


if __name__ == "__main__":
    main()
