/**
 * Pure helpers for Plan account Income / Spending columns.
 * Amounts are integer minor units (same sign as ledger: spend negative).
 */

export type AccountFlowTxn = {
  accountId: string;
  date: string;
  amount: number;
  categoryId: string | null;
  isParent: boolean;
  transferTwinId: string | null;
  excludeFromRta: boolean;
};

export type AccountFlowMaps = {
  /** Σ income-category amounts per account in the month */
  incomeByAccount: Record<string, number>;
  /** Σ non-income-category amounts per account in the month (usually ≤ 0) */
  spendingByAccount: Record<string, number>;
};

/**
 * Month activity per on-budget account, matching Plan category Activity rules:
 * skip parents, transfers, excludeFromRta, off-budget accounts.
 */
export function computeAccountMonthFlows(params: {
  month: string;
  transactions: AccountFlowTxn[];
  accountOnBudget: Map<string, boolean>;
  categoryIsIncome: Map<string, boolean>;
}): AccountFlowMaps {
  const incomeByAccount: Record<string, number> = {};
  const spendingByAccount: Record<string, number> = {};
  const prefix = `${params.month}-`;

  for (const t of params.transactions) {
    if (t.isParent) continue;
    if (t.transferTwinId) continue;
    if (t.excludeFromRta) continue;
    if (!t.date.startsWith(prefix)) continue;
    if (!params.accountOnBudget.get(t.accountId)) continue;
    if (!t.categoryId) continue;

    const isIncome = params.categoryIsIncome.get(t.categoryId);
    if (isIncome == null) continue;

    if (isIncome) {
      incomeByAccount[t.accountId] =
        (incomeByAccount[t.accountId] ?? 0) + t.amount;
    } else {
      spendingByAccount[t.accountId] =
        (spendingByAccount[t.accountId] ?? 0) + t.amount;
    }
  }

  return { incomeByAccount, spendingByAccount };
}
