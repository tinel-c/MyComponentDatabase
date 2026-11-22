# 0012 — ANAF taxpayer lookup for Import rule proposals

- Status: Accepted
- Date: 2026-11-22

## Context

Unmatched ING rows need category suggestions. Uncontrolled web scraping is unreliable. Romania’s ANAF exposes a public PlatitorTvaRest v9 API (CUI + date → denumire, CAEN, TVA / e-Factura flags) with ≤100 CUIs/request and 1 req/s.

ANAF cannot search by merchant name. Most ING POS memos lack CUI.

## Decision

1. For unmatched Import preview rows, extract CUI from memo when present and call ANAF v9 server-side.
2. Map `cod_CAEN` → category **name** via a curated table, then resolve to `categoryId` in the budget.
3. Show proposals in the UnmatchedRuleCard only; **never** auto-create `ImportCategoryRule` (ADR 0003).
4. Rows without CUI get heuristic `suggestMatchSubstring` proposals only.
5. Do **not** use SPV / e-Factura OAuth for personal bank import enrichment in this milestone.

## Consequences

- Module: `bnab/src/lib/anaf/`
- Preview may be slower when many unmatched rows carry CUIs (throttled).
- Name-only merchants still require human rule save.
