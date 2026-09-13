# 0005 — Cursor infinite scroll for lists

- Status: Accepted
- Date: 2026-09-13

## Context

Transactions and account registers used `?page=` Prev/Next. Bills and import history used hard `take` caps that felt truncated.

## Decision

All long BNAB lists use **cursor-based infinite scroll** via shared `InfiniteList` + load-more server actions. Drop `page` query params. Cursor is `(date, id)` (or equivalent stable pair), chunk size ≈ 40–50. Surfaces include transactions, account register, imported bills, and import-history batches **and** batch items.

## Consequences

- New list UIs must not introduce offset pagination.
- Filters reset the list to the first chunk.
- Contract documented in [`../lists.md`](../lists.md).
- Virtualized windowing deferred until a list regularly exceeds ~2k rows.
