# BNAB — Bogza Needs A Budget

YNAB-style **zero-based envelope budgeting** for a two-person household, optimized for phone and desktop. Live: **https://bnab.bogza.ro**.

## Docs

| Doc | Contents |
|-----|----------|
| [features.md](./features.md) | Feature checklist (shipped vs deferred) |
| [envelope-math.md](./envelope-math.md) | Ready to Assign, Available, CC payments, import ignores |
| [data-model.md](./data-model.md) | Prisma models, amounts, import batches, invariants |
| [import-vocabulary.md](./import-vocabulary.md) | Canonical import / planned / bill terms |
| [planned-payments.md](./planned-payments.md) | Recurring planned payments |
| [lists.md](./lists.md) | Cursor infinite scroll + `content-visibility` rows |
| [performance.md](./performance.md) | Cache tags, engine tip, Cache Components phase 2 |
| [receipt-agent.md](./receipt-agent.md) | Gemini bill scans, batch queue, AI audit |
| [adr/README.md](./adr/README.md) | Architecture decision records (agent memory) |
| [deploy.md](./deploy.md) | DNS, nginx, PM2, secrets, SSO, **PC build → live upload** |
| [android-twa.md](./android-twa.md) | Trusted Web Activity / Play wrap for bnab.bogza.ro |
| [changelog.md](./changelog.md) | Release notes |

Root charter: [BNAB_IMPLEMENTATION_PLAN.md](../../BNAB_IMPLEMENTATION_PLAN.md).

## Local setup

```bash
cd bnab
cp .env.example .env
# Edit AUTH_* / ADMIN_EMAIL / DATABASE_URL
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open [http://localhost:3010](http://localhost:3010) (port **3010** so it does not clash with part-db on 3000).

### Tests

```bash
cd bnab
npm test          # budget-engine, ING import, planned payments, receipt-ai, …
npm run build     # production build
```

### Auth

Same pattern as Hobby Warehouse (part-db):

- Google OAuth invite-only
- `ADMIN_EMAIL` auto-bootstraps as admin on first sign-in
- Other users must be invited under **More → Team**
- Local-dev Credentials login when `AUTH_URL` is localhost

### Database

Separate SQLite file (never share `warehouse.db`):

```
DATABASE_URL="file:./dev.db"
```

Production: `file:/opt/bnab/shared/bnab.db`.

### Brand

Site mark and PWA icons live under [`public/`](../public/) (`favicon.ico`, `icon.svg`, `icon-192.png`, `icon-512.png`) and [`public/brand/`](../public/brand/). In-app logo: `BnabLogo` / `BnabMark` in [`src/components/brand/`](../src/components/brand/).

### Bank statements

Put real ING CSV exports only under **`bnab/ING/`** (gitignored). Never commit statements. Redacted fixtures belong under tests / docs only.

## App map

| Route | Purpose |
|-------|---------|
| `/plan` | Month envelopes, RTA, assign, quick cover/release, assign from planned (AJAX) |
| `/accounts`, `/accounts/[id]` | Balances, register (infinite scroll), adjust-to-statement |
| `/transactions` | Excel-style global register (infinite scroll) |
| `/planned` | Planned payments (due badge on desktop nav) |
| `/reflect` | Review spend, budget gaps, plan next month (shares plan pack) |
| `/more/import` | ING CSV preview + confirm |
| `/more/import-bill` | Bill photo / multi-bill queue (Reflect-first) |
| `/more/bills` | Imported bills + AI audit (infinite) |
| `/more/import-rules` | Memo → category / ignore / transfer (+ linked planned) |
| `/more/receipt-rules` | Bill line → category |
| `/more/import-history` | Batches, item detail (infinite), revert, snapshots |
| `/more/data` | Admin: DB export / import / selective erase |
| `/more/fresh-start` | Guided Fresh Start selective erase (admin/editor) |
| `/more/loans` | Loan payoff months estimate |
| `/more/wish-farm` | Wish Farm goals + harvest |
| `/more/categories`, `/payees`, `/schedules`, `/team` | CRUD & household |

## Version

See [`package.json`](../package.json) and [changelog.md](./changelog.md). Current: **1.2.0**.
