# Performance

BNAB interaction map and cache contract (ADR 0004 / 0010).

## Hotspots

1. `loadPlanMonth` — history from firstMonth → viewed month + engine walk (mitigated: durable tips + tagged cache)
2. Reflect overlapping queries + plan pack (mitigated: shared `loadPlanMonthCached` + lean net-worth groupBy)
3. Layout `loadAccountActivitySummaries` on every nav (mitigated: Suspense `activitySlot` + lean selects/`groupBy`)
4. `confirmIngImport` row writes batched in `$transaction`; bill-scan auto-link after commit
5. Broad `revalidatePath` vs tagged invalidation (`invalidateBudgetCaches` on money/category mutations)

## Cache

| Loader | Tags | API |
|--------|------|-----|
| Plan month | `budget:{id}`, `plan:{id}:{month}` | `loadPlanMonthCached` in `src/lib/cache-tags.ts` |
| Engine tip (prefix, L1) | `budget:{id}` | Prefix months via `unstable_cache` in `src/lib/plan-data.ts` |
| Engine tip (durable, L2) | cleared with budget invalidate | `EngineMonthTip` + ADR 0010 |
| Activity rail | `budget:{id}`, `activity:{id}:{ym}` | `loadAccountActivityCached` |
| Register first page | `budget:{id}`, `register:{id}:…` | `loadTransactionsRegisterFirstPage` / `loadAccountRegisterFirstPage` (cursor load-more uncached) |

### Invalidation rule

Mutations that change money, categories, or ledger structure **must** call `invalidateBudgetCaches(budgetId)` (`revalidateTag(budget:…, "max")` + clear durable tips).

- **Tags** refresh plan / activity / register first-page / tip caches.
- **`revalidatePath`** for non-tagged surfaces: `/transactions`, `/accounts`, `/planned`, `/more/bills`, import history, forms.
- Also **`revalidatePath("/plan")`** after import confirm / revert / reapply and bank sync — tag bust alone does not refresh a warm client Router Cache for `/plan` after soft navigation.
- Avoid redundant `/reflect` path fans when tags already cover those loaders.

### Mutation safety (avoid double-click / no-op UI)

1. **Never** call `loadPlanMonthCached` / register first-page / activity cached loaders inside a mutation to decide the write. Use uncached `loadPlanMonth` or direct Prisma.
2. **`invalidateBudgetCaches` must be awaited** — it clears durable `EngineMonthTip` rows; fire-and-forget tip clears race the next plan load and can serve a stale `continueFrom`.
3. Plan assign UI applies **optimistic patches** and ignores soft RSC refreshes while local dirty (see `PlanWorkspace`) so a warm tagged cache cannot wipe the first click.

Do **not** import `cache-tags` from `plan-data` (circular). Tip L1 cache lives next to the engine walk.

### Bridge to Cache Components

Until Next.js Cache Components / full PPR is enabled, **`loadPlanMonthCached` + `invalidateBudgetCaches`** remain the production bridge:

- Reads: tagged `unstable_cache` inside `React.cache` (`cache-tags.ts`)
- Writes: `invalidateBudgetCaches` from plan / import / transaction / more / receipt / data actions
- ADR: [0004](./adr/0004-tagged-data-cache.md); Phase 2 enablement: [0008](./adr/0008-cache-components-phase2.md) (**blocked** on auth prerender shells)

## Measurement checklist

- [ ] Plan cold load Prisma query count / wall time (with vs without durable tips)
- [x] Reflect uses one plan pack / tagged plan load per request
- [x] Layout streams without blocking forever on activity (Suspense `activitySlot`)
- [x] Activity summary uses lean finds + aggregates (not full txn payloads)
- [x] Engine can continue from a cached prior-month tip (L1 + durable L2)
- [x] Register first page uses tagged cache; InfiniteList load-more uncached
- [ ] Import confirm timing for N ≥ 50 rows

## Phase 2 — Cache Components (not enabled)

Next.js 16 `cacheComponents` / full PPR (`"use cache"`) is **not** flipped in `next.config.ts`. Attempt documented in ADR 0008: auth/cookie prerender requires Suspense (or blocking) across `(app)/*` before re-enable.

### Enable checklist (when ready)

1. Confirm Next 16.x docs for `cacheComponents` / `"use cache"` on the installed Next version.
2. Wrap auth/cookie dynamic shells in `<Suspense>` (or `instant = false`) for all `(app)` routes.
3. Keep `loadPlanMonthCached` / `invalidateBudgetCaches` working — migrate tags to `cacheTag` without dropping invalidation.
4. Add `cacheComponents: true` in `bnab/next.config.ts` behind a short-lived branch.
5. Convert Plan → activity → register first-page to `"use cache"`; measure vs current `unstable_cache`.
6. Run `npm test` + `npm run build` + smoke Plan / Reflect / import confirm / register scroll.
7. Only then enable on production; update ADR 0008 status to Accepted.
