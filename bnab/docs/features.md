# BNAB feature checklist

Inspired by [YNAB](https://www.ynab.com/features) (Plan / Accounts / Reflect) and open-source envelope tools such as [Actual Budget](https://actualbudget.org/docs/getting-started/envelope-budgeting).

## Methodology

| Concept | BNAB |
|---------|------|
| Zero-based / give every dollar a job | Ready to Assign → categories |
| Envelopes | Categories inside category groups |
| True expenses | Non-monthly categories + targets |
| Age your money | Hold income / budget next month |
| Flexibility | Move money, cover overspending |

---

## v1 (must ship)

### Accounts

- [x] On-budget: checking, savings, cash
- [x] Credit cards with Credit Card Payment category
- [x] Tracking / off-budget (assets & liabilities for net worth)
- [x] Starting balance transactions
- [x] Close / reopen accounts
- [x] Reconcile (cleared vs reconciled)

### Plan (Budget)

- [x] Category groups + categories (reorder, hide, notes)
- [x] Month navigator
- [x] Assigned / Activity / Available columns
- [x] Ready to Assign header (ok / warning / over-assigned)
- [x] Move money between categories
- [x] Cover overspending
- [x] Monthly carryover of Available
- [x] Targets: monthly spending, needed by date, weekly, savings balance
- [x] Default starter groups (Bills, Frequent, Non-Monthly, Goals, Quality of Life, Income)

### Transactions

- [x] Outflow / inflow / transfer
- [x] Payees with autocomplete + last category
- [x] Split transactions
- [x] Cleared / uncleared
- [x] Scheduled / recurring + enter now
- [x] Search / filter
- [x] Mobile quick-add
- [x] CSV import

### Household

- [x] Single shared budget
- [x] Invite second user by email
- [x] Roles: ADMIN (invite) / EDITOR (full edit)

### Reflect (reports)

- [x] Spending by category / payee (pie + bars)
- [x] Income vs Expense monthly matrix
- [x] Net Worth over time

### UX

- [x] Mobile bottom tabs: Plan | Accounts | Add | Reflect | More
- [x] Desktop sidebar
- [x] Theme system (same tokens as part-db)
- [x] PWA installable

---

## v2 (deferred)

- [ ] Bank sync / Open Banking / Plaid
- [ ] Loan payoff / interest tools
- [ ] Multiple budgets or multi-currency budgets
- [ ] Cross-site SSO (`.bogza.ro` cookie)
- [ ] Native Android WebView client
- [ ] Advanced Fresh Start wizard
- [ ] Wish Farm / goal harvesting helpers
