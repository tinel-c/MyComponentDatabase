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

function assignedFor(
  assigned: EngineAssigned[],
  categoryId: string,
  month: string,
): number {
  return assigned.find((a) => a.categoryId === categoryId && a.month === month)?.assigned ?? 0;
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

  const months: string[] = [];
  {
    let m = firstMonth;
    while (m <= endMonth) {
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

    for (const c of categories) {
      const a = assignedFor(assigned, c.id, month);
      if (!c.isIncome) totalAssigned += a;

      let activity = 0;
      let ccFundingIn = 0;

      for (const t of transactions) {
        if (t.isParent) continue;
        if (monthOf(t.date) !== month) continue;
        const acct = accountById.get(t.accountId);
        if (!acct?.onBudget) continue;

        if (t.categoryId === c.id) {
          activity += t.amount;
        }

        // CC funding: outflow on credit card with a spending category moves money to CC payment
        if (
          ccPaymentCategoryIds.has(c.id) &&
          acct.type === "CREDIT_CARD" &&
          acct.creditCategoryId === c.id &&
          t.amount < 0 &&
          t.categoryId &&
          !ccPaymentCategoryIds.has(t.categoryId) &&
          !t.transferTwinId
        ) {
          ccFundingIn += Math.abs(t.amount);
        }

        // CC payment transfer: paying the card reduces CC payment available
        if (
          ccPaymentCategoryIds.has(c.id) &&
          t.transferTwinId &&
          creditAccountByCategory.get(c.id) === t.accountId &&
          t.amount > 0
        ) {
          // inflow on credit card from transfer = payment received → reduce available
          ccFundingIn -= t.amount;
        }
      }

      // Income to RTA: positive categorized to income or uncategorized inflow (non-transfer, non-starting)
      if (c.isIncome) {
        // income categories don't use available the same way; still track activity
      }

      const carryIn =
        !c.isIncome && (prevAvailable.get(c.id) ?? 0) > 0
          ? (prevAvailable.get(c.id) ?? 0)
          : 0;

      const available = c.isIncome
        ? 0
        : carryIn + a + activity + ccFundingIn;

      cats[c.id] = {
        categoryId: c.id,
        assigned: a,
        activity,
        ccFundingIn,
        available,
        overspent: !c.isIncome && available < 0,
      };
    }

    // Income to RTA from transactions
    for (const t of transactions) {
      if (t.isParent || t.transferTwinId) continue;
      if (monthOf(t.date) !== month) continue;
      const acct = accountById.get(t.accountId);
      if (!acct?.onBudget) continue;
      if (t.amount <= 0) continue;
      if (t.isStartingBalance) {
        incomeToRta += t.amount;
        continue;
      }
      if (!t.categoryId) {
        incomeToRta += t.amount;
        continue;
      }
      const cat = categories.find((c) => c.id === t.categoryId);
      if (cat?.isIncome) incomeToRta += t.amount;
      // Categorized to a spending category as inflow (refund) — already in activity, not RTA
    }

    const meta = input.monthMetas?.find((x) => x.month === month);
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
