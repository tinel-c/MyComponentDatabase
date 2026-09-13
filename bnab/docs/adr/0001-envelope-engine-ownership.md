# 0001 — Envelope budget engine ownership

- Status: Accepted
- Date: 2026-09-13

## Context

Plan and Reflect need consistent Ready to Assign, Available, and category month math. Loading raw Prisma rows in each page diverged and duplicated work.

## Decision

All envelope math for a viewed month goes through `computeBudgetMonths` in `bnab/src/lib/budget-engine/` fed by `loadPlanMonth` in `bnab/src/lib/plan-data.ts`. Pages and actions must not reimplement RTA/Available.

## Consequences

- Mutations that change assignments or transactions invalidate plan caches (see ADR 0004).
- Reflect should consume the plan pack rather than re-query overlapping history when possible.
- Engine correctness tests live in `budget-engine/index.test.ts`.
