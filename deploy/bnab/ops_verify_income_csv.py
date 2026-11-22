#!/usr/bin/env python3
"""
Compare monthly Plan Income (Paycheck / Other income) on prod vs expected
totals derived from local HomeBank ING CSV export(s) + prod import rules.

Usage:
  python deploy/bnab/ops_verify_income_csv.py [csv1] [csv2] ...

Defaults to Downloads Tranzactii_22-11-2026_*.csv when no paths given.
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from textwrap import dedent

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ops_fast_sqlite import run_remote  # noqa: E402

RO_MONTHS = {
    "ianuarie": "01",
    "februarie": "02",
    "martie": "03",
    "aprilie": "04",
    "mai": "05",
    "iunie": "06",
    "iulie": "07",
    "august": "08",
    "septembrie": "09",
    "octombrie": "10",
    "noiembrie": "11",
    "decembrie": "12",
}

DEFAULT_CSVS = sorted(
    Path(r"C:\Users\tinel\Downloads").glob("Tranzactii_22-11-2026_*.csv")
)

REMOTE_RULES = dedent(
    r'''
    import sqlite3, json
    db = sqlite3.connect("/opt/bnab/shared/bnab.db")
    db.row_factory = sqlite3.Row
    income_cats = {
        r["id"]: r["name"]
        for r in db.execute("SELECT id, name FROM Category WHERE isIncome=1")
    }
    rules = [dict(r) for r in db.execute(
        "SELECT id, matchText, ignore, sortOrder, categoryId, transferAccountId "
        "FROM ImportCategoryRule ORDER BY sortOrder"
    )]
    monthly = [dict(r) for r in db.execute(
        "SELECT substr(t.date,1,7) AS month, c.name AS category, "
        "SUM(t.amount) AS activity, COUNT(*) AS n "
        'FROM "Transaction" t JOIN Category c ON c.id = t.categoryId '
        "WHERE c.isIncome = 1 AND t.isChild = 0 "
        "GROUP BY 1, 2 ORDER BY 1, 2"
    )]
    print(json.dumps({"incomeCats": income_cats, "rules": rules, "monthly": monthly}))
    '''
)


def parse_amount(raw: str) -> int:
    s = (raw or "").strip().replace(" ", "").replace('"', "")
    if not s:
        return 0
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", "")
    try:
        return int(round(float(s) * 100))
    except ValueError:
        return 0


def parse_date(raw: str) -> str | None:
    t = (raw or "").strip()
    if not t:
        return None
    s = t
    for name, num in RO_MONTHS.items():
        s = re.sub(rf"\s{name}\s", f"/{num}/", s, flags=re.I)
    m = re.match(r"^(\d{1,2})/(\d{2})/(\d{4})$", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{int(m.group(1)):02d}"
    return None


def split_csv_line(line: str) -> list[str]:
    out: list[str] = []
    cur = ""
    in_quotes = False
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == '"':
            if in_quotes and i + 1 < len(line) and line[i + 1] == '"':
                cur += '"'
                i += 2
                continue
            in_quotes = not in_quotes
            i += 1
            continue
        if ch == "," and not in_quotes:
            out.append(cur)
            cur = ""
            i += 1
            continue
        cur += ch
        i += 1
    out.append(cur)
    return out


def detect_columns(header: list[str]) -> tuple[int, int]:
    norm = [c.strip().lower() for c in header]
    try:
        debit = norm.index("debit")
        credit = norm.index("credit")
        return debit, credit
    except ValueError:
        return 6, 8


def parse_ing_csv(text: str) -> list[dict]:
    lines = text.splitlines()
    debit_i, credit_i = 6, 8
    detected = False
    current = None
    rows: list[dict] = []

    def push(cur: dict) -> None:
        memo = " ".join(cur["details"])
        memo = re.sub(r"\s+", " ", memo).strip()
        date = parse_date(cur["dateRaw"])
        if not date or not memo:
            return
        outflow = parse_amount(cur["debit"])
        inflow = parse_amount(cur["credit"])
        if outflow == 0 and inflow == 0:
            return
        rows.append(
            {
                "date": date,
                "memo": memo,
                "amount": inflow if inflow > 0 else -outflow,
            }
        )

    for line in lines:
        if not line.strip():
            continue
        cols = split_csv_line(line)
        joined = "|".join(c.strip().lower() for c in cols)
        if not detected and "debit" in joined and "credit" in joined:
            debit_i, credit_i = detect_columns(cols)
            detected = True
            continue
        width = max(3, debit_i, credit_i) + 1
        while len(cols) < width:
            cols.append("")
        date_cell = cols[0].strip()
        details = cols[3].strip()
        debit = cols[debit_i].strip()
        credit = cols[credit_i].strip()
        if "Sold ini" in date_cell:
            break
        if date_cell in ("Data", "Date"):
            continue
        if date_cell and parse_date(date_cell):
            if current:
                push(current)
            current = {
                "dateRaw": date_cell,
                "details": [details] if details else [],
                "debit": debit,
                "credit": credit,
            }
        elif current:
            if details:
                current["details"].append(details)
            if debit and not current["debit"]:
                current["debit"] = debit
            if credit and not current["credit"]:
                current["credit"] = credit
    if current:
        push(current)
    return rows


def first_matching_rule(memo: str, rules: list[dict], account_id: str = "acct") -> dict | None:
    memo_l = memo.lower()
    ordered = sorted(rules, key=lambda r: r["sortOrder"])
    for rule in ordered:
        mt = (rule.get("matchText") or "").strip()
        if not mt:
            continue
        transfer_to = rule.get("transferAccountId")
        if not rule.get("ignore") and not rule.get("categoryId") and not transfer_to:
            continue
        if account_id and transfer_to and transfer_to == account_id:
            continue
        if mt.lower() in memo_l:
            return rule
    return None


def csv_income_by_month(
    paths: list[Path], rules: list[dict], income_cats: dict[str, str]
) -> dict[str, dict[str, int]]:
    """month -> {categoryName: amount}"""
    out: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    income_ids = set(income_cats.keys())
    for path in paths:
        rows = parse_ing_csv(path.read_text(encoding="utf-8-sig", errors="replace"))
        for row in rows:
            rule = first_matching_rule(row["memo"], rules)
            if not rule or rule.get("ignore"):
                continue
            cat_id = rule.get("categoryId")
            if not cat_id or cat_id not in income_ids:
                continue
            name = income_cats[cat_id]
            month = row["date"][:7]
            out[month][name] += row["amount"]
    return {m: dict(cats) for m, cats in sorted(out.items())}


def site_income_by_month(monthly: list[dict]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = defaultdict(dict)
    for r in monthly:
        out[r["month"]][r["category"]] = int(r["activity"])
    return dict(out)


def fmt(n: int) -> str:
    return f"{n / 100:,.2f}"


def main() -> None:
    paths = [Path(p) for p in sys.argv[1:]] if len(sys.argv) > 1 else list(DEFAULT_CSVS)
    if not paths:
        print("No CSV paths found", file=sys.stderr)
        raise SystemExit(1)
    for p in paths:
        if not p.is_file():
            print(f"Missing CSV: {p}", file=sys.stderr)
            raise SystemExit(1)

    print("Fetching prod income rules + Plan income activity…")
    remote = json.loads(run_remote(REMOTE_RULES, timeout=60))
    income_cats = remote["incomeCats"]
    rules = remote["rules"]
    site = site_income_by_month(remote["monthly"])
    csv_income = csv_income_by_month(paths, rules, income_cats)

    months = sorted(set(site) | set(csv_income))
    categories = sorted({c for m in months for c in {**site.get(m, {}), **csv_income.get(m, {})}})

    print(f"\nCSVs: {', '.join(p.name for p in paths)}")
    print(f"{'month':<10} {'category':<16} {'CSV':>14} {'Site':>14} {'delta':>14}")
    mismatches = 0
    notes: list[str] = []
    for month in months:
        for cat in categories:
            csv_v = csv_income.get(month, {}).get(cat, 0)
            site_v = site.get(month, {}).get(cat, 0)
            if csv_v == 0 and site_v == 0:
                continue
            delta = site_v - csv_v
            # Balance-adjustment Other income exists only on site (not in CSV).
            if (
                cat == "Other income"
                and csv_v == 0
                and site_v > 0
                and site_v == site.get(month, {}).get("Other income", 0)
            ):
                notes.append(
                    f"{month} Other income site-only {fmt(site_v)} (likely balance adjustments)"
                )
                print(
                    f"~~{month:<8} {cat:<16} {fmt(csv_v):>14} {fmt(site_v):>14} {fmt(delta):>14}"
                )
                continue
            if csv_v > 0 and site_v == 0:
                notes.append(f"{month} {cat}: in CSV but not imported on site")
            flag = "  " if delta == 0 else "!!"
            if delta != 0:
                mismatches += 1
            print(
                f"{flag}{month:<8} {cat:<16} {fmt(csv_v):>14} {fmt(site_v):>14} {fmt(delta):>14}"
            )

    if notes:
        print("\nNotes:")
        for n in notes:
            print(f"  - {n}")

    if mismatches:
        print(
            f"\n{mismatches} mismatch(es). "
            "CSV = expected from file+rules; Site = Plan Income activity."
        )
        raise SystemExit(2)
    print("\nAll compared months match (aside from noted site-only adjustments).")


if __name__ == "__main__":
    main()
