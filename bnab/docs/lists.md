# Infinite lists

Canonical contract for BNAB long lists (ADR 0005).

## Rules

- No `?page=` Prev/Next on register-style lists.
- Chunk size: `LIST_PAGE_SIZE` (50) unless a surface documents otherwise (account register may use 40).
- Cursor: `date|id` with `orderBy: [{ date: "desc" }, { id: "desc" }]`.
- Filters/search reset to the first chunk (new RSC render).
- Shared UI: `bnab/src/components/ui/InfiniteList.tsx`.
- Helpers: `bnab/src/lib/list-cursor.ts`.

## Surfaces

| Route | Status |
|-------|--------|
| `/transactions` | Infinite |
| `/accounts/[id]` | Infinite |
| `/more/bills` | Infinite |
| `/more/import-history` | Infinite (batches + batch items) |
| `/planned` | Usually short; infinite if needed later |
