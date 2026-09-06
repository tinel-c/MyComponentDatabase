/**
 * Pure envelope budget engine.
 * Amounts are integer minor units. Activity for spending is typically negative.
 */

export type EngineAccount = {
  id: string;
  onBudget: boolean;
  type: string;
  creditCategoryId: string | null;
};

export type EngineCategory = {
  id: string;
  isIncome: boolean;
  isSystem: boolean;
  systemKey: string | null;
  /** Linked credit card account id when this is a CC payment category */
  creditAccountId?: string | null;
};

export type EngineTxn = {
  id: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  categoryId: string | null;
  isParent: boolean;
  isChild: boolean;
  transferTwinId: string | null;
  isStartingBalance: boolean;
  /** Import ignore-rule matches (e.g. credit-line cover) — keep for balance, skip RTA/envelopes. */
  excludeFromRta?: boolean;
};

export type EngineAssigned = {
  categoryId: string;
  month: string;
  assigned: number;
};

export type MonthMetaInput = {
  month: string;
  holdForNextMonth: boolean;
  heldAmount: number;
};

export type CategoryMonthResult = {
  categoryId: string;
  assigned: number;
  activity: number;
  ccFundingIn: number;
  available: number;
  overspent: boolean;
};

export type MonthResult = {
  month: string;
  rta: number;
  incomeToRta: number;
  totalAssigned: number;
  cashOverspendDebt: number;
  categories: Record<string, CategoryMonthResult>;
};

function monthOf(date: string): string {
  return date.slice(0, 7);
}

/**
 * Compute plan state from firstMonth through endMonth inclusive.
 */
