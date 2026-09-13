# Planned payments

Recurring ledger expectations (`ScheduledTransaction`), not bill scans.

Canonical terms: [import-vocabulary.md](./import-vocabulary.md). ADR: [0003](./adr/0003-import-vs-receipt-vs-planned.md).

## Kinds

| `kind` | Surface | Role |
|--------|---------|------|
| **PLANNED** (default) | `/planned` | Match on import / manual create; Assign from planned; due nav badge |
| **SCHEDULED** | `/more/schedules` | Manual **Enter** or opt-in **autoEnter** catch-up on app load |

Existing rows migrate as `PLANNED`. `autoEnter` applies only to `SCHEDULED`.

## Model

| Field | Purpose |
|-------|---------|
| kind | `PLANNED` \| `SCHEDULED` |
| autoEnter | Opt-in catch-up for `SCHEDULED` (default false) |
| amount, account, category, payee | Template fields |
| recurrence | Weekly / Monthly / Yearly (+ Once / Biweekly) |
| nextDate | Next due |
| dayOfMonth / weekday | Anchors for monthly/weekly |
| billingUrl | Optional HTTPS portal (PLANNED) |
| importRuleId | Optional link to an **Import rule** (PLANNED) |
| Transaction.scheduledTransactionId | Bidirectional link when paid / entered |

## Matching (PLANNED only)

Unique match within ±2 bani and ±3 days on the same account. Advances `nextDate`.

| Source | When |
|--------|------|
| ING confirm create/link | After row insert / link |
| Manual `createTransaction` | Outflow create (non-transfer) |
| Make planned | Explicit user action → creates `PLANNED` |

Ambiguous matches are left unlinked — resolve later from `/planned`.

## Auto-enter (SCHEDULED)

When `autoEnter=true` and `nextDate ≤ today`, app layout runs catch-up (≤20 per request via `scheduled-auto-enter.ts`): create ledger txn (skip if one already exists for that schedule+date), advance `nextDate`. Manual **Enter** remains available.

## Plan

**Assign from planned** sets `assigned = max(current, plannedMonthTotal)` per spending category for the viewed month — **PLANNED** only (occurrence math in `plan/actions`).

## UI

| Surface | Behavior |
|---------|----------|
| Desktop nav **Planned** | `/planned`; badge = active **PLANNED** with `nextDate ≤ today` |
| `/planned` | Due / upcoming / inactive (**PLANNED** only) |
| `/more/schedules` | **SCHEDULED** list; Enter + autoEnter checkbox |
| `/more/import-rules` | Each rule lists linked planned payments |
| Transaction detail | **Make planned payment** (monthly `PLANNED` + link) |

## Helpers

- `bnab/src/lib/planned-payments.ts` — match + advance date
- `bnab/src/lib/scheduled-auto-enter.ts` — SCHEDULED catch-up
- Tests: `planned-payments.test.ts`
