/**
 * Pure helpers for Plan account Income / Spending columns.
 * Amounts are integer minor units (same sign as ledger: spend negative).
 *
 * Income matches Ready-to-Assign incomeToRta: income categories, starting
 * balances, and uncategorized amounts on operating (non-SAVINGS) accounts.
 * Transfers into SAVINGS are tracked separately (toSavingsByAccount).
 */

export type AccountFlowTxn = {
  id?: string;
  accountId: string;
  date: string;
  amount: number;
  categoryId: string | null;
  isParent: boolean;
  transferTwinId: string | null;
  excludeFromRta: boolean;
  isStartingBalance?: boolean;
};

export type AccountFlowMaps = {
  /** Σ income-side amounts per operating account in the month (incl. adj / starting) */
  incomeByAccount: Record<string, number>;
  /** Σ spending-category amounts per account in the month (usually ≤ 0) */
  spendingByAccount: Record<string, number>;
  /** Σ spending per account per category group (usually ≤ 0) */
  spendingByAccountByGroup: Record<string, Record<string, number>>;
  /**
   * Net transferred into each SAVINGS account from operating accounts this month
   * (positive = money moved in). Mirrors engine `toSavings` per destination.
   */
  toSavingsByAccount: Record<string, number>;
};

/**
 * Month activity per on-budget account, matching Plan category Activity rules:
 * skip parents, excludeFromRta, off-budget accounts.
 * SAVINGS accounts do not contribute to Income; operating→savings transfers
 * are recorded in toSavingsByAccount.
 */
export function computeAccountMonthFlows(params: {
  month: string;
  transactions: AccountFlowTxn[];
  accountOnBudget: Map<string, boolean>;
  accountType: Map<string, string>;
  categoryIsIncome: Map<string, boolean>;
  /** categoryId → groupId (spending categories only needed) */
  categoryGroupId: Map<string, string>;
}): AccountFlowMaps {
  const incomeByAccount: Record<string, number> = {};
  const spendingByAccount: Record<string, number> = {};
  const spendingByAccountByGroup: Record<string, Record<string, number>> = {};
  const toSavingsByAccount: Record<string, number> = {};
  const prefix = `${params.month}-`;

  const isSavings = (accountId: string) =>
    params.accountOnBudget.get(accountId) === true &&
    params.accountType.get(accountId) === "SAVINGS";
  const isOperating = (accountId: string) =>
    params.accountOnBudget.get(accountId) === true &&
    params.accountType.get(accountId) !== "SAVINGS";

  const monthTxns = params.transactions.filter(
    (t) => !t.isParent && t.date.startsWith(prefix),
  );
  const txnById = new Map(
    monthTxns.filter((t) => t.id).map((t) => [t.id as string, t]),
  );

  for (const t of monthTxns) {
    if (t.excludeFromRta) continue;
    if (!params.accountOnBudget.get(t.accountId)) continue;

    if (t.transferTwinId) {
      // Count operating → savings once on the positive (destination) leg.
      if (t.amount <= 0 || !t.id) continue;
      const twin = txnById.get(t.transferTwinId);
      if (!twin || twin.excludeFromRta) continue;

      const tIsIncome = Boolean(
        t.categoryId && params.categoryIsIncome.get(t.categoryId),
      );
      const twinIsIncome = Boolean(
        twin.categoryId && params.categoryIsIncome.get(twin.categoryId),
      );

      // Hybrid income + twin: count income on operating leg; skip toSavings.
      if (tIsIncome || twinIsIncome) {
        if (tIsIncome && isOperating(t.accountId)) {
          incomeByAccount[t.accountId] =
            (incomeByAccount[t.accountId] ?? 0) + t.amount;
        }
        if (twinIsIncome && isOperating(twin.accountId)) {
          incomeByAccount[twin.accountId] =
            (incomeByAccount[twin.accountId] ?? 0) + twin.amount;
        }
        continue;
      }

      if (isSavings(t.accountId) && isOperating(twin.accountId)) {
        toSavingsByAccount[t.accountId] =
          (toSavingsByAccount[t.accountId] ?? 0) + t.amount;
      } else if (isOperating(t.accountId) && isSavings(twin.accountId)) {
        toSavingsByAccount[twin.accountId] =
          (toSavingsByAccount[twin.accountId] ?? 0) - t.amount;
      }
      continue;
    }

    if (isOperating(t.accountId)) {
      if (t.isStartingBalance || !t.categoryId) {
        incomeByAccount[t.accountId] =
          (incomeByAccount[t.accountId] ?? 0) + t.amount;
        continue;
      }

      const isIncome = params.categoryIsIncome.get(t.categoryId);
      if (isIncome == null) continue;

      if (isIncome) {
        incomeByAccount[t.accountId] =
          (incomeByAccount[t.accountId] ?? 0) + t.amount;
      } else {
        spendingByAccount[t.accountId] =
          (spendingByAccount[t.accountId] ?? 0) + t.amount;
        const groupId = params.categoryGroupId.get(t.categoryId);
        if (groupId) {
          const byGroup = (spendingByAccountByGroup[t.accountId] ??= {});
          byGroup[groupId] = (byGroup[groupId] ?? 0) + t.amount;
        }
      }
      continue;
    }

    // SAVINGS: spending categories only (not income / starting / uncategorized).
    if (!isSavings(t.accountId) || !t.categoryId) continue;
    const isIncome = params.categoryIsIncome.get(t.categoryId);
    if (isIncome == null || isIncome) continue;

    spendingByAccount[t.accountId] =
      (spendingByAccount[t.accountId] ?? 0) + t.amount;
    const groupId = params.categoryGroupId.get(t.categoryId);
    if (groupId) {
      const byGroup = (spendingByAccountByGroup[t.accountId] ??= {});
      byGroup[groupId] = (byGroup[groupId] ?? 0) + t.amount;
    }
  }

  return {
    incomeByAccount,
    spendingByAccount,
    spendingByAccountByGroup,
    toSavingsByAccount,
  };
}
