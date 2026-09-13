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
| nextDate | **Due date** for the next payment |
| dayOfMonth / weekday | Anchors for monthly/weekly |
| billingUrl | Optional HTTPS portal (PLANNED) |
| Transaction.scheduledTransactionId | Bidirectional link when paid / entered |

## Matching (PLANNED only)

Unique match within ±2 bani and ±3 days on the same account. Advances `nextDate`.

| Source | When |
|--------|------|
| ING confirm create/link | After row insert / link |
| Manual `createTransaction` | Outflow create (non-transfer) |
| Make planned | Explicit user action → creates `PLANNED` |

Ambiguous matches are left unlinked — resolve later from `/planned`.

## Pay vs assign (sinking fund)

| Concept | Helper | YEARLY example (12 000) |
|---------|--------|-------------------------|
| **Pay this month** | `plannedCashDueInMonth` | Full **12 000** only in the Due month |
| **Assign this month** | `plannedMonthlyAssign` | **1 000** (`round(amount/12)`) every month |

MONTHLY / WEEKLY / BIWEEKLY: pay and assign use the same occurrence math. ONCE: full amount only in the Due month for both.

Idea: assign monthly into the category (savings), then pay the full bill when Due arrives.

## Auto-enter (SCHEDULED)

When `autoEnter=true` and `nextDate ≤ today`, app layout runs catch-up (≤20 per request via `scheduled-auto-enter.ts`): create ledger txn (skip if one already exists for that schedule+date), advance `nextDate`. Manual **Enter** remains available.

## Plan

**Assign from planned** sets `assigned = max(current, |plannedMonthlyAssign|)` per spending category for the viewed month — **PLANNED** only (`plan/actions`).

## UI

| Surface | Behavior |
|---------|----------|
| Desktop nav **Planned** | `/planned`; badge = active **PLANNED** with `nextDate ≤ today` |
| `/planned` | Summary (pay vs assign); **Executed**; Excel sheet grouped by category group (**Due**, **Pay cash** on due/overdue → Cash account); Hits → `/transactions?planned=` |
| `/more/schedules` | **SCHEDULED** list; Enter + autoEnter checkbox |
| `/more/import-rules` | Each rule lists linked planned payments |
| Transaction detail | **Make planned payment** (monthly `PLANNED` + link) |
| Transactions register | Mapping link **Planned · label** when linked; **Actions**: Make / Edit planned + Delete (Make planned keeps scroll) |
| Account register | Planned column + Make planned (keeps scroll) |

## Helpers

- `bnab/src/lib/planned-payments.ts` — match, advance date, pay/assign month totals
- `bnab/src/lib/scheduled-auto-enter.ts` — SCHEDULED catch-up
- `updatePlannedPayment` / `enterPlannedPaymentFromCash` in `more/actions.ts`
- Tests: `planned-payments.test.ts`
