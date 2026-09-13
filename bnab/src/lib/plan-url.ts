export type PlanFocusFilter = "underfunded" | "overspent";

export function parsePlanEmpty(raw: string | undefined): boolean {
  return raw === "1";
}

export function parsePlanFocus(
  raw: string | undefined,
): PlanFocusFilter | null {
  if (raw === "underfunded" || raw === "overspent") return raw;
  return null;
}

/** Build `/plan` href preserving month / empty / focus. */
export function planHref(opts: {
  month: string;
  empty?: boolean;
  focus?: PlanFocusFilter | null;
}): string {
  const sp = new URLSearchParams();
  sp.set("month", opts.month);
  if (opts.empty) sp.set("empty", "1");
  if (opts.focus) sp.set("focus", opts.focus);
  return `/plan?${sp.toString()}`;
}

export function rowMatchesPlanFocus(
  focus: PlanFocusFilter | null,
  row: { available: number; activity: number; assigned: number },
): boolean {
  if (!focus) return true;
  if (focus === "overspent") return row.available < 0;
  // underfunded: spending with outflow but nothing assigned yet
  return row.assigned === 0 && row.activity < 0;
}
