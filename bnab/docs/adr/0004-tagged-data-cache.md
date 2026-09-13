# 0004 — Tagged data cache + invalidate on mutation

- Status: Accepted
- Date: 2026-09-13

## Context

Every navigation reloaded plan history and account activity. Only `React.cache(requireBudgetAccess)` existed; mutations used broad `revalidatePath` fans.

## Decision

1. Wrap `loadPlanMonth` and `loadAccountActivitySummaries` with `unstable_cache` tagged by budget/month.
2. Also wrap loaders in `React.cache` for per-request dedupe.
3. Mutations call `invalidateBudgetCaches(budgetId)` (`revalidateTag`) instead of blasting every path when possible.
4. Do **not** enable Next 16 `cacheComponents` / full PPR in this phase (documented phase 2 in performance.md).

## Consequences

- New data loaders that are expensive should take tags from `bnab/src/lib/cache-tags.ts`.
- Optimistic Plan AJAX still returns patched cells; background invalidation keeps other tabs fresh.
