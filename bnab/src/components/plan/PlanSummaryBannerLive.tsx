"use client";

import { PlanSummaryBanner } from "@/components/plan/PlanSummaryBanner";
import { usePlanWorkspace } from "@/components/plan/PlanWorkspace";

export function PlanSummaryBannerLive({
  incomeToRta,
  toSavings,
  spent,
  month,
}: {
  incomeToRta: number;
  toSavings?: number;
  spent?: number;
  month?: string;
}) {
  const { rta, totalAssigned, currency } = usePlanWorkspace();
  return (
    <PlanSummaryBanner
      rta={rta}
      incomeToRta={incomeToRta}
      toSavings={toSavings}
      totalAssigned={totalAssigned}
      spent={spent}
      currency={currency}
      month={month}
    />
  );
}
