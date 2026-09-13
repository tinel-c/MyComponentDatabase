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
| `WishItem` | Wish Farm goal: `name`, `amountCents`, `fundedCents`, `sortOrder`, optional `notes` |
| `FinanceAccount` | Bank/cash/credit/tracking (`type`, `onBudget`, `closed`, optional `creditCategoryId`) |
| `CategoryGroup` | Envelope group; `isIncome`, `hidden`, `sortOrder` |
| `Category` | Envelope; `isIncome`, `hidden`, `isSystem`, `systemKey`, link to CC payment |
| `MonthlyCategoryBudget` | `month`, `assigned`, unique `(categoryId, month)` |
| `CategoryTarget` | target type + amount + due |
| `Payee` | name, `lastCategoryId` |
| `Transaction` | date, amount, account, payee, category, cleared, transfer twin, split parent; optional `isPendingBill`, `scheduledTransactionId`, import fingerprints |
| `ScheduledTransaction` | Recurring template with `kind` (`PLANNED` \| `SCHEDULED`), recurrence, next date, optional `billingUrl` / `importRuleId` / `autoEnter` — one model, not two (ADR 0007) |
| `MonthMeta` | optional notes / hold-for-next-month flag |

## ING import

| Model | Purpose |
|-------|---------|
| `ImportCategoryRule` | Budget-scoped memo `matchText` → **category**, **ignore**, or **transfer** (`transferAccountId`). Match is **substring anywhere** in notes/memo (case-insensitive). Ignore still **creates** ledger rows; budget math uses `excludeFromRta`. Transfer creates a `transferTwinId` pair (statement account keeps CSV sign; other account gets the opposite). May own linked **planned payments** via `schedules`. |
| `ImportBatch` | One CSV confirm run (account, filename, counts, optional snapshot path) |
| `ImportBatchItem` | Per-row outcome (`action`) plus enrichment: `importRuleId`, `scheduledTransactionId`, `classification` (see [import-vocabulary.md](./import-vocabulary.md)) |
| `Transaction.importFingerprint` | Dedupe key per account (`@@unique([accountId, importFingerprint])`) |
| `Transaction.importContentHash` | Content hash for change detection |
| `Transaction.importBatchId` | Link to batch for revert |
| `Transaction.isPendingBill` | Opt-in pending bill ledger; excluded from RTA/balances until linked |
| `Transaction.scheduledTransactionId` | Link to satisfied planned payment |

Snapshots of `bnab.db` before import live under `bnab/data/snapshots/` (gitignored) or `/opt/bnab/shared/snapshots` in production.

## Bill scans (receipts)

| Model | Purpose |
|-------|---------|
| `ReceiptCategoryRule` | Bill line text → category / ignore |
| `ReceiptScan` | Gemini scan (+ lines, model, optional `transactionId`) |

See [receipt-agent.md](./receipt-agent.md) and ADR [0002](./adr/0002-reflect-first-bills.md).

## Account types

`CHECKING` | `SAVINGS` | `CASH` | `CREDIT_CARD` | `TRACKING_ASSET` | `TRACKING_LIABILITY`

- On-budget: checking, savings, cash, credit card  
- Off-budget / tracking: asset & liability (net worth only)

## Transaction invariants

1. Split **parent** has `isParent=true`, `amount` = sum of children, no category.
2. Split **children** reference `parentId`, have categories, no nested splits.
3. Transfers: two rows linked by `transferTwinId`; categories null (CC payment availability handled in engine).
4. Starting balance: `isStartingBalance=true`, usually cleared.
5. Only non-parent, on-budget, categorized txs affect Activity — unless `excludeFromRta` (engine flag for import-ignored memos). Account **balances include** ignored rows.
6. Pending bill rows (`isPendingBill`) are excluded from RTA and balances until linked (fingerprint / scan bind).
7. Deleting a parent deletes children; deleting a transfer clears twin links then deletes both.

## Admin data tools

`/more/data` (ADMIN): download live SQLite (optional gzip), replace from upload (snapshot first), selective erase with flags that default to **keeping** `ImportCategoryRule` and `ReceiptCategoryRule`.

`/more/fresh-start` (budget ADMIN/EDITOR): same selective-erase engine via a guided wizard.

Active budget preference: HTTP-only cookie `bnab_budget_id` (see [ADR 0009](./adr/0009-budget-preference-cookie.md)).

## Indexes

- `Transaction(accountId, date)`
- `Transaction(categoryId, date)`
- `Transaction(accountId, importFingerprint)` unique (nullable fingerprint allowed once per null semantics of SQLite)
- `ScheduledTransaction(budgetId, nextDate)`
- `MonthlyCategoryBudget(categoryId, month)` unique
- `BudgetMember(budgetId, userId)` unique
- `ImportCategoryRule(budgetId, matchText)` (see schema for exact unique constraints)
- `ImportBatchItem(batchId)` (+ optional rule / planned indexes)
