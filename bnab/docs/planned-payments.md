# Planned payments

Recurring ledger expectations (`ScheduledTransaction`), not bill scans.

## Model

| Field | Purpose |
|-------|---------|
| amount, account, category, payee | Same as legacy schedules |
| recurrence | Weekly / Monthly / Yearly (+ Once / Biweekly) |
| nextDate | Next due |
| dayOfMonth / weekday | Anchors for monthly/weekly |
| billingUrl | Optional HTTPS portal |
| importRuleId | Optional link to an **Import rule** |
| Transaction.scheduledTransactionId | Bidirectional link when paid |

## Matching

On ING create/link (and Make planned / Enter): unique match within ±2 bani and ±3 days on the same account. Advances `nextDate`.

## Plan

**Assign from planned** sets `assigned = max(current, plannedMonthTotal)` per spending category for the viewed month.

## UI

- Desktop nav **Planned** → `/planned`
- Legacy `/more/schedules` remains
- Transaction detail: **Make planned payment**

See vocabulary: [import-vocabulary.md](./import-vocabulary.md). ADR: [0003](./adr/0003-import-vs-receipt-vs-planned.md).
