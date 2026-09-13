# 0003 — Import rule ≠ Receipt rule ≠ Planned payment

- Status: Accepted
- Date: 2026-09-13

## Context

Three mapping concepts look similar in UI but hit different models and flows.

## Decision

Canonical terms live in [`../import-vocabulary.md`](../import-vocabulary.md):

| Concept | Model | Used by |
|---------|-------|---------|
| Import rule | `ImportCategoryRule` | ING CSV memo → category / transfer / ignore |
| Receipt rule | `ReceiptCategoryRule` | Bill line text → category / ignore |
| Planned payment | `ScheduledTransaction` (evolved) | Recurring ledger expectations; optional link to import rule |

UI copy and code comments must not invent synonyms. Planned payments are **not** bill scans.

## Consequences

- Import history shows **Rule hit** (import rule) and **Planned match** separately.
- Bill AI audit shows **Receipt rule hit** and **Category matched**, not import rules.
