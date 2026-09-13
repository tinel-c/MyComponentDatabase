# Performance

BNAB interaction map and cache contract (ADR 0004).

## Hotspots

1. `loadPlanMonth` — history from firstMonth → viewed month + engine walk
2. Reflect overlapping queries + plan pack (mitigated: shared `loadPlanMonthCached` + pack reuse)
3. Layout `loadAccountActivitySummaries` on every nav (mitigated: Suspense `activitySlot` + lean selects/`groupBy`)
4. `confirmIngImport` row writes batched in `$transaction`; bill-scan auto-link after commit
5. Broad `revalidatePath` vs tagged invalidation (`invalidateBudgetCaches` on plan assign / import confirm / enter scheduled)

## Cache

| Loader | Tags | API |
|--------|------|-----|
| Plan month | `budget:{id}`, `plan:{id}:{month}` | `loadPlanMonthCached` in `src/lib/cache-tags.ts` |
| Engine tip (prefix) | `budget:{id}` | Prefix months via `unstable_cache` in `src/lib/plan-data.ts`; engine `continueFrom` / `heldForNext` |
| Activity rail | `budget:{id}`, `activity:{id}:{ym}` | `loadAccountActivityCached` |

Mutations should call `invalidateBudgetCaches(budgetId)` (`revalidateTag(..., "max")`) when plan/activity must refresh.

Do **not** import `cache-tags` from `plan-data` (circular). Tip cache lives next to the engine walk.

## Measurement checklist

- [ ] Plan cold load Prisma query count / wall time
- [x] Reflect uses one plan pack / tagged plan load per request
- [x] Layout streams without blocking forever on activity (Suspense `activitySlot`)
- [x] Activity summary uses lean finds + aggregates (not full txn payloads)
- [x] Engine can continue from a cached prior-month tip
- [ ] Import confirm timing for N ≥ 50 rows

## Phase 2

Next.js 16 Cache Components / full PPR (`use cache`) — not enabled yet.
