/**
 * Shared Tailwind class strings for form elements and tables.
 * All classes use the semantic theme tokens from globals.css so they
 * automatically update when the user switches themes.
 *
 * AGENT RULE: New form primitives must use bg-canvas / bg-surface / bg-overlay
 * for backgrounds, text-fg / text-fg-muted for text, and border-rim for borders.
 * Use bg-accent / text-accent-fg for primary interactive elements.
 */

export const inputClass =
  "mt-1 w-full rounded-lg border border-rim/80 bg-canvas/60 px-3 py-2 text-sm text-fg shadow-sm outline-none " +
  "placeholder:text-fg-subtle " +
  "focus:border-accent/60 focus:ring-1 focus:ring-accent/30 " +
  "dark:bg-surface/50 transition-colors duration-150";

export const labelClass = "block text-sm font-medium text-fg-muted";

export const buttonPrimaryClass =
  "inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg " +
  "shadow-sm transition-all duration-150 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed";

export const buttonSecondaryClass =
  "inline-flex items-center justify-center rounded-full border border-rim bg-surface px-4 py-2 text-sm font-medium text-fg " +
  "transition-all duration-150 hover:bg-overlay hover:border-rim disabled:opacity-50 disabled:cursor-not-allowed";

export const buttonDangerClass =
  "inline-flex items-center justify-center rounded-full border border-danger/40 bg-danger-muted px-4 py-2 text-sm font-medium text-danger-fg " +
  "transition-all duration-150 hover:bg-danger/20 hover:border-danger/60 disabled:opacity-50";

export const tableClass =
  "w-full border-collapse text-left text-sm text-fg";

export const thClass =
  "border-b border-rim/70 px-3 py-2.5 font-medium text-fg-muted bg-surface/40";

export const tdClass =
  "border-b border-rim-subtle/60 px-3 py-2.5 text-fg";

export const cardClass =
  "rounded-2xl border border-rim/60 bg-surface shadow-sm";

export const sectionHeadingClass =
  "text-2xl font-semibold tracking-tight text-fg";

export const sectionSubheadingClass =
  "mt-1 text-sm text-fg-muted";
