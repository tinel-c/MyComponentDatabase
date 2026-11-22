/**
 * Aggregate Plan Income (Paycheck / Other income / other income categories)
 * from parsed + rule-applied ING CSV rows — the same numbers Plan activity shows.
 */

export type AppliedIncomeRow = {
  date: string; // YYYY-MM-DD
  amount: number;
  categoryId: string | null;
  ignored: boolean;
};

export type MonthlyIncomeBucket = {
  month: string; // YYYY-MM
  /** categoryId → signed activity (income inflows are positive) */
  byCategoryId: Record<string, number>;
  total: number;
};

/**
 * Sum non-ignored rows that matched an income category, grouped by calendar month.
 * Mirrors Plan category activity for income categories.
 */
export function monthlyIncomeFromAppliedRows(
  rows: AppliedIncomeRow[],
  incomeCategoryIds: ReadonlySet<string>,
): MonthlyIncomeBucket[] {
  const byMonth = new Map<string, Map<string, number>>();

  for (const row of rows) {
    if (row.ignored) continue;
    if (!row.categoryId || !incomeCategoryIds.has(row.categoryId)) continue;
    const month = row.date.slice(0, 7);
    let cats = byMonth.get(month);
    if (!cats) {
      cats = new Map();
      byMonth.set(month, cats);
    }
    cats.set(row.categoryId, (cats.get(row.categoryId) ?? 0) + row.amount);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cats]) => {
      const byCategoryId: Record<string, number> = {};
      let total = 0;
      for (const [id, amount] of cats) {
        byCategoryId[id] = amount;
        total += amount;
      }
      return { month, byCategoryId, total };
    });
}

/** Look up a month bucket or empty totals. */
export function incomeForMonth(
  buckets: MonthlyIncomeBucket[],
  month: string,
): MonthlyIncomeBucket {
  return (
    buckets.find((b) => b.month === month) ?? {
      month,
      byCategoryId: {},
      total: 0,
    }
  );
}

export type MonthlySpendBucket = {
  month: string;
  /** categoryId → signed activity (spend outflows are negative) */
  byCategoryId: Record<string, number>;
  /** Signed sum of spending-category activity (typically ≤ 0). */
  signedTotal: number;
  /** Plan banner Spent = −signedTotal (positive magnitude). */
  spentMagnitude: number;
};

/**
 * Sum non-ignored rows that matched a spending (non-income) category.
 * Mirrors Plan banner Spent (−sum of spending Activity).
 */
export function monthlySpendFromAppliedRows(
  rows: AppliedIncomeRow[],
  spendingCategoryIds: ReadonlySet<string>,
): MonthlySpendBucket[] {
  const byMonth = new Map<string, Map<string, number>>();

  for (const row of rows) {
    if (row.ignored) continue;
    if (!row.categoryId || !spendingCategoryIds.has(row.categoryId)) continue;
    const month = row.date.slice(0, 7);
    let cats = byMonth.get(month);
    if (!cats) {
      cats = new Map();
      byMonth.set(month, cats);
    }
    cats.set(row.categoryId, (cats.get(row.categoryId) ?? 0) + row.amount);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cats]) => {
      const byCategoryId: Record<string, number> = {};
      let signedTotal = 0;
      for (const [id, amount] of cats) {
        byCategoryId[id] = amount;
        signedTotal += amount;
      }
      return {
        month,
        byCategoryId,
        signedTotal,
        spentMagnitude: -signedTotal,
      };
    });
}
