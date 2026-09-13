# 0008 — Cache Components phase 2 (Proposed)

- Status: Proposed (blocked)
- Date: 2026-09-13
- Updated: 2026-09-13

## Context

ADR [0004](./0004-tagged-data-cache.md) ships tagged `unstable_cache` + `invalidateBudgetCaches` without enabling Next.js 16 Cache Components / full PPR.

## Attempt (2026-09-13)

Enabled `cacheComponents: true` and migrated plan/activity/register loaders toward `"use cache"` + `cacheTag`. Build failed:

1. Route segment `dynamic` / `runtime` incompatible on `/api/health` and `/api/admin/db-export` (removable).
2. **Blocking:** almost all authenticated routes hit “uncached or runtime data during prerendering” (`cookies()` / auth / layout providers). Fixing requires Suspense shells or `instant = false` across `(app)/*`, not a single Plan-path spike.

Flag left **off**. Bridge remains `unstable_cache` in [`cache-tags.ts`](../../src/lib/cache-tags.ts).

## Decision (still proposed)

Leave `cacheComponents` off until a dedicated milestone:

1. Audit every `(app)` layout/page for cookies/auth boundaries.
2. Wrap dynamic shells in `<Suspense>` (or mark blocking routes).
3. Re-enable flag; migrate plan → activity → register first-page to `"use cache"`.
4. Smoke Plan / Reflect / import / register; then set Status → Accepted.

## Consequences

- Agents must not re-enable `cacheComponents` without clearing the prerender blockers above.
- Performance wins for this milestone come from tip persistence (ADR 0010), register first-page tags, and invalidation completeness — not Cache Components.
