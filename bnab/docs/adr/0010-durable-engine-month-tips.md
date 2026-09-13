# 0010 — Durable engine month tips

- Status: Accepted
- Date: 2026-09-13

## Context

Tagged in-memory engine prefix tips (ADR 0004) save CPU only. Cold Plan still loaded full transaction history from `firstMonth` through the viewed month.

## Decision

1. Persist each computed `MonthResult` in `EngineMonthTip` (`budgetId`, `month`, JSON `payload`).
2. When tip coverage from `firstMonth`…`prevMonth` is complete, `loadPlanMonth` loads ledger rows only for the tip month and `continueFrom` the durable tip; prior months for Reflect come from stored tips.
3. `invalidateBudgetCaches` clears all tips for the budget (with tag revalidation) so mutations never continue from a stale seed.

## Consequences

- First cold load after deploy or invalidate still walks history and rewrites tips.
- Incomplete tip coverage falls back to the full-history path automatically.
- See [performance.md](../performance.md).
