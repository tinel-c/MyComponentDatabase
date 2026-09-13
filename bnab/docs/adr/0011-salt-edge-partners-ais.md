# 0011 — Salt Edge Partners AIS for bank sync

- Status: Proposed
- Date: 2026-09-13

## Context

BNAB ingests bank data only via HomeBank ING CSV. Live open banking needs a regulated AIS path. Obtaining our own PSD2 AISP licence is out of scope for a household envelope app. Salt Edge Partners provides AIS under Salt Edge’s licence ([Partners docs](https://docs.saltedge.com/partners/v1/), [Partner Program](https://www.saltedge.com/products/account_information/partner-program)).

Payment Initiation (PIS) is a separate product/compliance decision — see Phase 4 gate in [salt-edge-open-banking.md](../salt-edge-open-banking.md).

## Decision

1. Integrate **Salt Edge Open Banking Gateway API v6** in **Partners** mode (no own PSD2 AISP licence). Legacy Partners v1 / AIS v5 are retired (`UnsupportedApiVersion`).
2. Target **ING Romania** first; keep HomeBank CSV as permanent fallback.
3. Normalize Salt Edge transactions into the same import pipeline as CSV (`ImportCategoryRule`, overlap/dedupe, planned match, receipt link, `ImportBatch` with `sourceLabel=saltedge`).
4. Store **both** `providerTransactionId` (Salt Edge id) and content `importFingerprint` so CSV and AIS can coexist without double-posting.
5. Persist `BankProviderConnection` + `BankAccountLink`; secrets only in env (`SALTEDGE_*`).
6. Sync via HTTPS callbacks (`/api/saltedge/callbacks/*`) with signature verification; after confirm, `await invalidateBudgetCaches`.

## Consequences

- LIVE access requires Salt Edge Partner review (fake banks, ToS/privacy, 2FA, incident email, request signing).
- Consent reconnect (~90 days) is mandatory UX, not optional.
- Enrichment/merchant ID may **suggest** rules only — never bypass Import rules (ADR 0003).
- PIS stays blocked until an explicit Phase 4 decision.
