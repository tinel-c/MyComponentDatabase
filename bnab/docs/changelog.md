# BNAB changelog

## 1.3.1 — 2026-09-13

Plan desktop Income / Savings cards share one visual contract.

### Highlights

- Equal-height stretch (`md:items-stretch`), matching header chrome + subtitle
- Income table columns **Category | Activity** aligned with Savings thead/row density
- Income **Total income** footer mirrors Savings total row

### Docs

`features.md` Plan layout note.

## 1.3.0 — 2026-09-13

Salt Edge Partners AIS scaffold for ING Romania bank sync (API **v6**; Pending Fake OAuth validated).

### Highlights

- Durable reference: `docs/salt-edge-open-banking.md` + ADR **0011** (Partners AIS via **Open Banking Gateway v6**, import-pipeline adapter, PIS gate)
- Models: `BankProviderConnection`, `BankAccountLink`, `Transaction.providerTransactionId`
- v6 client (`/customers`, `/connections/connect|reconnect|refresh`), HTTPS callbacks, `/more/bank-connections`
- AIS normalize → Import rules preview/confirm (`sourceLabel=saltedge`); SQLite snapshot path fix for `prisma/dev.db`
- Enrichment suggestions; RO provider hints; `SALTEDGE_PIS_ENABLED` gate
- **P1 validated locally:** Fake OAuth, map/sync, reconnect consent (refresh cooldown from Salt Edge)

### Docs

Salt Edge dashboard checklist, deploy env secrets, features phased checklist.

## 1.2.6 — 2026-09-13

Plan quick-assign reliability and Income/Savings layout; cache invalidation races closed.

### Highlights

- Plan **+/−/=** and assign cells: optimistic patches; mutations use **uncached** `loadPlanMonth` (not tagged cache)
- `invalidateBudgetCaches` **awaits** durable tip clear so the next plan load cannot continueFrom a stale seed
- `PlanWorkspace` ignores soft RSC refreshes while local dirty (avoids warm cache wiping the first click)
- Desktop Plan: **Income** and **Savings** side-by-side

### Docs

`performance.md` mutation-safety rules.

## 1.2.5 — 2026-09-13

Cache correctness and speed pass: invalidation, durable engine tips, register first-page cache.

### Highlights

- **`invalidateBudgetCaches`** on all money/category/ledger mutations (txn update/delete/split, receipts apply, import revert/reapply, categories, balance adjust, data tools)
- **Durable `EngineMonthTip`** — cold Plan skips full history when tip coverage is complete (ADR 0010)
- **Tagged first-page** caches for transactions / account registers (InfiniteList load-more unchanged)
- Reflect leaner net-worth; parallelized import-history / accounts / seeds; batched assignFromPlanned + scheduled auto-enter
- Cache Components (ADR 0008) attempted; left off — auth prerender blockers documented

### Docs

`performance.md`, ADRs 0004 / 0008 / 0010.

## 1.2.4 — 2026-09-13

Planned sheet Pay cash, category grouping, and register Make planned scroll fix.

### Highlights

- Remove Import rule from Planned payments sheet / create form
- **Pay cash** on due/overdue planned rows: cleared Cash-account ledger txn, link, advance Due
- Planned sheet rows grouped by **category group** (Uncategorized last)
- Make planned on registers keeps scroll / infinite pages (optimistic update; no `/transactions` revalidate)

### Docs

`planned-payments.md`, `features.md` synced.

## 1.2.3 — 2026-09-13

Pay vs assign sinking-fund summary on Planned payments.

### Highlights

- **Pay vs assign summary** on `/planned`: sinking-fund blurb; Pay this month (cash due) vs Assign this month (YEARLY ÷ 12)
- **Assign from planned** uses `plannedMonthlyAssign` (yearly spreads monthly)
- Sheet / create form date labeled **Due**; Executed list restored above the sheet

### Docs

`planned-payments.md`, `features.md` synced.

## 1.2.2 — 2026-09-13

Planned payment sheet editor, register hit links, and current-month Executed list.

### Highlights

- **Planned payments sheet** on `/planned`: dense editable rows (Save), status chips, linked txn **Hits** → `/transactions?planned=`
- **Executed** on `/planned`: current-month ledger txns that hit a planned payment (above the sheet)
- **Register mapping link** `Planned · label` beside Import/Receipt when `scheduledTransactionId` is set
- **Transactions filter** `?planned=` with clear banner

### Docs

`planned-payments.md`, `lists.md`, `features.md` synced.

## 1.2.1 — 2026-09-13

UX polish for Plan filters and transactions register planned actions.

### Highlights

- **Plan focus chips** (All / Overspent / Underfunded / Show empty) moved under the month title so they no longer take a full row between the summary banner and category lists; horizontal scroll on narrow screens
- **Transactions register Actions** column: **Make planned** when eligible, **Edit planned** (→ `/planned?id=…`) when already linked, plus Delete — desktop sheet and mobile cards

### Docs

