export const inputClass =
  "mt-1 w-full rounded-lg border border-rim/80 bg-canvas/60 px-3 py-2.5 text-base sm:text-sm text-fg shadow-sm outline-none " +
  "placeholder:text-fg-subtle " +
  "focus:border-accent/60 focus:ring-1 focus:ring-accent/30 " +
  "transition-colors duration-150";

/** Dense inline inputs for spreadsheet-style rows (no label margin). */
export const inputCompactClass =
  "box-border h-8 w-full min-w-0 rounded-md border border-rim/70 bg-canvas/50 px-2 text-sm text-fg outline-none " +
  "placeholder:text-fg-subtle " +
  "focus:border-accent/60 focus:ring-1 focus:ring-accent/30 " +
  "transition-colors duration-150";

export const labelClass = "block text-sm font-medium text-fg-muted";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export const buttonPrimaryClass =
  `inline-flex items-center justify-center rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg ` +
  `shadow-sm transition-all duration-150 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed min-h-11 ${focusRing}`;

export const buttonSecondaryClass =
  `inline-flex items-center justify-center rounded-full border border-rim bg-surface px-4 py-2.5 text-sm font-medium text-fg ` +
  `transition-all duration-150 hover:bg-overlay hover:border-rim disabled:opacity-50 disabled:cursor-not-allowed min-h-11 ${focusRing}`;

export const buttonDangerClass =
  `inline-flex items-center justify-center rounded-full border border-danger/40 bg-danger-muted px-4 py-2.5 text-sm font-medium text-danger-fg ` +
  `transition-all duration-150 hover:bg-danger/20 hover:border-danger/60 disabled:opacity-50 min-h-11 ${focusRing}`;

/** Row / toolbar actions — compact, not pill CTAs. */
export const buttonCompactClass =
  `inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-rim bg-surface px-2.5 text-xs font-medium text-fg ` +
  `transition-colors duration-150 hover:bg-overlay hover:border-rim disabled:opacity-50 ${focusRing}`;

export const buttonCompactDangerClass =
  `inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-danger/40 bg-danger-muted px-2.5 text-xs font-medium text-danger-fg ` +
  `transition-colors duration-150 hover:bg-danger/20 disabled:opacity-50 ${focusRing}`;

export const cardClass =
  "rounded-2xl border border-rim/60 bg-surface shadow-sm";

/** List / filter chrome with tighter padding. */
export const cardCompactClass =
  "rounded-xl border border-rim/60 bg-surface shadow-sm";

/** Default page vertical rhythm (denser than legacy space-y-6). */
export const pageStackClass = "space-y-4";

export const sectionHeadingClass =
  "text-2xl font-semibold tracking-tight text-fg";

export const sectionSubheadingClass =
  "mt-1 text-sm text-fg-muted";

/** Tabular money figures — scannable columns (fintech UX best practice). */
export const moneyClass = "font-mono tabular-nums tracking-tight";

export const tableClass = "w-full text-left text-sm";

export const thClass = "py-2 pr-3 font-medium text-fg-muted";

export const tdClass = "py-2 pr-3 text-fg";

/** Compact sticky sheet header for rule / list tables. */
export const denseThClass =
  "sticky top-0 z-10 border-b border-rim bg-overlay/95 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-fg-muted backdrop-blur-sm";

export const denseTdClass = "border-b border-rim-subtle px-2 py-1 align-middle";

export const chipClass =
  "inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-medium text-accent";

export const chipMutedClass =
  "inline-flex items-center gap-1 rounded-full bg-overlay px-2.5 py-0.5 text-xs font-medium text-fg-muted";
