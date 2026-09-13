import type { MonthResult } from "@/lib/budget-engine";

export type ReflectOpportunityType =
  | "overspent"
  | "under_assigned"
  | "unused_budget"
  | "trend_up"
  | "trend_down"
  | "net_deficit"
  | "receipt_leakage"
  | "unlinked_bills"
  | "suggested_assignment";

export type ReflectOpportunity = {
  id: string;
  type: ReflectOpportunityType;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  amountCents?: number;
  categoryId?: string;
  href: string;
};

export type ReflectCategoryMeta = {
  id: string;
  name: string;
  groupName: string;
  isIncome: boolean;
};

function absActivity(plan: MonthResult, categoryId: string): number {
  return Math.abs(plan.categories[categoryId]?.activity ?? 0);
}

function suggestedNextAssignment(
  months: MonthResult[],
  categoryId: string,
  focusMonth: string,
): number {
  const recent = months
    .filter((m) => m.month <= focusMonth)
    .slice(-3)
    .map((m) => absActivity(m, categoryId))
    .filter((a) => a > 0);
  const avg =
    recent.length > 0
      ? Math.round(recent.reduce((s, a) => s + a, 0) / recent.length)
      : 0;
  const focus = months.find((m) => m.month === focusMonth);
  const over =
    focus?.categories[categoryId]?.overspent &&
    (focus.categories[categoryId]?.available ?? 0) < 0
      ? Math.abs(focus.categories[categoryId].available)
      : 0;
  // Round up to nearest leu (100 bani)
  const raw = avg + over;
  return Math.ceil(raw / 100) * 100;
}

/**
 * Build ranked planning opportunities for Reflect → Plan next month.
 */
