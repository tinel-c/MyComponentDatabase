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

### Bridge to Cache Components

Until Next.js Cache Components / full PPR is enabled, **`loadPlanMonthCached` + `invalidateBudgetCaches`** remain the production bridge:

- Reads: tagged `unstable_cache` inside `React.cache` (`cache-tags.ts`)
- Writes: `invalidateBudgetCaches` from plan / import / transaction / more actions
- ADR: [0004](./adr/0004-tagged-data-cache.md); Phase 2 enablement: [0008](./adr/0008-cache-components-phase2.md)

## Measurement checklist

- [ ] Plan cold load Prisma query count / wall time
- [x] Reflect uses one plan pack / tagged plan load per request
- [x] Layout streams without blocking forever on activity (Suspense `activitySlot`)
- [x] Activity summary uses lean finds + aggregates (not full txn payloads)
- [x] Engine can continue from a cached prior-month tip
- [ ] Import confirm timing for N ≥ 50 rows

## Phase 2 — Cache Components (not enabled)

Next.js 16 `experimental.cacheComponents` / full PPR (`"use cache"`) is **not** flipped in `next.config.ts` (only safe knobs today: `serverActions.bodySizeLimit`, `optimizePackageImports`). See [ADR 0008](./adr/0008-cache-components-phase2.md).

### Enable checklist (when ready)

1. Confirm Next 16.x docs for `cacheComponents` / `"use cache"` on the installed Next version.
2. Keep `loadPlanMonthCached` / `invalidateBudgetCaches` working — migrate tags to the Cache Components API without dropping invalidation.
3. Add `experimental: { cacheComponents: true }` (or successor flag) in `bnab/next.config.ts` behind a short-lived branch.
4. Convert one cold path first (Plan month RSC) to `"use cache"` + tag; measure vs current `unstable_cache`.
5. Audit dynamic APIs (`cookies`, `headers`, `auth()`) — wrap or pass args so cached segments stay static where intended.
6. Run `npm test` + `npm run build` + smoke Plan / Reflect / import confirm.
7. Only then enable on production; update ADR 0008 status to Accepted.
