# Performance

BNAB interaction map and cache contract (ADR 0004).

## Hotspots

1. `loadPlanMonth` — history from firstMonth → viewed month + engine walk
2. Reflect overlapping queries + plan pack
3. Layout `loadAccountActivitySummaries` on every nav
4. `confirmIngImport` per-row writes (batching still improving)
5. Broad `revalidatePath` vs tagged invalidation

## Cache

| Loader | Tags | API |
|--------|------|-----|
| Plan month | `budget:{id}`, `plan:{id}:{month}` | `loadPlanMonthCached` in `src/lib/cache-tags.ts` |
| Activity rail | `budget:{id}`, `activity:{id}:{ym}` | `loadAccountActivityCached` |

Mutations should call `invalidateBudgetCaches(budgetId)` (`revalidateTag(..., "max")`) when plan/activity must refresh.

## Measurement checklist

- [ ] Plan cold load Prisma query count / wall time
- [ ] Reflect uses one plan pack per request
- [ ] Layout streams without blocking forever on activity (Suspense target)
- [ ] Import confirm timing for N ≥ 50 rows

## Phase 2

Next.js 16 Cache Components / full PPR (`use cache`) — not enabled yet.
