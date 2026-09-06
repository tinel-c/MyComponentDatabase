# BNAB changelog

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
