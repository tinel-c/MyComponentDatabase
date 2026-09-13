# Receipt detailing agent (Gemini)

BNAB can split spending using a **bill photo** and Google **Gemini** vision.

## Flows

### A. Scan-only (default) — Reflect first
1. **More → Import bill** → upload photo (or **multiple** photos).
2. Gemini returns line items; each non-ignored line is mapped to an **existing**
   budget category (rules → coerced hint → Unknown/Groceries fallback).
3. Primary CTA: **Done — keep for Reflect** (no ledger entry). Charts and
   opportunities use the scan even before a payment exists.
4. Optionally map to an existing outflow, or check **Also create as pending
   ledger entry** (excluded from Plan/balances until ING Link).

### Multi-file batch
- Selecting **2+ files** runs a queue: sequential Gemini scans (concurrency 1),
  Reflect-first finish per file, cancel remaining / retry failed.
- Mapping is not opened mid-batch — review on **Imported bills** (`/more/bills`).
- Each bill has an expandable **AI audit** (Store, Bill lines, Category matched,
  Linked transaction). Canonical terms: [import-vocabulary.md](./import-vocabulary.md).

### B. Detail an existing bank transaction
1. Open an outflow → **Detail from bill**, or Import bill → pick a matching row.
2. Confirm splits — parent category is cleared; children drive Plan activity.

### C. Reverse auto-link
When you **import ING** or **manually add an outflow**, BNAB looks for a single
pending scan matching amount (±2 bani) and date (±3 days) and binds + applies
splits automatically.

### D. Pending ledger (opt-in)
1. Import bill → enable pending create.
2. Saves merchant, date, total, and category splits as a **manual** transaction
   (`importFingerprint` empty, uncleared, notes `Bill import · pending statement`).
3. Pending rows are **excluded from RTA and account balances** until linked.
4. ING CSV **Link** stamps the fingerprint (bill categories kept; parent
   category stays null when children exist).

## Env

```
GEMINI_API_KEY=...
# optional
GEMINI_MODEL=gemini-3.6-flash
BNAB_RECEIPT_DIR=/opt/bnab/shared/receipts
```

## Agent rules (summary)

- Net amounts after Lidl Plus / PV discounts; skip TVA and payment footers.
- Prefer Clothing / Pets / Education / Household Goods / Tools / Look&Feel / Presents over a single Groceries bucket when the receipt mixes them.
- `categoryHint` must be an existing envelope name — never invent categories.
- Sum of lines must match the bank amount within 2 bani.

See `src/lib/receipt-ai/prompt.ts` for the full system prompt and `default-rules.ts` for Lidl seed mappings.
