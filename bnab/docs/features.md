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
- [x] Cover overspending / release available / assign all RTA (**Quick** +, −, =) with **PlanWorkspace** AJAX (no full page refresh)
- [x] **Assign from planned** for the viewed month
- [x] Monthly carryover of Available
- [x] Targets: monthly spending, needed by date, weekly, savings balance
- [x] Category icons by name/group
- [x] YNGSB-style starter tree + seeded mapping rules
- [x] **Responsive Plan**
  - Desktop: full width, two-column category groups
  - Mobile: single-row categories (Activity + Available), hide Assigned / Income / Move money
  - Mobile: hide empty categories (0/0/0) with “show empty” toggle
- [x] **Plan focus filters** (`All` / Overspent / Underfunded / empty) in the month header band (not a separate row under the banner)

### Transactions

- [x] Outflow / inflow / transfer
- [x] Payees with autocomplete + last category
- [x] Split transactions
- [x] Cleared / uncleared
- [x] Scheduled / recurring + enter now
- [x] **Planned payments** (`/planned`): Excel sheet editor, **Executed** (current-month hits), billing URL, import-rule link, due nav badge, Hits → filtered transactions, ING + manual match, Make planned payment, Assign from planned
- [x] Search / filter + Excel-style register (**infinite scroll**); filter `?planned=` for linked planned payment
- [x] **Register Actions** — Make planned / Edit planned + Delete (desktop + mobile)
- [x] Register mapping links: Import · / Receipt · / **Planned ·** when linked
- [x] Mobile quick-add / sheet editor
- [x] **Delete transaction** (account list, register, edit sheet) with confirm
- [x] **ING CSV import**
  - Preview unmatched / matched / ignored / duplicates
  - Confirm creates batch + fingerprints (**ignored rows are inserted**, excluded from RTA/Activity via notes); writes batched in `$transaction`
  - Mapping rules CRUD + create-from-unmatched (match = substring **anywhere** in memo, case-insensitive; saving clears sibling unmatched rows)
  - **Transfer mappings**: rule picks the other account → confirm creates linked `transferTwinId` pair (CSV sign on statement account, opposite on the other)
  - Ignore patterns (e.g. credit-line covers) excluded from RTA & Activity without skipping ledger insert
  - Import history: batch + item infinite scroll, enrichment fields, revert, DB snapshots
  - Import rules UI shows linked planned payments
- [x] **Admin Data tools** (`/more/data`): export/import SQLite, selective erase (default keep mappings)
- [x] Desktop chrome: ING under Import bill; **collapsible** Account activity right rail (icons + counts when collapsed); Suspense-streamed activity slot

### Household

- [x] Single shared budget
- [x] **Multi-budget switcher** — cookie `bnab_budget_id` + More / sidebar dropdown
- [x] Invite second user by email
- [x] Roles: ADMIN (invite) / EDITOR (full edit)

### Reflect (reports)

- [x] Spending by category / payee (pie + bars)
- [x] Income vs Expense monthly matrix
- [x] Net Worth over time

### Tools

- [x] **Loan payoff** (`/more/loans`) — tracking liability + APR/payment → months estimate
- [x] **Wish Farm** (`/more/wish-farm`) — goals + Harvest funded progress
- [x] **Fresh Start** (`/more/fresh-start`) — guided selective erase (admin/editor)

### UX / brand

- [x] Mobile bottom tabs: Plan | Txns | Add | Accounts | More
- [x] Desktop sidebar (More with primary nav)
- [x] Theme system (CSS semantic tokens)
- [x] PWA installable + favicon / apple-touch / maskable icons
- [x] **Install on Android** prompt (`beforeinstallprompt` + More card; iOS Add to Home Screen hints)
- [x] Service worker caching for static assets / faster return visits
- [x] BNAB envelope mark + wordmark (`BnabLogo`)
- [x] **Receipt detailing** — Gemini vision bill upload → split children via `ReceiptCategoryRule`
- [x] **Multi-bill batch** + Imported bills **AI audit** + status chips
- [x] Reflect “Receipt-detailed spending” from scan lines; Reflect shares tagged plan pack
- [x] Tagged caches (plan / activity / engine tip) + `invalidateBudgetCaches`
- [x] Agent ADRs + import vocabulary (`docs/adr/`, `docs/import-vocabulary.md`)

---

## Deferred

- [ ] Bank sync / Open Banking / Plaid
- [ ] Multi-currency budgets / FX
- [x] Cross-site SSO cookie domain (`.bogza.ro` via `AUTH_COOKIE_DOMAIN`; see deploy.md) — enable with part-db when ready
- [x] Android TWA docs + assetlinks template (`docs/android-twa.md`)
- [ ] Wish Farm auto-assign from RTA / category Available
- [ ] Mobile inline Assign (currently desktop / edit flows)
