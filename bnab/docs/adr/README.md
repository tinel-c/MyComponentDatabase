# Architecture Decision Records (ADR)

BNAB agent memory. **Before implementing a feature that changes how subsystems interact, read this index and the relevant ADRs.** After shipping such a decision, add or update an ADR in the same milestone commit.

| ID | Title | Status |
|----|-------|--------|
| [0001](./0001-envelope-engine-ownership.md) | Envelope budget engine ownership | Accepted |
| [0002](./0002-reflect-first-bills.md) | Reflect-first bill scans | Accepted |
| [0003](./0003-import-vs-receipt-vs-planned.md) | Import rule ≠ Receipt rule ≠ Planned payment | Accepted |
| [0004](./0004-tagged-data-cache.md) | Tagged cache + invalidate on mutation | Accepted |
| [0005](./0005-cursor-infinite-scroll.md) | Cursor infinite scroll for lists | Accepted |
| [0006](./0006-theme-semantic-tokens.md) | Theme semantic tokens only | Accepted |
| [0007](./0007-planned-vs-scheduled-kind.md) | Planned vs scheduled: one model + kind | Accepted |
| [0008](./0008-cache-components-phase2.md) | Cache Components phase 2 | Proposed |
| [0009](./0009-budget-preference-cookie.md) | Multi-budget preference cookie | Accepted |

## Template

```markdown
# NNNN — Title

- Status: Proposed | Accepted | Superseded
- Date: YYYY-MM-DD

## Context
## Decision
## Consequences
```
