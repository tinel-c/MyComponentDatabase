# 0006 — Theme semantic tokens only

- Status: Accepted
- Date: 2026-09-13

## Context

BNAB shares the Hobby Warehouse multi-theme CSS variable system. Hardcoded zinc/emerald/dark: utilities break themes.

## Decision

New UI uses semantic Tailwind classes (`bg-canvas`, `bg-surface`, `text-fg`, `border-rim`, `bg-accent`, …) and shared strings from `field-classes.ts`. See workspace rule `.cursor/rules/theme-system.mdc`.

## Consequences

- No `bg-zinc-*`, `text-emerald-*`, `dark:bg-*`, or raw `bg-white`/`text-black` in new BNAB UI.
- Lucide icons: `text-fg-muted` or `style={{ color: "var(--accent)" }}`.
