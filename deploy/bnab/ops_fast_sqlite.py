#!/usr/bin/env python3
"""Fast prod DB ops via remote python3+sqlite3 (no npx/tsx). Subcommands: diag | revert-nov."""
from __future__ import annotations

import sys
from pathlib import Path

import paramiko

SECRETS = Path(__file__).resolve().parent.parent / "deploy.secrets"

DIAG_PY = r"""
import sqlite3, json
db = sqlite3.connect("/opt/bnab/shared/bnab.db")
db.row_factory = sqlite3.Row
batches = ["cmwsaj8gd00016zxuxjxzzuco", "cmwsajdbz00016zyxyi2atacf"]
tinel, monica = "cmtpik89g00db6zrqxo0pec0p", "cmtpj3ktt00016zir7sif2uqw"

created = db.execute(
    "SELECT transactionId, fingerprint, batchId FROM ImportBatchItem "
    "WHERE batchId IN (?,?) AND action IN ('created','created_transfer_twin') "
    "AND transactionId IS NOT NULL",
    batches,
).fetchall()
ids = [r["transactionId"] for r in created]

# Sample overlap: same account+date+amount, older row not from these batches
overlap = 0
samples = db.execute(
    'SELECT id, accountId, date, amount FROM "Transaction" '
    "WHERE importBatchId IN (?,?) AND isChild=0 LIMIT 30",
    batches,
).fetchall()
for s in samples:
    n = db.execute(
        'SELECT COUNT(*) FROM "Transaction" WHERE accountId=? AND date=? AND amount=? '
        "AND id!=? AND (importBatchId IS NULL OR importBatchId NOT IN (?,?)) AND isChild=0",
        (s["accountId"], s["date"], s["amount"], s["id"], *batches),
    ).fetchone()[0]
    if n:
        overlap += 1

def bals(aid):
    tot = db.execute(
        'SELECT COUNT(*), COALESCE(SUM(amount),0) FROM "Transaction" WHERE accountId=? AND isChild=0',
        (aid,),
    ).fetchone()
    bat = db.execute(
        'SELECT COUNT(*), COALESCE(SUM(amount),0) FROM "Transaction" '
        "WHERE accountId=? AND isChild=0 AND importBatchId IN (?,?)",
        (aid, *batches),
    ).fetchone()
    return {"count": tot[0], "sum": tot[1], "batchCount": bat[0], "batchSum": bat[1]}

print(json.dumps({
    "batchItems": len(created),
    "sampleOverlapOf30": overlap,
    "tinel": bals(tinel),
    "monica": bals(monica),
}, indent=2))
"""

REVERT_PY = r"""
import sqlite3, json
from datetime import datetime, timezone
db = sqlite3.connect("/opt/bnab/shared/bnab.db")
batches = ["cmwsaj8gd00016zxuxjxzzuco", "cmwsajdbz00016zyxyi2atacf"]
ids = [r[0] for r in db.execute(
    "SELECT transactionId FROM ImportBatchItem "
    "WHERE batchId IN (?,?) AND action IN ('created','created_transfer_twin') "
    "AND transactionId IS NOT NULL",
    batches,
).fetchall()]
# Include twins not listed as items
extra = []
for tid in ids:
    row = db.execute(
        'SELECT transferTwinId FROM "Transaction" WHERE id=?', (tid,)
    ).fetchone()
    if row and row[0] and row[0] not in ids and row[0] not in extra:
        extra.append(row[0])
all_ids = list(dict.fromkeys(ids + extra))
if all_ids:
    q = ",".join("?" * len(all_ids))
    db.execute(f'UPDATE "Transaction" SET transferTwinId=NULL WHERE id IN ({q})', all_ids)
    db.execute(f'DELETE FROM "Transaction" WHERE id IN ({q})', all_ids)
now = datetime.now(timezone.utc).isoformat()
for bid in batches:
    row = db.execute("SELECT statsJson FROM ImportBatch WHERE id=?", (bid,)).fetchone()
    stats = {}
    if row and row[0]:
        try:
            stats = json.loads(row[0])
        except Exception:
            stats = {}
    stats["reverted"] = True
    stats["revertedAt"] = now
    db.execute(
        "UPDATE ImportBatch SET statsJson=? WHERE id=?",
        (json.dumps(stats), bid),
    )
# Clear engine tips so Plan recomputes
budget = db.execute("SELECT id FROM Budget LIMIT 1").fetchone()
if budget:
    db.execute("DELETE FROM EngineMonthTip WHERE budgetId=?", (budget[0],))
db.commit()

def bals(aid):
    return db.execute(
        'SELECT COUNT(*), COALESCE(SUM(amount),0) FROM "Transaction" WHERE accountId=? AND isChild=0',
        (aid,),
    ).fetchone()

print(json.dumps({
    "deleted": len(all_ids),
    "tinel": {"count": bals("cmtpik89g00db6zrqxo0pec0p")[0], "sum": bals("cmtpik89g00db6zrqxo0pec0p")[1]},
    "monica": {"count": bals("cmtpj3ktt00016zir7sif2uqw")[0], "sum": bals("cmtpj3ktt00016zir7sif2uqw")[1]},
}, indent=2))
"""


def load_secrets() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in SECRETS.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k] = v.strip().strip('"')
    return env


def run_remote(py: str, timeout: int = 45) -> str:
    env = load_secrets()
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        env["DEPLOY_HOST"],
        int(env.get("DEPLOY_SSH_PORT") or 22),
        env["DEPLOY_USER"],
        env["DEPLOY_SSH_PASSWORD"],
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = c.open_sftp()
    with sftp.file("/tmp/bnab_fast_ops.py", "w") as f:
        f.write(py)
    sftp.close()
    _, o, e = c.exec_command("python3 /tmp/bnab_fast_ops.py", timeout=timeout)
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    code = o.channel.recv_exit_status()
    c.close()
    if err.strip():
        print(err, file=sys.stderr)
    if code != 0:
        raise SystemExit(f"remote exit {code}\n{out}")
    return out


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "diag"
    if cmd == "diag":
        print(run_remote(DIAG_PY), end="")
    elif cmd == "revert-nov":
        print(run_remote(REVERT_PY), end="")
    else:
        print("Usage: ops_fast_sqlite.py diag|revert-nov", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
