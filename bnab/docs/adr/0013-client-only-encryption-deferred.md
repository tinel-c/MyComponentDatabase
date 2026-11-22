# 0013 — Client-only database encryption (deferred)

- Status: Proposed (deferred)
- Date: 2026-11-22

## Context

A desire for “encrypted at rest so only the client can decrypt” conflicts with BNAB’s current architecture: server Prisma + SQLite, Auth.js JWT, Plan / Reflect / import all server-side.

## Decision

**Defer** end-to-end client-only decrypt. Keep plaintext SQLite on the server (prod: `/opt/bnab/shared/bnab.db`) behind authz.

Possible later paths (not chosen now):

- Server at-rest encryption (SQLCipher / volume encrypt) with a **server-held** key — protects disk/backups, not the running app.
- Local-first encrypted store — requires rewriting engine, import, and loaders for the browser.

## Consequences

- No schema or deploy change in this milestone.
- Revisit only with an explicit product decision and migration plan.
