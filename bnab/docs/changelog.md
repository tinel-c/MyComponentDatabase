# BNAB changelog

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
