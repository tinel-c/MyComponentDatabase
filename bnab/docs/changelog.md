# BNAB changelog

## Unreleased

- **ING transfer mappings:** import rules can target another account; confirm creates a linked transfer pair (statement keeps CSV sign, other account gets the opposite)
- **Collapsible Account activity rail (desktop):** defaults to a narrow icon + counts strip; expand for full labels; preference in `localStorage`
- **ING unmatched rules:** saving a mapping immediately clears every unmatched preview row whose memo contains the substring anywhere (case-insensitive), then refreshes preview
- **UI densify (except Plan):** Excel-style one-line desktop rows for Import/Receipt mappings (actions on the right); compact tokens (`buttonCompactClass`, `inputCompactClass`, `pageStackClass`); denser More lists, Accounts, Reflect, ING/Import bill, and desktop chrome
- **ING ignore = ledger + budget exclude:** confirm always inserts (or links) ignore-matched rows; RTA/Activity skip via `excludeFromRta` on notes — reapply rules without re-importing CSV
- **More → Data (admin):** export/download SQLite (optional gzip), upload/replace DB, selective erase (defaults keep import + receipt mappings)
- Desktop chrome: **ING import** under Import bill; right rail with per-account month bills / manual / ING stats
- **Receipt detailing (Gemini):** upload a bill on a transaction → line items mapped via `ReceiptCategoryRule` → category split children; Reflect receipt-detailed section; More → Receipt mappings
- Plan **Activity** amounts link to `/transactions?categoryId=&month=` (same rows that compose the envelope)
- Reflect chart hover shows top transactions for that slice; receipt-detailed section includes pie + bar charts
- Import bill always shows a success/failure status banner; **Imported bills** (`/more/bills`) lists scans and ING/register linkage
- Deploy: Actions builds `.next` on the runner (no VPS OOM); local `bnab_deploy.py all` pipeline; CI lockfile fixed
- **Import bill** main flow (`/more/import-bill` + desktop nav): photo → match bank txn by date+amount, pick manually, **or create a new entry** (categories now; link later from ING import)
- Full-width desktop chrome for all app pages (not only Plan); mobile-first layouts for More hub, accounts grid, Reflect charts, transaction edit, schedules
- Favicon / PWA icons regenerated as padded envelope mark (fixes green-square tab icon); chrome mark no longer sits in a solid accent tile
- Mobile cards for transactions register, ING import preview, Reflect income table

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
