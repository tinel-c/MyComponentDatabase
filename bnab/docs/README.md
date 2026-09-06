# BNAB — Bogza Needs A Budget

YNAB-style **zero-based envelope budgeting** for a two-person household, optimized for phone and desktop. Live: **https://bnab.bogza.ro**.

## Docs

| Doc | Contents |
|-----|----------|
| [features.md](./features.md) | Feature checklist (shipped vs deferred) |
| [envelope-math.md](./envelope-math.md) | Ready to Assign, Available, CC payments, import ignores |
| [data-model.md](./data-model.md) | Prisma models, amounts, import batches, invariants |
| [deploy.md](./deploy.md) | DNS, nginx, PM2, secrets, **PC build → live upload** |
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
npm test          # budget-engine, ING import parser, banner helpers
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
| `/plan` | Month envelopes, RTA, assign, quick cover/release |
| `/accounts`, `/accounts/[id]` | Balances, register, adjust-to-statement, delete txn |
| `/transactions` | Excel-style global register |
| `/reflect` | Spending / income / net worth |
| `/more/import` | ING CSV preview + confirm |
| `/more/import-rules` | Memo → category mapping (+ ignore patterns) |
| `/more/import-history` | Batches, revert, snapshots |
| `/more/categories`, `/payees`, `/schedules`, `/team` | CRUD & household |

## Version

See [`package.json`](../package.json) and [changelog.md](./changelog.md).
