#!/usr/bin/env python3
"""
BNAB deploy CLI — process-oriented local promote.

Usage:
  python deploy/bnab/bnab_deploy.py status
  python deploy/bnab/bnab_deploy.py clean
  python deploy/bnab/bnab_deploy.py build
  python deploy/bnab/bnab_deploy.py upload
  python deploy/bnab/bnab_deploy.py brand
  python deploy/bnab/bnab_deploy.py restart
  python deploy/bnab/bnab_deploy.py all   # clean → build → upload → brand → restart
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
BNAB = ROOT / "bnab"
DEPLOY = Path(__file__).resolve().parent


def run(cmd: list[str], cwd: Path | None = None) -> None:
    print(f"\n==> {' '.join(cmd)}", flush=True)
    r = subprocess.run(
        cmd,
        cwd=str(cwd or ROOT),
        shell=os.name == "nt",
    )
    if r.returncode != 0:
        sys.exit(r.returncode)

def cmd_status() -> None:
    run([sys.executable, str(DEPLOY / "ssh_check_bnab.py")])


def cmd_clean() -> None:
    run([sys.executable, str(DEPLOY / "ssh_clean_next.py")])


def cmd_build() -> None:
    run(["npm", "run", "build"], cwd=BNAB)
    tgz = BNAB / ".next-upload.tgz"
    if tgz.exists():
        tgz.unlink()
    run(["tar", "-czf", ".next-upload.tgz", ".next"], cwd=BNAB)
    mb = tgz.stat().st_size / 1e6
    print(f"PACKED {tgz.name} ({mb:.1f} MB)", flush=True)


def cmd_upload() -> None:
    tgz = BNAB / ".next-upload.tgz"
    if not tgz.is_file():
        print("missing .next-upload.tgz — run: bnab_deploy.py build", file=sys.stderr)
        sys.exit(1)
    run([sys.executable, str(DEPLOY / "ssh_upload_live_next.py")])


def cmd_brand() -> None:
    run([sys.executable, str(DEPLOY / "ssh_upload_public_brand.py")])


def cmd_restart() -> None:
    run([sys.executable, str(DEPLOY / "ssh_quick_restart_bnab.py")])


def cmd_all() -> None:
    cmd_clean()
    cmd_build()
    cmd_upload()
    cmd_brand()
    print("\nDEPLOY_OK", flush=True)


def main() -> None:
    p = argparse.ArgumentParser(description="BNAB deploy pipeline")
    p.add_argument(
        "step",
        choices=["status", "clean", "build", "upload", "brand", "restart", "all"],
    )
    args = p.parse_args()
    {
        "status": cmd_status,
        "clean": cmd_clean,
        "build": cmd_build,
        "upload": cmd_upload,
        "brand": cmd_brand,
        "restart": cmd_restart,
        "all": cmd_all,
    }[args.step]()


if __name__ == "__main__":
    main()
