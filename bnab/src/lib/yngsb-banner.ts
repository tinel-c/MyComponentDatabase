import type { MonthResult } from "@/lib/budget-engine";

/** YNGSB sheet header metrics (Code.gs populateFormulasMonthColumns). */
export type YngsbBannerMetrics = {
  notBudgeted: number;
  spent: number;
  remaining: number;
  overallIncome: number;
  budgeted: number;
  available: number;
};

/**
 * Sheet formulas (per month):
 * - Not Budgeted = previous month Available (0 for first month)
 * - Spent = sum of category-group Out totals (spending activity as positive)
 * - Remaining = NotBudgeted - Spent + OverallIncome
 * - Overall income = income to budget
 * - Budgeted = sum of Budget column (total assigned)
 * - Available = OverallIncome - Budgeted + NotBudgeted
 */
export function computeYngsbBanner(
  plan: MonthResult,
  spendingCategoryIds: string[],
  previousAvailable = 0,
): YngsbBannerMetrics {
  const overallIncome = plan.incomeToRta;
  const budgeted = plan.totalAssigned;
  const activitySum = spendingCategoryIds.reduce(
    (sum, id) => sum + (plan.categories[id]?.activity ?? 0),
    0,
  );
  // Activity is signed (outflow negative); Spent is positive outflow total.
  const spent = -activitySum;
  const notBudgeted = previousAvailable;
  const remaining = notBudgeted - spent + overallIncome;
  const available = overallIncome - budgeted + notBudgeted;
  return {
    notBudgeted,
    spent,
    remaining,
    overallIncome,
    budgeted,
    available,
  };
}

/** Walk months in order so Not Budgeted carries prior Available. */
export function computeYngsbBannerChain(
  months: MonthResult[],
  spendingCategoryIds: string[],
): Map<string, YngsbBannerMetrics> {
  const map = new Map<string, YngsbBannerMetrics>();
  let prevAvailable = 0;
  for (const m of months) {
    const metrics = computeYngsbBanner(m, spendingCategoryIds, prevAvailable);
    map.set(m.month, metrics);
    prevAvailable = metrics.available;
  }
  return map;
}
