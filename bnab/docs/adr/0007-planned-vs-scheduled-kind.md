# 0007 — Planned vs scheduled: one model, `kind` discriminator

- Status: Accepted
- Date: 2026-09-13

## Context

Planned payments and legacy “schedules” share the same Prisma model (`ScheduledTransaction`). Splitting into two models (e.g. `PlannedPayment` vs `ScheduledTransaction`) would duplicate relations (`Transaction.scheduledTransactionId`, import-rule links, Plan “assign from planned”) for little gain.

## Decision

**Do not split models.** Keep a single `ScheduledTransaction` table with a `ScheduleKind` discriminator:

| `kind` | Meaning |
|--------|---------|
| `PLANNED` (default) | Household planned payment — match, Assign from planned, due badge |
| `SCHEDULED` | Legacy / simple recurring — manual Enter; optional `autoEnter` |

Schema already has `enum ScheduleKind { PLANNED SCHEDULED }` and `kind ScheduleKind @default(PLANNED)` on `ScheduledTransaction` (see [planned-payments.md](../planned-payments.md)).

## Consequences

- Cancel “F2 two models” work.
- New fields stay on `ScheduledTransaction`; filter UI by `kind` instead of adding a parallel table.
- Product terms remain per ADR [0003](./0003-import-vs-receipt-vs-planned.md).
