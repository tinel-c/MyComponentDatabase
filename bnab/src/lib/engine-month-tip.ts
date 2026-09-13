import type { MonthResult } from "@/lib/budget-engine";
import { prisma } from "@/lib/prisma";

function isCategoryMonth(
  v: unknown,
): v is MonthResult["categories"][string] {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.categoryId === "string" &&
    typeof o.assigned === "number" &&
    typeof o.activity === "number" &&
    typeof o.ccFundingIn === "number" &&
    typeof o.available === "number" &&
    typeof o.overspent === "boolean"
  );
}

export function serializeMonthTip(result: MonthResult): string {
  return JSON.stringify(result);
}

export function parseMonthTip(payload: string): MonthResult | null {
  try {
    const raw = JSON.parse(payload) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    if (typeof o.month !== "string") return null;
    if (typeof o.rta !== "number") return null;
    if (typeof o.incomeToRta !== "number") return null;
    if (typeof o.toSavings !== "number") return null;
    if (typeof o.totalAssigned !== "number") return null;
    if (typeof o.cashOverspendDebt !== "number") return null;
    if (!o.categories || typeof o.categories !== "object") return null;
    const categories: MonthResult["categories"] = {};
    for (const [k, v] of Object.entries(
      o.categories as Record<string, unknown>,
    )) {
      if (!isCategoryMonth(v)) return null;
      categories[k] = v;
    }
    return {
      month: o.month,
      rta: o.rta,
      incomeToRta: o.incomeToRta,
      toSavings: o.toSavings,
      totalAssigned: o.totalAssigned,
      cashOverspendDebt: o.cashOverspendDebt,
      categories,
      heldForNext:
        typeof o.heldForNext === "number" ? o.heldForNext : undefined,
    };
  } catch {
    return null;
  }
}

export async function loadEngineMonthTip(
  budgetId: string,
  month: string,
): Promise<MonthResult | null> {
  const row = await prisma.engineMonthTip.findUnique({
    where: { budgetId_month: { budgetId, month } },
    select: { payload: true },
  });
  if (!row) return null;
  return parseMonthTip(row.payload);
}

export async function upsertEngineMonthTip(
  budgetId: string,
  result: MonthResult,
): Promise<void> {
  const payload = serializeMonthTip(result);
  await prisma.engineMonthTip.upsert({
    where: { budgetId_month: { budgetId, month: result.month } },
    create: { budgetId, month: result.month, payload },
    update: { payload },
  });
}

export async function clearEngineMonthTips(budgetId: string): Promise<void> {
  await prisma.engineMonthTip.deleteMany({ where: { budgetId } });
}
