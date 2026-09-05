# BNAB (Bogza Needs A Budget) — Implementation Plan

YNAB-style envelope budgeting at **bnab.bogza.ro**, sibling to Hobby Warehouse (part-db.bogza.ro).

Detailed docs live under [`bnab/docs/`](./bnab/docs/README.md).

## Status

**v1 implemented** in [`bnab/`](./bnab/): Plan, accounts, transactions, credit-card payment categories, schedules, Reflect reports, team invite, CSV import, PWA, deploy scripts for `bnab.bogza.ro`. See [`bnab/docs/`](./bnab/docs/README.md).

## Defaults

| Decision | Choice |
|----------|--------|
| App | Sibling Next.js app in [`bnab/`](./bnab/) |
| Auth | Auth.js + Google invite-only (same pattern as part-db) |
| DB | Separate SQLite `bnab.db` |
| Household | One shared budget, two editors |
| Entry | Manual + CSV (no bank sync v1) |
| Currency | RON |
| Client | Mobile-first PWA |

## Phases

0. Docs + scaffold (auth, themes, chrome, seed)  
1. Accounts + transactions (transfers, splits, reconcile)  
2. Envelope Plan engine + targets + unit tests  
3. Credit cards + scheduled transactions  
4. Reflect reports  
5. Team invite, CSV, PWA, nginx/PM2/CI  
6. Later: bank sync, SSO, native wrapper  

## Stack

Next.js 16, React 19, Prisma 6, Auth.js 5, Tailwind 4, Zod, Lucide, Recharts.

## Success criteria

1. Two invited users edit the same budget on phones  
2. RTA / Available match engine tests  
3. Credit card spend funds the payment category  
4. Reflect: Spending, Income vs Expense, Net Worth  
5. Live at `https://bnab.bogza.ro` with isolated `bnab.db`  
