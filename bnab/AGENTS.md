<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BNAB agent guide

## Architecture memory (required)

Before changing how subsystems interact, consult:

| Doc | Why |
|-----|-----|
| [docs/adr/README.md](./docs/adr/README.md) | Decision index |
| [docs/import-vocabulary.md](./docs/import-vocabulary.md) | Canonical UI/code terms |
| [docs/performance.md](./docs/performance.md) | Cache tags, engine tip, hotspots |
| [docs/lists.md](./docs/lists.md) | Infinite scroll contract |
| [docs/planned-payments.md](./docs/planned-payments.md) | Planned payments model |
| [docs/receipt-agent.md](./docs/receipt-agent.md) | Bill scans / batch / AI audit |

After shipping an architecture decision, add/update an ADR in the same commit.

## Product invariants

- Envelope math only via `loadPlanMonth` / `budget-engine` (ADR 0001).
- Bill scans are Reflect-first by default (ADR 0002).
- Import rule ≠ Receipt rule ≠ Planned payment ≠ Scheduled transaction (ADR 0003 / 0007).
- Lists use cursor infinite scroll, not `?page=` (ADR 0005).
- Theme semantic tokens only (ADR 0006).

## Delivery

After finishing a plan or major milestone: **ask** the user, then update docs → commit → push → release (when versioned) → deploy (`python deploy/bnab/bnab_deploy.py all`). See `.cursor/rules/post-plan-delivery.mdc`.

Never commit secrets, real ING CSVs, or `deploy/bnab/_diag_*` scripts.
