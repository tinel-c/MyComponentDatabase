import { prisma } from "@/lib/prisma";
import {
  computeBudgetMonths,
  type EngineAccount,
  type EngineCategory,
  type EngineTxn,
  type MonthResult,
} from "@/lib/budget-engine";

export async function loadPlanMonth(budgetId: string, month: string) {
  const budget = await prisma.budget.findUniqueOrThrow({
    where: { id: budgetId },
  });

  // Never ask the engine for a range that starts after the viewed month
  // (empty results → undefined plan → Plan page 500).
  const endMonth = month < budget.firstMonth ? budget.firstMonth : month;
  const dateFrom = `${budget.firstMonth}-01`;
  const dateTo = `${endMonth}-31`;

  const [
    accounts,
    groups,
    assigned,
    transactions,
    monthMetas,
    balanceRows,
    ignoreRules,
  ] = await Promise.all([
    prisma.financeAccount.findMany({
      where: { budgetId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        onBudget: true,
        closed: true,
        type: true,
        creditCategoryId: true,
        sortOrder: true,
      },
    }),
    prisma.categoryGroup.findMany({
      where: { budgetId, hidden: false },
      orderBy: { sortOrder: "asc" },
      include: {
        categories: {
          where: { hidden: false },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            isIncome: true,
            isSystem: true,
            systemKey: true,
            sortOrder: true,
            creditAccount: { select: { id: true } },
          },
        },
      },
    }),
    prisma.monthlyCategoryBudget.findMany({
      where: {
        category: { group: { budgetId } },
        month: { gte: budget.firstMonth, lte: endMonth },
      },
      select: { categoryId: true, month: true, assigned: true },
    }),
    prisma.transaction.findMany({
      where: {
        account: { budgetId },
        date: { gte: dateFrom, lte: dateTo },
      },
      select: {
        id: true,
        accountId: true,
        date: true,
        amount: true,
        categoryId: true,
        isParent: true,
        isChild: true,
        transferTwinId: true,
        isStartingBalance: true,
        notes: true,
      },
    }),
    prisma.monthMeta.findMany({
      where: { budgetId, month: { gte: budget.firstMonth, lte: endMonth } },
      select: {
        month: true,
        holdForNextMonth: true,
        heldAmount: true,
      },
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: {
        account: { budgetId },
        date: { lte: dateTo },
      },
      _sum: { amount: true },
    }),
    prisma.importCategoryRule.findMany({
      where: { budgetId, ignore: true },
      select: { matchText: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const balanceMap = new Map(
    balanceRows.map((b) => [b.accountId, b._sum.amount ?? 0]),
  );
  const accountBalances = accounts
    .filter((a) => !a.closed)
    .map((a) => ({
      id: a.id,
      name: a.name,
      onBudget: a.onBudget,
      balance: balanceMap.get(a.id) ?? 0,
    }));

  const engineAccounts: EngineAccount[] = accounts.map((a) => ({
    id: a.id,
    onBudget: a.onBudget,
    type: a.type,
    creditCategoryId: a.creditCategoryId,
  }));

  const categories: EngineCategory[] = groups.flatMap((g) =>
    g.categories.map((c) => ({
      id: c.id,
      isIncome: c.isIncome,
      isSystem: c.isSystem,
      systemKey: c.systemKey,
      creditAccountId: c.creditAccount?.id ?? null,
    })),
  );

  const ignorePatterns = ignoreRules
    .map((r) => r.matchText)
    .filter((t) => t.length >= 3);

  const notesMatchIgnore = (notes: string | null) => {
    if (!notes || ignorePatterns.length === 0) return false;
    return ignorePatterns.some((p) => notes.includes(p));
  };

  const engineTxns: EngineTxn[] = transactions.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    date: t.date,
    amount: t.amount,
    categoryId: t.categoryId,
    isParent: t.isParent,
    isChild: t.isChild,
    transferTwinId: t.transferTwinId,
    isStartingBalance: t.isStartingBalance,
    excludeFromRta: notesMatchIgnore(t.notes),
  }));

  const months = computeBudgetMonths({
    firstMonth: budget.firstMonth,
    endMonth,
    accounts: engineAccounts,
    categories,
    transactions: engineTxns,
    assigned: assigned.map((a) => ({
      categoryId: a.categoryId,
      month: a.month,
      assigned: a.assigned,
    })),
    monthMetas: monthMetas.map((m) => ({
      month: m.month,
      holdForNextMonth: m.holdForNextMonth,
      heldAmount: m.heldAmount,
    })),
  });

  const emptyPlan = (m: string): MonthResult => ({
    month: m,
    rta: 0,
    incomeToRta: 0,
    totalAssigned: 0,
    cashOverspendDebt: 0,
    categories: Object.fromEntries(
      categories.map((c) => [
        c.id,
        {
          categoryId: c.id,
          assigned: 0,
          activity: 0,
          ccFundingIn: 0,
          available: 0,
          overspent: false,
        },
      ]),
    ),
  });

  const plan =
    months.find((m) => m.month === month) ??
    months.find((m) => m.month === endMonth) ??
    months[months.length - 1] ??
    emptyPlan(endMonth);

  return {
    budget,
    accounts,
    accountBalances,
    groups,
    plan,
    currency: budget.currency,
  };
}