export function buildReflectOpportunities(params: {
  months: MonthResult[];
  categories: ReflectCategoryMeta[];
  focusMonth: string;
  nextMonth: string;
  currencyLabel?: string;
  unlinkedBillCount?: number;
  receiptByCategory?: Map<string, number>;
}): ReflectOpportunity[] {
  const {
    months,
    categories,
    focusMonth,
    nextMonth,
    unlinkedBillCount = 0,
    receiptByCategory,
  } = params;
  const focus = months.find((m) => m.month === focusMonth);
  const prevMonth = months.filter((m) => m.month < focusMonth).at(-1);
  const planHref = (categoryId?: string) =>
    categoryId
      ? `/plan?month=${nextMonth}#cat-${categoryId}`
      : `/plan?month=${nextMonth}`;

  const out: ReflectOpportunity[] = [];
  const spending = categories.filter((c) => !c.isIncome);

  if (!focus) return out;

  let income = focus.incomeToRta ?? 0;
  let expense = 0;
  for (const c of spending) {
    expense += absActivity(focus, c.id);
  }
  if (expense > income && expense - income > 1000) {
    out.push({
      id: `net-deficit-${focusMonth}`,
      type: "net_deficit",
      severity: "high",
      title: `Spent more than income in ${focusMonth}`,
      detail: `Expenses exceeded operating income by ${((expense - income) / 100).toFixed(0)} — trim categories or raise income next month.`,
      amountCents: expense - income,
      href: planHref(),
    });
  }

  for (const c of spending) {
    const row = focus.categories[c.id];
    if (!row) continue;
    if (row.overspent && row.available < 0) {
      out.push({
        id: `over-${c.id}-${focusMonth}`,
        type: "overspent",
        severity: "high",
        title: `${c.name} overspent`,
        detail: `Available is negative — raise the ${nextMonth} assignment or cover from another category.`,
        amountCents: Math.abs(row.available),
        categoryId: c.id,
        href: planHref(c.id),
      });
    }

    const assigned = row.assigned;
    const spent = absActivity(focus, c.id);
    if (
      assigned > 0 &&
      row.available > Math.min(5000, Math.round(assigned * 0.2)) &&
      spent < assigned
    ) {
      out.push({
        id: `unused-${c.id}-${focusMonth}`,
        type: "unused_budget",
        severity: "low",
        title: `${c.name} has unused budget`,
        detail: `Consider releasing available to Ready to Assign or lowering next month’s assignment.`,
        amountCents: row.available,
        categoryId: c.id,
        href: planHref(c.id),
      });
    }

    // Under-assigned for 2+ months in span ending at focus
    const window = months.filter((m) => m.month <= focusMonth).slice(-3);
    const underMonths = window.filter((m) => {
      const r = m.categories[c.id];
      if (!r) return false;
      const act = absActivity(m, c.id);
      return act > 0 && r.assigned < act;
    });
    if (underMonths.length >= 2) {
      out.push({
        id: `under-${c.id}-${focusMonth}`,
        type: "under_assigned",
        severity: "medium",
        title: `${c.name} under-assigned`,
        detail: `Spend exceeded assignment in ${underMonths.length} of the last ${window.length} months.`,
        amountCents: spent - assigned,
        categoryId: c.id,
        href: planHref(c.id),
      });
    }

    if (prevMonth) {
      const prevSpend = absActivity(prevMonth, c.id);
      const curSpend = absActivity(focus, c.id);
      if (prevSpend >= 2000) {
        const delta = (curSpend - prevSpend) / prevSpend;
        if (delta >= 0.15) {
          out.push({
            id: `up-${c.id}-${focusMonth}`,
            type: "trend_up",
            severity: "medium",
            title: `${c.name} up ${Math.round(delta * 100)}%`,
            detail: `Vs ${prevMonth.month} — review payees or raise the ${nextMonth} envelope.`,
            amountCents: curSpend - prevSpend,
            categoryId: c.id,
            href: planHref(c.id),
          });
        } else if (delta <= -0.15 && assigned > curSpend) {
          out.push({
            id: `down-${c.id}-${focusMonth}`,
            type: "trend_down",
            severity: "low",
            title: `${c.name} down ${Math.round(Math.abs(delta) * 100)}%`,
            detail: `Assignment may be high relative to recent spend.`,
            amountCents: prevSpend - curSpend,
            categoryId: c.id,
            href: planHref(c.id),
          });
        }
      }
    }

    const suggested = suggestedNextAssignment(months, c.id, focusMonth);
    if (suggested > 0 && (row.overspent || Math.abs(suggested - assigned) > 2000)) {
      out.push({
        id: `suggest-${c.id}-${focusMonth}`,
        type: "suggested_assignment",
        severity: row.overspent ? "medium" : "low",
        title: `Suggested ${c.name}: ${(suggested / 100).toFixed(0)}`,
        detail: `Based on the last 3 months of activity${row.overspent ? " plus this month’s overspend" : ""}.`,
        amountCents: suggested,
        categoryId: c.id,
        href: planHref(c.id),
      });
    }
  }

  if (receiptByCategory && receiptByCategory.size > 0) {
    // Leakage: if a receipt-mapped category is large vs groceries parent share — skip complex; use top receipt cat vs total
    const totalReceipt = [...receiptByCategory.values()].reduce((s, v) => s + v, 0);
    for (const [name, cents] of receiptByCategory) {
      if (totalReceipt <= 0) continue;
      const share = cents / totalReceipt;
      if (share >= 0.25 && name !== "Groceries" && cents >= 5000) {
        const cat = spending.find((c) => c.name === name);
        out.push({
          id: `leak-${name}-${focusMonth}`,
          type: "receipt_leakage",
          severity: "low",
          title: `${name} is ${Math.round(share * 100)}% of receipt detail`,
          detail: `Bill lines show a large share in ${name} — consider a dedicated envelope.`,
          amountCents: cents,
          categoryId: cat?.id,
          href: planHref(cat?.id),
        });
      }
    }
  }

  if (unlinkedBillCount > 0) {
    out.push({
      id: `unlinked-${focusMonth}`,
      type: "unlinked_bills",
      severity: "medium",
      title: `${unlinkedBillCount} bill${unlinkedBillCount === 1 ? "" : "s"} not linked`,
      detail: "Link scans to payments so Plan categories stay accurate.",
      href: "/more/bills",
    });
  }

  const severityRank = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => {
    const s = severityRank[a.severity] - severityRank[b.severity];
    if (s !== 0) return s;
    return Math.abs(b.amountCents ?? 0) - Math.abs(a.amountCents ?? 0);
  });

  // Dedupe: keep one opportunity per category preferring higher severity types
  const seenCat = new Set<string>();
  const deduped: ReflectOpportunity[] = [];
  for (const o of out) {
    if (o.type === "suggested_assignment" && o.categoryId) {
      // Keep suggestions only if no stronger category-specific card already taken
      if (seenCat.has(o.categoryId)) continue;
    }
    if (
      o.categoryId &&
      (o.type === "overspent" ||
        o.type === "under_assigned" ||
        o.type === "trend_up" ||
        o.type === "unused_budget")
    ) {
      if (seenCat.has(`strong-${o.categoryId}`)) continue;
      seenCat.add(`strong-${o.categoryId}`);
      seenCat.add(o.categoryId);
    }
    deduped.push(o);
  }

  return deduped.slice(0, 12);
}

export function buildBudgetVsActualRows(params: {
  months: MonthResult[];
  categories: ReflectCategoryMeta[];
  focusMonth: string;
}): {
  categoryId: string;
  name: string;
  assigned: number;
  spent: number;
  available: number;
  suggested: number;
  overspent: boolean;
}[] {
  const focus = params.months.find((m) => m.month === params.focusMonth);
  if (!focus) return [];
  return params.categories
    .filter((c) => !c.isIncome)
    .map((c) => {
      const row = focus.categories[c.id];
      const assigned = row?.assigned ?? 0;
      const spent = absActivity(focus, c.id);
      const available = row?.available ?? 0;
      return {
        categoryId: c.id,
        name: c.name,
        assigned,
        spent,
        available,
        suggested: suggestedNextAssignment(
          params.months,
          c.id,
          params.focusMonth,
        ),
        overspent: Boolean(row?.overspent),
      };
    })
    .filter((r) => r.assigned !== 0 || r.spent !== 0)
    .sort((a, b) => b.spent - a.spent);
}
