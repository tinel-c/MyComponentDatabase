# Import vocabulary (canonical)

Single source of truth for BNAB UI copy, batch `action` strings, and code comments. **Do not invent synonyms.**

## Do not mix

| This | Is not |
|------|--------|
| Import batch | Bill queue (client multi-upload) |
| Import rule | Receipt rule |
| Planned payment | Pending bill entry |
| Planned payment | Scheduled transaction |
| AI category hint | Category matched |
| Import history item | Bill AI audit |

---

## Core entities

| Term | Definition | Not to confuse with |
|------|------------|---------------------|
| **Import batch** | One ING CSV confirm run (`ImportBatch`); identified by `sourceLabel` | Bill photo batch |
| **Import batch item** | One statement row outcome (`ImportBatchItem`) | Receipt scan line |
| **Ledger transaction** | On-budget bank row (`Transaction`, non-child) | Split child, receipt line |
| **Import rule** | Memo substring → category / transfer / ignore (`ImportCategoryRule`) | Receipt category rule |
| **Receipt rule** | Bill line → category (`ReceiptCategoryRule`) | Import rule |
| **Planned payment** | Contract expectation (`ScheduledTransaction` with `kind=PLANNED`); match on import/manual create; feeds Assign from planned | Scheduled transaction; Pending bill |
| **Scheduled transaction** | Enter template (`kind=SCHEDULED`); optional `autoEnter` catch-up; does **not** assign envelopes or match on import | Planned payment |
| **Bill scan** | Gemini `ReceiptScan` (+ lines); Reflect-first | Import batch |
| **Pending bill entry** | Optional ledger txn with `isPendingBill`, no fingerprint yet | Planned payment |
| **Wish item** | Wish Farm goal (`WishItem`) | Category target |

---

## Import batch outcomes (`action` / UI)

| Code (`action`) | User-facing label | Meaning |
|-----------------|-------------------|---------|
| `created` | **Created** | New ledger transaction from statement row |
| `created_transfer_twin` | **Transfer twin** | Opposite-leg txn for a transfer/hybrid rule |
| `linked_manual` | **Linked existing** | Fingerprint stamped on prior manual/pending bill txn |
| `linked_receipt_scan` | **Linked bill scan** | Auto-bound pending scan |
| `skipped_duplicate` | **Skipped duplicate** | Fingerprint already on account or user skip |
| `ignored` *(stats)* | **Ignored (imported)** | Row imported but RTA-excluded via ignore rule — still a ledger row |

Preview status `ignored` ≠ “not imported”.

---

## Identification / classification (`IdentifiedAs`)

| Code | Label | When |
|------|-------|------|
| `new` | New ledger entry | `created` / twin |
| `linked_existing` | Linked existing payment | `linked_manual` |
| `duplicate` | Already imported | `skipped_duplicate` |
| `rule_category` | Categorized by import rule | Rule mode category |
| `rule_transfer` | Transfer by import rule | Rule mode transfer |
| `rule_hybrid` | Income + transfer twin | category_transfer |
| `rule_ignore` | Ignore-rule (RTA excluded) | ignore mode |
| `planned_match` | Matched planned payment | `scheduledTransactionId` set |
| `unmatched` | No rule / no plan | created with null category and no plan |

---

## Rule hit (import)

| Term | Definition |
|------|------------|
| **Rule hit** | First matching `ImportCategoryRule` (by sortOrder) whose `matchText` is a substring of the memo |
| **No rule hit** | No rule matched |
| **Rule mode** | `ignore` \| `category` \| `transfer` \| `category_transfer` |

---

## Planned payment match

| Term | Definition |
|------|------------|
| **Planned match** | Outflow (ING or manual create) uniquely matched an active planned payment (amount ±2 bani, date ±3 days) and linked `scheduledTransactionId` |
| **Planned satisfied** | Plan’s `nextDate` advanced because this txn paid it |
| **No planned match** | Ambiguous or none — link later from `/planned` |
| **Due planned** | Active schedule with `nextDate` ≤ today (drives desktop nav badge) |

---

## Bill-track terms

| Term | Definition |
|------|------------|
| **Bill queue item** | Client-side multi-upload row (not `ImportBatchItem`) |
| **Scan status** | `queued` / `scanning` / `done` / `needs_mapping` / `preview` / `failed` / `canceled` |
| **Store** | Merchant name from Gemini / `rawJson.merchant` |
| **Purchase date** | Date Gemini read from the receipt |
| **Receipt total** | Bill total (Gemini or sum of lines) |
| **Bill line** | One product/service row from the receipt |
| **Line amount** | Amount for that bill line (bani) |
| **AI category hint** | Raw `categoryHint` from Gemini |
| **Category matched** | Final existing budget category after rules + coerce + fallback |
| **Receipt rule hit** | `ReceiptCategoryRule` that matched the line text (or ignore) |
| **Split child** | Ledger child txn when splits were applied |
| **Linked transaction** | Parent ledger txn bound via `ReceiptScan.transactionId` |
| **Bill link state** | Unlinked · Linked to register · Awaiting ING · Linked to ING |
| **Unlinked bill scan** | Scan with no `transactionId` |
| **AI audit** | UI panel: Store, Bill lines, Category matched, Linked transaction |
| **AI model** | Gemini model id on `ReceiptScan.model` |
