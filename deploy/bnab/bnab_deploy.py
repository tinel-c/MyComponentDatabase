#!/usr/bin/env python3
"""
BNAB deploy CLI — zero-downtime blue/green promote (PC build → inactive slot).

Usage:
  python deploy/bnab/bnab_deploy.py status
  python deploy/bnab/bnab_deploy.py build
  python deploy/bnab/bnab_deploy.py upload   # promote inactive; live stays up
  python deploy/bnab/bnab_deploy.py brand    # optional; upload already packs brand
  python deploy/bnab/bnab_deploy.py clean    # prep inactive only (does NOT kill live)
  python deploy/bnab/bnab_deploy.py restart
  python deploy/bnab/bnab_deploy.py all      # build → upload → status
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
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
    """Prep inactive slot only — does not take the site down."""
    run([sys.executable, str(DEPLOY / "ssh_clean_next.py")])


def cmd_build() -> None:
    t0 = time.time()
    run(["npm", "run", "build"], cwd=BNAB)
    tgz = BNAB / ".next-upload.tgz"
    if tgz.exists():
        tgz.unlink()
    run(["tar", "-czf", ".next-upload.tgz", ".next"], cwd=BNAB)
    mb = tgz.stat().st_size / 1e6
    print(f"PACKED {tgz.name} ({mb:.1f} MB) BUILD_SEC={time.time() - t0:.1f}", flush=True)


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
    """Zero-downtime: build while live, promote inactive, verify."""
    t0 = time.time()
    cmd_build()
    cmd_upload()
    cmd_status()
    print(f"\nDEPLOY_OK TOTAL_SEC={time.time() - t0:.1f}", flush=True)


def main() -> None:
    p = argparse.ArgumentParser(
        description="BNAB zero-downtime deploy (blue/green inactive promote)",
    )
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
