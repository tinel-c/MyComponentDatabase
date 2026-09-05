import { prisma } from "@/lib/prisma";
import {
  computeBudgetMonths,
  type EngineAccount,
  type EngineCategory,
  type EngineTxn,
} from "@/lib/budget-engine";

export async function loadPlanMonth(budgetId: string, month: string) {
  const budget = await prisma.budget.findUniqueOrThrow({
    where: { id: budgetId },
  });

  const [accounts, groups, assigned, transactions, monthMetas] =
    await Promise.all([
      prisma.financeAccount.findMany({
        where: { budgetId },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.categoryGroup.findMany({
        where: { budgetId, hidden: false },
        orderBy: { sortOrder: "asc" },
        include: {
          categories: {
            where: { hidden: false },
            orderBy: { sortOrder: "asc" },
            include: { targets: true, creditAccount: true },
          },
        },
      }),
      prisma.monthlyCategoryBudget.findMany({
        where: {
          category: { group: { budgetId } },
          month: { gte: budget.firstMonth, lte: month },
        },
      }),
      prisma.transaction.findMany({
        where: {
          account: { budgetId },
          date: {
            gte: `${budget.firstMonth}-01`,
            lte: `${month}-31`,
          },
        },
      }),
      prisma.monthMeta.findMany({
        where: { budgetId, month: { gte: budget.firstMonth, lte: month } },
      }),
    ]);

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
  }));

  const months = computeBudgetMonths({
    firstMonth: budget.firstMonth,
    endMonth: month,
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

  const plan = months.find((m) => m.month === month) ?? months[months.length - 1];

  return { budget, accounts, groups, plan, currency: budget.currency };
}
