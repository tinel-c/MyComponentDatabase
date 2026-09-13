# Infinite lists

Canonical contract for BNAB long lists (ADR 0005).

## Rules

- No `?page=` Prev/Next on register-style lists.
- Chunk size: `LIST_PAGE_SIZE` (50) unless a surface documents otherwise (account register may use 40).
- Cursor: `date|id` (or `createdAt|id` / `id` for batch-scoped items) with a stable `orderBy`.
- Filters/search reset to the first chunk (new RSC render).
- Shared UI: `bnab/src/components/ui/InfiniteList.tsx`.
- Helpers: `bnab/src/lib/list-cursor.ts`.

## Surfaces

| Route | Status | Notes |
|-------|--------|-------|
| `/transactions` | Infinite | `date\|id` |
| `/accounts/[id]` | Infinite | Register |
| `/more/bills` | Infinite | Status chips via `?status=` |
| `/more/import-history` | Infinite | Batch list + selected-batch items; item filters `?batch=&q=&rule=&planned=&action=` |
| `/planned` | Sheet | Dense editor; infinite only if needed later |

## Cheap virtualization (`content-visibility`)

Prefer **CSS containment** over a heavy windowing library for register rows:

- `content-visibility: auto` + `containIntrinsicSize` on each list row so off-screen rows skip layout/paint.
- Applied on:
  - `TransactionsRegister` — mobile `<li>` and desktop register `<tr>`
  - `AccountTransactionsInfiniteList` — register `<li>`
  - Plan category mobile rows (same pattern in `PlanCategoryList`)

Do **not** add a full `VirtualizedInfiniteList` / `react-window` stack unless profiling shows `content-visibility` is insufficient (variable-height bill splits, sticky columns, and InfiniteList’s append model fight classic windowing).

## Filters (URL)

Prefer shareable query params + Clear; changing filters resets the infinite cursor.

| Page | Params |
|------|--------|
| `/accounts` | `q`, `type`, `onBudget`, `closed` |
| `/accounts/[id]` | `q`, `categoryId`, `dir`, `from`, `to`, `cleared`, `planned` |
| `/transactions` | `q`, `memo`, `payee`, `accountId`, `categoryId`, `dir`, `from`, `to`, `planned` (linked schedule id), … |
| `/plan` | `month`, `empty`, `focus` (`overspent` \| `underfunded`); focus chips live in the month header |
| `/reflect` | `months`, `month`, `accountId` |
| `/planned` | `id` (highlight sheet row); sheet edits via Save |
| `/more/bills` | `status`, `q` |
| `/more/import-history` | `batch`, `q`, `rule`, `planned`, `action` |
| `/more/categories` | `q`, `hidden`, `income` |
| `/more/payees` | `q` |

## Import history items

- First chunk: `fetchImportBatchItemsChunk` in `src/lib/import-history-items-chunk.ts`
- Load more: `src/app/(app)/more/import-history/load-more.ts`
- UI: `ImportHistoryItemsInfinite`
