# Data model

Prisma + SQLite. Amounts are **integers in minor units** (bani). Never store Available as source of truth — the budget engine derives it.

## Auth (Auth.js)

Same shapes as part-db: `User`, `Account` (OAuth), `Session`, `VerificationToken`.

| Field | Notes |
|-------|-------|
| `User.role` | `ADMIN` \| `USER` (app-level; invite management) |
| Invite gate | Email must exist, or match `ADMIN_EMAIL` |

## Domain

| Model | Purpose |
|-------|---------|
| `Budget` | name, `currency` (default `RON`), `firstMonth` (`YYYY-MM`) |
| `BudgetMember` | `userId`, `role` (`ADMIN` \| `EDITOR`) |
| `FinanceAccount` | Bank/cash/credit/tracking account (`type`, `onBudget`, `closed`, optional `creditCategoryId`) |
| `CategoryGroup` | Envelope group; `isIncome`, `hidden`, `sortOrder` |
| `Category` | Envelope; `isIncome`, `hidden`, `isSystem`, `systemKey`, `accountId` (CC payment) |
| `MonthlyCategoryBudget` | `month`, `assigned`, unique `(categoryId, month)` |
| `CategoryTarget` | target type + amount + due |
| `Payee` | name, `lastCategoryId` |
| `Transaction` | date, amount, account, payee, category, cleared, transfer twin, split parent |
| `ScheduledTransaction` | recurrence, next date, template fields |
| `MonthMeta` | optional notes / hold-for-next-month flag |

## Account types

`CHECKING` | `SAVINGS` | `CASH` | `CREDIT_CARD` | `TRACKING_ASSET` | `TRACKING_LIABILITY`

- On-budget: checking, savings, cash, credit card  
- Off-budget / tracking: asset & liability (net worth only)

## Transaction invariants

1. Split **parent** has `isParent=true`, `amount` = sum of children, no category.
2. Split **children** reference `parentId`, have categories, no nested splits.
3. Transfers: two rows linked by `transferTwinId`; categories null (CC payment availability handled in engine).
4. Starting balance: `isStartingBalance=true`, usually cleared.
5. Only non-parent, on-budget, categorized txs affect Activity.

## Indexes

- `Transaction(accountId, date)`
- `Transaction(categoryId, date)`
- `MonthlyCategoryBudget(categoryId, month)` unique
- `BudgetMember(budgetId, userId)` unique
