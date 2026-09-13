# Planned payments

Recurring ledger expectations (`ScheduledTransaction`), not bill scans.

Canonical terms: [import-vocabulary.md](./import-vocabulary.md). ADR: [0003](./adr/0003-import-vs-receipt-vs-planned.md).

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

Unique match within ±2 bani and ±3 days on the same account. Advances `nextDate`.

| Source | When |
|--------|------|
| ING confirm create/link | After row insert / link |
| Manual `createTransaction` | Outflow create (non-transfer) |
| Make planned / Enter | Explicit user action |

Ambiguous matches are left unlinked — resolve later from `/planned`.

## Plan

**Assign from planned** sets `assigned = max(current, plannedMonthTotal)` per spending category for the viewed month (occurrence math in `plan/actions`).

## UI

| Surface | Behavior |
|---------|----------|
| Desktop nav **Planned** | `/planned`; badge = count of active schedules with `nextDate ≤ today` |
| `/planned` | Due / upcoming / inactive; vocab note; link to legacy schedules |
| `/more/import-rules` | Each rule lists linked planned payments |
| Transaction detail | **Make planned payment** (monthly template + link) |
| Legacy `/more/schedules` | Still available |

## Helpers

- `bnab/src/lib/planned-payments.ts` — match + advance date
- Tests: `planned-payments.test.ts`
