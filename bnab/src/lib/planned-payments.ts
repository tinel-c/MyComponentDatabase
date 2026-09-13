/**
 * Planned payment matching: amount ±2 bani, date ±3 days, unique confident match.
 * Pay (cash due) vs Assign (sinking-fund) month totals.
 */

export const PLANNED_AMOUNT_TOLERANCE_BANI = 2;
export const PLANNED_DATE_TOLERANCE_DAYS = 3;

export type PlannedCandidate = {
  id: string;
  accountId: string;
  amount: number;
  nextDate: string;
  active: boolean;
};

export type TxnForPlannedMatch = {
  accountId: string;
  amount: number;
  date: string;
};

export type PlannedMonthParams = {
  amount: number;
  recurrence: string;
  nextDate: string;
  month: string;
  weekday?: number | null;
};

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T12:00:00").getTime();
  const db = new Date(b + "T12:00:00").getTime();
  return Math.abs(Math.round((da - db) / 86_400_000));
}

/** Unique confident match or null if none / ambiguous. */
export function findUniquePlannedMatch(
  txn: TxnForPlannedMatch,
  candidates: PlannedCandidate[],
): string | null {
  const hits = candidates.filter((c) => {
    if (!c.active) return false;
    if (c.accountId !== txn.accountId) return false;
    if (Math.abs(c.amount - txn.amount) > PLANNED_AMOUNT_TOLERANCE_BANI) {
      return false;
    }
    return daysBetween(c.nextDate, txn.date) <= PLANNED_DATE_TOLERANCE_DAYS;
  });
  if (hits.length !== 1) return null;
  return hits[0]!.id;
}

/** Count weekday occurrences of a given weekday (0=Sun) in calendar month YYYY-MM. */
export function weekdayOccurrencesInMonth(month: string, weekday: number): number {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    if (new Date(y, m - 1, d).getDay() === weekday) n++;
  }
  return n;
}

function weeklyCashDue(params: PlannedMonthParams): number {
  const abs = Math.abs(params.amount);
  const sign = params.amount < 0 ? -1 : 1;
  const wd =
    params.weekday ?? new Date(params.nextDate + "T12:00:00").getDay();
  const occ = weekdayOccurrencesInMonth(params.month, wd);
  const step = params.recurrence === "BIWEEKLY" ? 2 : 1;
  const count =
    params.recurrence === "BIWEEKLY" ? Math.ceil(occ / step) : occ;
  return sign * abs * count;
}

/**
 * Cash payment event in `month` (ledger outflow when Due falls in month).
 * YEARLY/ONCE: full amount only when nextDate is in that month.
 */
export function plannedCashDueInMonth(params: PlannedMonthParams): number {
  const abs = Math.abs(params.amount);
  const sign = params.amount < 0 ? -1 : 1;
  switch (params.recurrence) {
    case "WEEKLY":
    case "BIWEEKLY":
      return weeklyCashDue(params);
    case "YEARLY": {
      const nd = params.nextDate.slice(5, 7);
      return nd === params.month.slice(5, 7) ? sign * abs : 0;
    }
    case "ONCE":
      return params.nextDate.startsWith(params.month) ? sign * abs : 0;
    case "MONTHLY":
    default:
      return sign * abs;
  }
}

/**
 * Sinking-fund assign for `month`: set aside toward the next payment.
 * YEARLY spreads as round(|amount| / 12) every month; ONCE only in due month.
 */
export function plannedMonthlyAssign(params: PlannedMonthParams): number {
  const abs = Math.abs(params.amount);
  const sign = params.amount < 0 ? -1 : 1;
  switch (params.recurrence) {
    case "WEEKLY":
    case "BIWEEKLY":
      return weeklyCashDue(params);
    case "YEARLY":
      return sign * Math.round(abs / 12);
    case "ONCE":
      return params.nextDate.startsWith(params.month) ? sign * abs : 0;
    case "MONTHLY":
    default:
      return sign * abs;
  }
}

/** @deprecated Prefer plannedCashDueInMonth — alias for call-site migration. */
export function plannedMonthTotal(params: PlannedMonthParams): number {
  return plannedCashDueInMonth(params);
}

export function advancePlannedDate(
  date: string,
  recurrence: string,
): string {
  const d = new Date(date + "T12:00:00");
  switch (recurrence) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "BIWEEKLY":
      d.setDate(d.getDate() + 14);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      break;
  }
  return d.toISOString().slice(0, 10);
}
