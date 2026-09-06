# BNAB changelog

## Unreleased

- **Receipt detailing (Gemini):** upload a bill on a transaction → line items mapped via `ReceiptCategoryRule` → category split children; Reflect receipt-detailed section; More → Receipt mappings
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
