# 0002 — Reflect-first bill scans

- Status: Accepted
- Date: 2026-09-13

## Context

Gemini bill import can create ledger rows before the bank statement arrives, which double-counts spend and confuses RTA.

## Decision

Default bill import is **scan-only**: create `ReceiptScan` (+ lines), show insights on Reflect, and link to a ledger transaction when ING/manual outflow matches. Creating a pending ledger entry is an explicit opt-in.

## Consequences

- Pending bill ledger rows (when used) must be excluded from RTA/balances until linked (`isPendingBill` / pending-bill helpers).
- Vocabulary: **Bill scan** ≠ **Pending bill entry** ≠ **Import batch**.
- Auto-link runs after ING/manual outflows, not as the primary create path.
