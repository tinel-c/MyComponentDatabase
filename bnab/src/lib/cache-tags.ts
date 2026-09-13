import { cache } from "react";
import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { loadPlanMonth as loadPlanMonthUncached } from "@/lib/plan-data";
import { loadAccountActivitySummaries as loadActivityUncached } from "@/lib/account-activity-summary";

export function planMonthTag(budgetId: string, month: string) {
  return `plan:${budgetId}:${month}`;
}

export function activityTag(budgetId: string, ym: string) {
  return `activity:${budgetId}:${ym}`;
}

export function budgetTag(budgetId: string) {
  return `budget:${budgetId}`;
}

export function invalidateBudgetCaches(budgetId: string) {
  revalidateTag(budgetTag(budgetId), "max");
}

/** Per-request memoization of plan month. */
export const loadPlanMonthCached = cache(async (budgetId: string, month: string) => {
  const cached = unstable_cache(
    () => loadPlanMonthUncached(budgetId, month),
    [`plan-month`, budgetId, month],
    {
      tags: [budgetTag(budgetId), planMonthTag(budgetId, month)],
      revalidate: 60,
    },
  );
  return cached();
});

export const loadAccountActivityCached = cache(async (budgetId: string) => {
  const ym = new Date().toISOString().slice(0, 7);
  const cached = unstable_cache(
    () => loadActivityUncached(prisma, budgetId),
    [`activity`, budgetId, ym],
    {
      tags: [budgetTag(budgetId), activityTag(budgetId, ym)],
      revalidate: 60,
    },
  );
  return cached();
});
