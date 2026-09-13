import { memoMatchesImportRule } from "@/lib/ing-import";
import { prisma } from "@/lib/prisma";
import {
  computeBudgetMonths,
  type EngineAccount,
  type EngineCategory,
  type EngineTxn,
  type MonthResult,
} from "@/lib/budget-engine";
import { computeAccountMonthFlows } from "@/lib/plan-account-flows";
import { unstable_cache } from "next/cache";
import { addMonths } from "@/lib/money";

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
    pendingBillParents,
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
        importFingerprint: true,
        isPendingBill: true,
        parentId: true,
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
    prisma.transaction.findMany({
      where: {
        account: { budgetId },
        date: { lte: dateTo },
        isChild: false,
        importFingerprint: null,
        OR: [
          { isPendingBill: true },
          { notes: { contains: "Bill import" } },
        ],
      },
      select: { id: true },
    }),
    prisma.importCategoryRule.findMany({
      where: { budgetId, ignore: true },
      select: { matchText: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const pendingParentIds = new Set(pendingBillParents.map((p) => p.id));
  // Also treat in-range parents with pending notes as pending (fingerprint null).
  for (const t of transactions) {
    if (
      !t.isChild &&
      !t.importFingerprint &&
      (t.isPendingBill || t.notes?.toLowerCase().includes("bill import"))
    ) {
      pendingParentIds.add(t.id);
    }
  }

  const balanceRows = await prisma.transaction.groupBy({
    by: ["accountId"],
    where: {
      account: { budgetId },
      date: { lte: dateTo },
      ...(pendingParentIds.size > 0
        ? {
            NOT: {
              OR: [
                { id: { in: [...pendingParentIds] } },
                { parentId: { in: [...pendingParentIds] } },
              ],
            },
          }
        : {}),
    },
    _sum: { amount: true },
  });
  const balanceMap = new Map(
    balanceRows.map((b) => [b.accountId, b._sum.amount ?? 0]),
  );
  const accountBalances = accounts
    .filter((a) => !a.closed)
    .map((a) => ({
      id: a.id,
      name: a.name,
      onBudget: a.onBudget,
      type: a.type,
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
    return ignorePatterns.some((p) => memoMatchesImportRule(notes, p));
  };

  const engineTxns: EngineTxn[] = transactions.map((t) => {
    const pendingParent =
      pendingParentIds.has(t.id) ||
      (t.parentId != null && pendingParentIds.has(t.parentId));
    return {
      id: t.id,
      accountId: t.accountId,
      date: t.date,
      amount: t.amount,
      categoryId: t.categoryId,
      isParent: t.isParent,
      isChild: t.isChild,
      transferTwinId: t.transferTwinId,
      isStartingBalance: t.isStartingBalance,
      excludeFromRta: pendingParent || notesMatchIgnore(t.notes),
    };
  });

  const engineInput = {
    firstMonth: budget.firstMonth,
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
  };

  // Tip cache: reuse prior months from a tagged cache, recompute only the tip.
  const prevMonth =
    endMonth > budget.firstMonth ? addMonths(endMonth, -1) : null;
  let months: MonthResult[];
  if (prevMonth) {
    const prefix = await unstable_cache(
      async () =>
        computeBudgetMonths({
          ...engineInput,
          endMonth: prevMonth,
        }),
      ["engine-prefix", budgetId, prevMonth],
      { tags: [`budget:${budgetId}`], revalidate: 120 },
    )();
    const tip = computeBudgetMonths({
      ...engineInput,
      firstMonth: endMonth,
      endMonth,
      continueFrom: prefix[prefix.length - 1],
    });
    months = [...prefix, ...tip];
  } else {
    months = computeBudgetMonths({
      ...engineInput,
      endMonth,
    });
  }

  const emptyPlan = (m: string): MonthResult => ({
    month: m,
    rta: 0,
    incomeToRta: 0,
    toSavings: 0,
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

  const accountOnBudget = new Map(accounts.map((a) => [a.id, a.onBudget]));
  const accountType = new Map(accounts.map((a) => [a.id, a.type]));
  const categoryIsIncome = new Map(
    categories.map((c) => [c.id, c.isIncome]),
  );
  const categoryGroupId = new Map(
    groups.flatMap((g) => g.categories.map((c) => [c.id, g.id] as const)),
  );
  const {
    incomeByAccount,
    spendingByAccount,
    spendingByAccountByGroup,
    toSavingsByAccount,
  } = computeAccountMonthFlows({
    month,
    transactions: engineTxns.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      date: t.date,
      amount: t.amount,
      categoryId: t.categoryId,
      isParent: t.isParent,
      transferTwinId: t.transferTwinId,
      excludeFromRta: Boolean(t.excludeFromRta),
      isStartingBalance: Boolean(t.isStartingBalance),
    })),
    accountOnBudget,
    accountType,
    categoryIsIncome,
    categoryGroupId,
  });

  return {
    budget,
    accounts,
    accountBalances,
    incomeByAccount,
    spendingByAccount,
    spendingByAccountByGroup,
    toSavingsByAccount,
    groups,
    plan,
    months,
    currency: budget.currency,
  };
}
