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
| `/more/import-history` | Infinite | Batch list + selected-batch items (`ImportHistoryItemsInfinite`) |
| `/planned` | Short list | Infinite only if needed later |

## Import history items

- First chunk: `fetchImportBatchItemsChunk` in `src/lib/import-history-items-chunk.ts`
- Load more: `src/app/(app)/more/import-history/load-more.ts`
- UI: `ImportHistoryItemsInfinite`
