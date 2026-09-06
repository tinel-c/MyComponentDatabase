# BNAB feature checklist

Inspired by [YNAB](https://www.ynab.com/features) (Plan / Accounts / Reflect) and open-source envelope tools such as [Actual Budget](https://actualbudget.org/docs/getting-started/envelope-budgeting).

## Methodology

| Concept | BNAB |
|---------|------|
| Zero-based / give every dollar a job | Ready to Assign → categories |
| Envelopes | Categories inside category groups |
| True expenses | Non-monthly categories + targets |
| Age your money | Hold income / budget next month |
| Flexibility | Move money, cover overspending, quick assign |
| Bank import | ING CSV → rules → fingerprints (dedupe) |

---

## Shipped

### Accounts

- [x] On-budget: checking, savings, cash
- [x] Credit cards with Credit Card Payment category
- [x] Tracking / off-budget (assets & liabilities for net worth)
- [x] Starting balance transactions
- [x] Close / reopen / rename accounts
- [x] Reconcile (cleared vs reconciled)
- [x] **Adjust to statement** — one correction txn toward ING/HomeBank balance (positive → Other income / RTA; negative → uncategorized outflow)

### Plan (Budget)

- [x] Category groups + categories (reorder, hide, notes)
- [x] Month navigator
- [x] Assigned / Activity / Available columns (desktop)
- [x] Ready to Assign banner (ok / ready / over-assigned)
- [x] Income section + **Accounts · remaining** (desktop)
- [x] Move money between categories (desktop)
- [x] Cover overspending / release available / assign all RTA (**Quick** +, −, =)
- [x] Monthly carryover of Available
- [x] Targets: monthly spending, needed by date, weekly, savings balance
- [x] Category icons by name/group
- [x] YNGSB-style starter tree + seeded mapping rules
- [x] **Responsive Plan**
  - Desktop: full width, two-column category groups
  - Mobile: single-row categories (Activity + Available), hide Assigned / Income / Move money
  - Mobile: hide empty categories (0/0/0) with “show empty” toggle

### Transactions

- [x] Outflow / inflow / transfer
- [x] Payees with autocomplete + last category
- [x] Split transactions
- [x] Cleared / uncleared
- [x] Scheduled / recurring + enter now
- [x] Search / filter + Excel-style register
- [x] Mobile quick-add / sheet editor
- [x] **Delete transaction** (account list, register, edit sheet) with confirm
- [x] **ING CSV import**
  - Preview unmatched / matched / ignored / duplicates
  - Confirm creates batch + fingerprints
  - Mapping rules CRUD + create-from-unmatched
  - Ignore patterns (e.g. credit-line covers) excluded from RTA & Activity
  - Import history: revert batch, DB snapshots

### Household

- [x] Single shared budget
- [x] Invite second user by email
- [x] Roles: ADMIN (invite) / EDITOR (full edit)

### Reflect (reports)

- [x] Spending by category / payee (pie + bars)
- [x] Income vs Expense monthly matrix
- [x] Net Worth over time

### UX / brand

- [x] Mobile bottom tabs: Plan | Txns | Add | Accounts | More
- [x] Desktop sidebar (More with primary nav)
- [x] Theme system (CSS semantic tokens)
- [x] PWA installable + favicon / apple-touch / maskable icons
- [x] BNAB envelope mark + wordmark (`BnabLogo`)

---

## Deferred

- [ ] Bank sync / Open Banking / Plaid
- [ ] Loan payoff / interest tools
- [ ] Multiple budgets or multi-currency budgets
- [ ] Cross-site SSO (`.bogza.ro` cookie)
- [ ] Native Android WebView client
- [ ] Advanced Fresh Start wizard
- [ ] Wish Farm / goal harvesting helpers
- [ ] Mobile inline Assign (currently desktop / edit flows)
