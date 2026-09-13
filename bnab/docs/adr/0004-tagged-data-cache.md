# 0004 — Tagged data cache + invalidate on mutation

- Status: Accepted
- Date: 2026-09-13

## Context

Every navigation reloaded plan history and account activity. Only `React.cache(requireBudgetAccess)` existed; mutations used broad `revalidatePath` fans.

## Decision

1. Wrap `loadPlanMonth` and `loadAccountActivitySummaries` with `unstable_cache` tagged by budget/month.
2. Also wrap loaders in `React.cache` for per-request dedupe.
3. Cache engine **prefix tip** months in `plan-data.ts` (tag `budget:{id}`) and pass `continueFrom` / `heldForNext` into `computeBudgetMonths` so viewing month N does not always replay 1…N-1 from scratch.
4. Mutations call `invalidateBudgetCaches(budgetId)` (`revalidateTag(..., "max")`) instead of blasting every path when possible.
5. Do **not** enable Next 16 `cacheComponents` / full PPR in this phase (documented phase 2 in performance.md).

## Consequences

- New data loaders that are expensive should take tags from `bnab/src/lib/cache-tags.ts` (except the tip cache, which stays in `plan-data` to avoid circular imports).
- Optimistic Plan AJAX still returns patched cells; background invalidation keeps other tabs fresh.
- Activity rail uses lean Prisma selects/`groupBy` under the same tags (see [performance.md](../performance.md)).
