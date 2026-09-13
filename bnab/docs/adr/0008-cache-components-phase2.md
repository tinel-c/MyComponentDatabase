# 0008 — Cache Components phase 2 (Proposed)

- Status: Proposed
- Date: 2026-09-13

## Context

ADR [0004](./0004-tagged-data-cache.md) ships tagged `unstable_cache` + `invalidateBudgetCaches` without enabling Next.js 16 Cache Components / full PPR. `bnab/next.config.ts` already has safe experimental knobs (`serverActions.bodySizeLimit`, `optimizePackageImports`) but **not** `cacheComponents`.

## Decision (proposed)

Leave `cacheComponents` off until the checklist in [performance.md](../performance.md) Phase 2 is completed on a branch. The bridge until then:

| Concern | Today |
|---------|--------|
| Plan / Reflect reads | `loadPlanMonthCached` |
| Mutation freshness | `invalidateBudgetCaches(budgetId)` |
| Engine prefix | tip cache in `plan-data.ts` |

When enabling:

1. Flip `experimental.cacheComponents` (or current Next flag) only after a Plan-path `"use cache"` spike.
2. Preserve tag semantics equivalent to `budget:{id}` / `plan:{id}:{month}`.
3. Document any API rename from `unstable_cache` / `revalidateTag(..., "max")` in this ADR and set Status → Accepted.

## Consequences

- No production behavior change from this ADR.
- Agents must not enable `cacheComponents` “because Next 16” without the measurement checklist.