`features.md`, `planned-payments.md`, `lists.md` synced.

## 1.2.0 — 2026-09-13

Deferred follow-ups: Planned vs Scheduled kind, complete page filters, Wish Farm / loans / Fresh Start, multi-budget switcher.

### Highlights

- **Planned ≠ Scheduled:** `ScheduleKind` on one model; Assign/match = PLANNED; Enter + opt-in `autoEnter` catch-up = SCHEDULED (ADR 0007)
- **URL filters** on accounts, account register, categories, payees, plan (`empty`/`focus`), reflect (`accountId`), import history (`q`/`rule`/`planned`/`action`), bills
- **Account register Planned column** + Make planned; Assign from planned moved into RTA banner; mobile Plan Assign
- **Receipt rule re-apply** on unlinked scans (no Gemini)
- **Wish Farm** (`WishItem`), **loan payoff** estimator, **Fresh Start** wizard
- **Multi-budget** preference cookie (ADR 0009); budget switcher in chrome / More
- **Perf / platform:** `content-visibility` list rows; Cache Components phase 2 ADR 0008 (Proposed); SSO cookie domain notes; Android TWA docs
- **Agent:** post-plan delivery gate (ask → docs → commit → push → release → deploy)

### Docs

ADRs 0007–0009; `android-twa.md`; lists/filters; planned-payments kind matrix.

## 1.1.0 — 2026-09-13

Planned payments, multi-bill batch, infinite lists, tagged caches, and agent architecture memory.

### Highlights

- **Planned payments** (`/planned`): billing URL, import-rule link, due/overdue nav badge, Assign from planned, Make planned payment, ING + **manual create** planned match
- **PlanWorkspace AJAX:** Quick assign / Assign cell patch RTA + Available without full page refresh; pending actions rail
- **Multi-bill batch import:** multi-file queue (scan-only), cancel/retry; expandable **AI audit** on Imported bills; status chips
- **Cursor infinite scroll** on Transactions, Account register, Imported bills, and Import history (batches + batch items)
- **Perf:** Suspense activity rail; lean activity summaries; tagged plan/activity cache; engine tip (`continueFrom` / `heldForNext`); import confirm `$transaction` + deferred receipt auto-link; Reflect reuses plan-pack accounts/categories
- **Agent architecture memory:** `docs/adr/` + `.cursor/rules/bnab-architecture.mdc` + expanded `AGENTS.md`
- **Import vocabulary** (`docs/import-vocabulary.md`) + planned / lists / performance docs
- **Schema:** `Transaction.isPendingBill`, `scheduledTransactionId`; `ScheduledTransaction` billingUrl/importRule; `ImportBatchItem` enrichment fields
- **Import rules UI** shows linked planned payments
- **ING transfer mappings:** import rules can target another account; confirm creates a linked transfer pair
- **Collapsible Account activity rail (desktop)** with preference in `localStorage`
- **ING unmatched rules:** saving a mapping clears sibling unmatched preview rows (substring anywhere, case-insensitive)
- **UI densify (except Plan):** compact tokens and denser More / Accounts / Reflect / import surfaces
- **ING ignore = ledger + budget exclude:** confirm inserts (or links) ignore-matched rows; RTA/Activity skip via `excludeFromRta`
- **More → Data (admin):** export/download SQLite, upload/replace DB, selective erase
- Desktop chrome: **ING import** under Import bill; right rail with per-account month stats
- **Receipt detailing (Gemini):** bill upload → line items via `ReceiptCategoryRule`; Reflect receipt-detailed section
- Plan **Activity** amounts link to filtered transactions; Reflect chart hover shows top transactions
- Import bill status banner; **Imported bills** lists scans and ING/register linkage
- Deploy: Actions builds `.next` on the runner; local `bnab_deploy.py all`; CI lockfile fixed
- Full-width desktop chrome; mobile-first More / accounts / Reflect / transaction edit
- Favicon / PWA icons as padded envelope mark; Install on Android prompt

### Docs

Full docs under [`bnab/docs/`](./README.md). ADRs 0001–0006 (0007+ in 1.2.0).

## 1.0.0 — 2026-09-06

First tagged production release of **Bogza Needs A Budget** (https://bnab.bogza.ro).

### Highlights

- YNAB-style Plan with Ready to Assign, Income, envelopes, move money, and desktop quick-assign (+ / − / =)
- Responsive Plan: full-width desktop; compact single-row mobile (Activity + Available); hide Income / Move money / empty categories on phones
- Accounts, Excel-style transactions register, Reflect reports, household invites
- **ING CSV import**: mapping rules, ignore patterns (excluded from RTA), batches, revert, DB snapshots
- Adjust account to statement balance; delete transactions with confirm
- Brand: envelope mark, favicons, PWA icons, in-app `BnabLogo`
- Deploy: PC `next build` + `ssh_upload_live_next.py` (Prisma overlay + traced client sync) + `ssh_upload_public_brand.py`

### Docs

Full docs under [`bnab/docs/`](./README.md).