export function computeBudgetMonths(input: {
  firstMonth: string;
  endMonth: string;
  accounts: EngineAccount[];
  categories: EngineCategory[];
  transactions: EngineTxn[];
  assigned: EngineAssigned[];
  monthMetas?: MonthMetaInput[];
}): MonthResult[] {
  const { firstMonth, endMonth, accounts, categories, transactions, assigned } =
    input;
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const ccPaymentCategoryIds = new Set(
    accounts
      .filter((a) => a.creditCategoryId)
      .map((a) => a.creditCategoryId as string),
  );
  const creditAccountByCategory = new Map(
    accounts
      .filter((a) => a.creditCategoryId)
      .map((a) => [a.creditCategoryId as string, a.id]),
  );

  const assignedByKey = new Map<string, number>();
  for (const a of assigned) {
    assignedByKey.set(`${a.categoryId}|${a.month}`, a.assigned);
  }

  const metaByMonth = new Map(
    (input.monthMetas ?? []).map((m) => [m.month, m]),
  );

  /** Pre-bucket non-parent, non-excluded txns by YYYY-MM for O(txns + months×cats) work. */
  const txnsByMonth = new Map<string, EngineTxn[]>();
  for (const t of transactions) {
    if (t.isParent) continue;
    const m = monthOf(t.date);
    let bucket = txnsByMonth.get(m);
    if (!bucket) {
      bucket = [];
      txnsByMonth.set(m, bucket);
    }
    bucket.push(t);
  }

  const months: string[] = [];
  {
    // Guard inverted ranges (e.g. viewing a month before budget.firstMonth).
    const last = endMonth < firstMonth ? firstMonth : endMonth;
    let m = firstMonth;
    while (m <= last) {
      months.push(m);
      const [y, mo] = m.split("-").map(Number);
      const d = new Date(y, mo, 1);
      m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
  }

  const nonIncome = categories.filter((c) => !c.isIncome);
  const results: MonthResult[] = [];
  const prevAvailable = new Map<string, number>();
  let heldFromPrev = 0;

  for (const month of months) {
    const cats: Record<string, CategoryMonthResult> = {};
    let incomeToRta = heldFromPrev;
    let totalAssigned = 0;
    let cashOverspendDebt = 0;

    // Previous cash overspend reduces this month's RTA
    for (const c of nonIncome) {
      const prev = prevAvailable.get(c.id) ?? 0;
      if (prev < 0 && !ccPaymentCategoryIds.has(c.id)) {
        cashOverspendDebt += Math.abs(prev);
      }
    }
    incomeToRta -= cashOverspendDebt;

    const activityByCat = new Map<string, number>();
    const ccFundingByCat = new Map<string, number>();

    const monthTxns = txnsByMonth.get(month) ?? [];
    for (const t of monthTxns) {
      if (t.excludeFromRta) continue;
      const acct = accountById.get(t.accountId);
      if (!acct?.onBudget) continue;

      if (t.categoryId) {
        activityByCat.set(
          t.categoryId,
          (activityByCat.get(t.categoryId) ?? 0) + t.amount,
        );
      }

      // CC funding: outflow on credit card with a spending category moves money to CC payment
      if (
        acct.type === "CREDIT_CARD" &&
        acct.creditCategoryId &&
        t.amount < 0 &&
        t.categoryId &&
        !ccPaymentCategoryIds.has(t.categoryId) &&
        !t.transferTwinId
      ) {
        const ccp = acct.creditCategoryId;
        ccFundingByCat.set(
          ccp,
          (ccFundingByCat.get(ccp) ?? 0) + Math.abs(t.amount),
        );
      }

      // CC payment transfer: paying the card reduces CC payment available
      if (t.transferTwinId && t.amount > 0) {
        for (const [ccpId, creditAcctId] of creditAccountByCategory) {
          if (creditAcctId === t.accountId) {
            ccFundingByCat.set(
              ccpId,
              (ccFundingByCat.get(ccpId) ?? 0) - t.amount,
            );
          }
        }
      }
    }

    for (const c of categories) {
      const a = assignedByKey.get(`${c.id}|${month}`) ?? 0;
      if (!c.isIncome) totalAssigned += a;

      const activity = activityByCat.get(c.id) ?? 0;
      const ccFundingIn = ccFundingByCat.get(c.id) ?? 0;

      const carryIn =
        !c.isIncome && (prevAvailable.get(c.id) ?? 0) > 0
          ? (prevAvailable.get(c.id) ?? 0)
          : 0;

      const available = c.isIncome ? 0 : carryIn + a + activity + ccFundingIn;

      cats[c.id] = {
        categoryId: c.id,
        assigned: a,
        activity,
        ccFundingIn,
        available,
        overspent: !c.isIncome && available < 0,
      };
    }

    // Income to RTA from transactions (starting balances, income cats, uncategorized).
    for (const t of monthTxns) {
      if (t.transferTwinId) continue;
      if (t.excludeFromRta) continue;
      const acct = accountById.get(t.accountId);
      if (!acct?.onBudget) continue;

      if (t.isStartingBalance) {
        incomeToRta += t.amount;
        continue;
      }

      if (!t.categoryId) {
        incomeToRta += t.amount;
        continue;
      }

      const cat = categoryById.get(t.categoryId);
      if (cat?.isIncome) {
        incomeToRta += t.amount;
      }
    }

    const meta = metaByMonth.get(month);
    const rta = incomeToRta - totalAssigned;
    let nextHeld = 0;
    if (meta?.holdForNextMonth && rta > 0) {
      nextHeld = meta.heldAmount > 0 ? Math.min(meta.heldAmount, rta) : rta;
    }

    results.push({
      month,
      rta: rta - nextHeld,
      incomeToRta,
      totalAssigned,
      cashOverspendDebt,
      categories: cats,
    });

    for (const c of categories) {
      prevAvailable.set(c.id, cats[c.id]?.available ?? 0);
    }
    heldFromPrev = nextHeld;
  }

  return results;
}

export function getMonthResult(
  results: MonthResult[],
  month: string,
): MonthResult | undefined {
  return results.find((r) => r.month === month);
}
