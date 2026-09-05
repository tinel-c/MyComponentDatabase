#!/usr/bin/env python3
"""Deploy BNAB with live progress. Safe prep (no self-matching pkill)."""
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


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> int:
    print(f"\n>>> {cmd}", flush=True)
    transport = client.get_transport()
    assert transport is not None
    chan = transport.open_session(timeout=60)
    chan.get_pty(width=200, height=50)
    chan.settimeout(0.0)
    chan.exec_command(cmd)
    deadline = time.time() + timeout
    buf = b""
    while True:
        if time.time() > deadline:
            chan.close()
            print(f"\nTIMEOUT after {timeout}s", flush=True)
            return 124
        if chan.recv_ready():
            chunk = chan.recv(16384)
            if chunk:
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    sys.stdout.buffer.write(line + b"\n")
                    sys.stdout.flush()
        if chan.recv_stderr_ready():
            err = chan.recv_stderr(16384)
            if err:
                sys.stdout.buffer.write(err)
                sys.stdout.flush()
        if chan.exit_status_ready():
            # drain
            while chan.recv_ready():
                chunk = chan.recv(16384)
                if chunk:
                    buf += chunk
            if buf:
                sys.stdout.buffer.write(buf)
                if not buf.endswith(b"\n"):
                    sys.stdout.buffer.write(b"\n")
                sys.stdout.flush()
            return chan.recv_exit_status()
        time.sleep(0.2)


def main() -> None:
    env = load_secrets(Path(__file__).resolve().parent.parent / "deploy.secrets")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {env['DEPLOY_HOST']}…", flush=True)
    client.connect(
        hostname=env["DEPLOY_HOST"],
        port=int(env.get("DEPLOY_SSH_PORT") or "22"),
        username=env["DEPLOY_USER"],
        password=env["DEPLOY_SSH_PASSWORD"],
        timeout=90,
        banner_timeout=90,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        # Kill only npm/git whose cwd is under /opt/bnab (never match this SSH cmdline).
        code = run(
            client,
            "bash -lc '"
            "rm -f /opt/bnab/blue/.git/index.lock /opt/bnab/green/.git/index.lock; "
            "for pid in $(pgrep -x npm || true) $(pgrep -x git || true); do "
            "cwd=$(readlink -f /proc/$pid/cwd 2>/dev/null || true); "
            'case "$cwd" in /opt/bnab/*) echo kill:$pid:$cwd; kill -9 $pid;; esac; '
            "done; echo prep_kill_done'",
            timeout=60,
        )
        if code != 0:
            print(f"prep kill exit {code}", flush=True)

        for slot in ("blue", "green"):
            code = run(
                client,
                f"bash -lc 'rm -f /opt/bnab/{slot}/.git/index.lock; "
                f"git -C /opt/bnab/{slot} fetch origin && "
                f"git -C /opt/bnab/{slot} reset --hard origin/main && "
                f"echo {slot}=$(git -C /opt/bnab/{slot} rev-parse --short HEAD)'",
                timeout=180,
            )
            if code != 0:
                print(f"update {slot} exit {code}", flush=True)
                sys.exit(code)

        run(
            client,
            "bash -lc 'grep -n \"STALL\\|heartbeat\\|deploy-npm-status\" /opt/bnab/blue/deploy/bnab/deploy-bnab.sh | head -20'",
            timeout=30,
        )

        code = run(client, "bash /opt/bnab/blue/deploy/bnab/deploy-bnab.sh", timeout=2400)
        if code != 0:
            print(f"deploy exit {code}", flush=True)
            sys.exit(code)

        code = run(
            client,
            "bash -lc 'ACTIVE=$(tr -d \"[:space:]\" </opt/bnab/active_slot); cd /opt/bnab/$ACTIVE/bnab; export DATABASE_URL=file:/opt/bnab/shared/bnab.db; set -a; . /opt/bnab/shared/.env; set +a; npx prisma db seed || true; echo -n local:; curl -sS -o /dev/null -w \"%{http_code}\" http://127.0.0.1:3010/ || curl -sS -o /dev/null -w \"%{http_code}\" http://127.0.0.1:3011/; echo; echo -n vhost:; curl -sS -o /dev/null -w \"%{http_code}\" -H \"Host: bnab.bogza.ro\" http://127.0.0.1/; echo; pm2 list | head -20; echo DEPLOY_OK'",
            timeout=180,
        )
        print("\nDONE", flush=True)
        sys.exit(code)
    finally:
        client.close()


if __name__ == "__main__":
    main()
