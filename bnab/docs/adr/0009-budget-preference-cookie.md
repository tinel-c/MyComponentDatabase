# 0009 — Budget preference cookie

- Status: Accepted
- Date: 2026-09-13

## Context

Users can belong to multiple `Budget` rows via `BudgetMember`. `requireBudgetAccess` previously always picked the oldest membership, with no way to switch.

## Decision

Honor an HTTP-only cookie `bnab_budget_id` when the signed-in user is a member of that budget. Otherwise fall back to the earliest membership (then `ensureAdminHouseholdBudget`). The More hub and desktop AppChrome expose a simple `<select>` switcher that sets the cookie and revalidates the layout.

## Consequences

- No new auth tables; preference is client-persisted via cookie.
- Invalid / foreign budget IDs are ignored safely.
- Creating budgets is out of scope for this ADR — only switching among existing memberships.
