/**
 * Month-over-month spending series for Reflect Trends
 * (YNAB-style breakdown by category or category group).
 */

export type SpendTrendMode = "category" | "group";

export type SpendTrendTxn = {
  date: string;
  amount: number;
  categoryId: string | null;
  transferTwinId: string | null;
  accountOnBudget: boolean;
  accountId: string;
};

export type SpendTrendCategory = {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  isIncome: boolean;
};

export type SpendTrendSeries = {
  id: string;
  name: string;
  /** Cents per month, aligned with `months` */
  values: number[];
  totalCents: number;
  averageCents: number;
  percent: number;
  /** Primary category id for register drill-down (largest spend in series). */
  drillCategoryId?: string;
  drillGroupId?: string;
};

export type SpendTrendResult = {
  months: string[];
  series: SpendTrendSeries[];
  grandTotalCents: number;
};

const OTHER_ID = "__other__";

/**
 * Build stacked spend series for Reflect Trends.
 * Same exclusions as Overview charts: transfers skipped, on-budget only,
 * expenses = negative amounts on non-income categories.
 */
export function buildSpendTrendSeries(params: {
  txns: SpendTrendTxn[];
  categories: SpendTrendCategory[];
  months: string[];
  mode: SpendTrendMode;
  accountId?: string;
  /** Max named series before rolling into Other (groups default 8, cats 12). */
  topN?: number;
}): SpendTrendResult {
  const {
    txns,
    categories,
    months,
    mode,
    accountId,
    topN = mode === "group" ? 8 : 12,
  } = params;

  const catById = new Map(categories.map((c) => [c.id, c]));
  const monthIndex = new Map(months.map((m, i) => [m, i]));
  const n = months.length;

  /** key → per-month cents */
  const buckets = new Map<string, { name: string; values: number[]; drillCategoryId?: string; drillGroupId?: string; catTotals: Map<string, number> }>();

  function ensure(
    key: string,
    name: string,
    meta?: { drillCategoryId?: string; drillGroupId?: string },
  ) {
    let b = buckets.get(key);
    if (!b) {
      b = {
        name,
        values: Array.from({ length: n }, () => 0),
        drillCategoryId: meta?.drillCategoryId,
        drillGroupId: meta?.drillGroupId,
        catTotals: new Map(),
      };
      buckets.set(key, b);
    }
    return b;
  }

  for (const t of txns) {
    if (t.transferTwinId) continue;
    if (!t.accountOnBudget) continue;
    if (accountId && t.accountId !== accountId) continue;
    if (t.amount >= 0) continue;
    if (!t.categoryId) continue;
    const cat = catById.get(t.categoryId);
    if (!cat || cat.isIncome) continue;

    const m = t.date.slice(0, 7);
    const mi = monthIndex.get(m);
    if (mi === undefined) continue;

    const cents = Math.abs(t.amount);
    if (mode === "group") {
      const b = ensure(cat.groupId, cat.groupName, {
        drillGroupId: cat.groupId,
      });
      b.values[mi] += cents;
      b.catTotals.set(
        cat.id,
        (b.catTotals.get(cat.id) ?? 0) + cents,
      );
    } else {
      const b = ensure(cat.id, cat.name, {
        drillCategoryId: cat.id,
        drillGroupId: cat.groupId,
      });
      b.values[mi] += cents;
    }
  }

  const ranked = [...buckets.entries()]
    .map(([id, b]) => {
      const totalCents = b.values.reduce((s, v) => s + v, 0);
      let drillCategoryId = b.drillCategoryId;
      if (mode === "group" && b.catTotals.size > 0) {
        let best = 0;
        for (const [cid, tot] of b.catTotals) {
          if (tot > best) {
            best = tot;
            drillCategoryId = cid;
          }
        }
      }
      return {
        id,
        name: b.name,
        values: b.values,
        totalCents,
        drillCategoryId,
        drillGroupId: b.drillGroupId ?? (mode === "group" ? id : undefined),
      };
    })
    .filter((s) => s.totalCents > 0)
    .sort((a, b) => b.totalCents - a.totalCents);

  const top = ranked.slice(0, topN);
  const rest = ranked.slice(topN);
  const seriesRaw = [...top];
  if (rest.length > 0) {
    const otherValues = Array.from({ length: n }, () => 0);
    let otherTotal = 0;
    for (const s of rest) {
      otherTotal += s.totalCents;
      for (let i = 0; i < n; i++) otherValues[i] += s.values[i];
    }
    seriesRaw.push({
      id: OTHER_ID,
      name: "Other",
      values: otherValues,
      totalCents: otherTotal,
      drillCategoryId: undefined,
      drillGroupId: undefined,
    });
  }

  const grandTotalCents = seriesRaw.reduce((s, x) => s + x.totalCents, 0);
  const series: SpendTrendSeries[] = seriesRaw.map((s) => ({
    id: s.id,
    name: s.name,
    values: s.values,
    totalCents: s.totalCents,
    averageCents: n > 0 ? Math.round(s.totalCents / n) : 0,
    percent:
      grandTotalCents > 0
        ? Math.round((s.totalCents / grandTotalCents) * 1000) / 10
        : 0,
    drillCategoryId: s.drillCategoryId,
    drillGroupId: s.drillGroupId,
  }));

  return { months, series, grandTotalCents };
}

export function isOtherTrendSeries(id: string): boolean {
  return id === OTHER_ID;
}
