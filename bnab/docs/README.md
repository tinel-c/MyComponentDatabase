# BNAB — Bogza Needs A Budget

YNAB-style **zero-based envelope budgeting** for a two-person household, optimized for mobile. Live target: **https://bnab.bogza.ro**.

## Docs

| Doc | Contents |
|-----|----------|
| [features.md](./features.md) | YNAB-inspired feature checklist (v1 / v2) |
| [envelope-math.md](./envelope-math.md) | Ready to Assign, Available, credit cards, overspending |
| [data-model.md](./data-model.md) | Prisma models, amounts, invariants |
| [deploy.md](./deploy.md) | DNS, nginx, PM2, secrets, Google OAuth |

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

Open [http://localhost:3010](http://localhost:3010) (port 3010 to avoid clashing with part-db on 3000).

### Tests

```bash
cd bnab
npm test          # envelope budget-engine unit tests
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
