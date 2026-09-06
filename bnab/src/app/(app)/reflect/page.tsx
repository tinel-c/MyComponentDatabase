import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { addMonths, currentMonth, formatMoney } from "@/lib/money";
import { cardClass } from "@/components/forms/field-classes";
import { ReflectChartsLazy as ReflectCharts } from "@/components/reflect/ReflectChartsLazy";

export default async function ReflectPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const span = Math.min(24, Math.max(3, Number(sp.months ?? 6) || 6));
  const end = currentMonth();
  const start = addMonths(end, -(span - 1));

  const [accounts, categories, transactions] = await Promise.all([
    prisma.financeAccount.findMany({ where: { budgetId: budget.id } }),
    prisma.category.findMany({
      where: { group: { budgetId: budget.id } },
      include: { group: true },
    }),
    prisma.transaction.findMany({
      where: {
        account: { budgetId: budget.id },
        isParent: false,
        date: { gte: `${start}-01`, lte: `${end}-31` },
      },
      include: { payee: true, category: true, account: true },
    }),
  ]);

  const catById = new Map(categories.map((c) => [c.id, c]));
  const months: string[] = [];
  for (let i = 0; i < span; i++) months.push(addMonths(start, i));

  // Spending by category (outflows, exclude transfers & income cats)
  const spendByCat = new Map<string, number>();
  const spendByPayee = new Map<string, number>();
  const incomeByMonth = new Map<string, number>();
  const expenseByMonth = new Map<string, number>();
  type Overlay = {
    id: string;
    label: string;
    date?: string;
    amount: number;
    href?: string;
  };
  const itemsByCat = new Map<string, Overlay[]>();
  const itemsByPayee = new Map<string, Overlay[]>();
  const incomeItemsByMonth = new Map<string, Overlay[]>();
  const expenseItemsByMonth = new Map<string, Overlay[]>();

  function pushTop(
    map: Map<string, Overlay[]>,
    key: string,
    item: Overlay,
    limit = 8,
  ) {
    const list = map.get(key) ?? [];
    list.push(item);
    list.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    map.set(key, list.slice(0, limit));
  }

  for (const m of months) {
    incomeByMonth.set(m, 0);
    expenseByMonth.set(m, 0);
  }

  for (const t of transactions) {
    if (t.transferTwinId) continue;
    if (!t.account.onBudget) continue;
    const m = t.date.slice(0, 7);
    const overlay: Overlay = {
      id: t.id,
      label: t.payee?.name || t.notes || t.category?.name || "Transaction",
      date: t.date,
      amount: t.amount / 100,
      href: `/transactions/${t.id}`,
    };
    if (t.amount < 0) {
      expenseByMonth.set(m, (expenseByMonth.get(m) ?? 0) + Math.abs(t.amount));
      pushTop(expenseItemsByMonth, m, {
        ...overlay,
        amount: Math.abs(t.amount) / 100,
      });
      if (t.categoryId) {
        const cat = catById.get(t.categoryId);
        if (cat && !cat.isIncome) {
          spendByCat.set(
            cat.name,
            (spendByCat.get(cat.name) ?? 0) + Math.abs(t.amount),
          );
          pushTop(itemsByCat, cat.name, {
            ...overlay,
            amount: Math.abs(t.amount) / 100,
          });
        }
      }
      const payee = t.payee?.name ?? "Unknown";
      spendByPayee.set(payee, (spendByPayee.get(payee) ?? 0) + Math.abs(t.amount));
      pushTop(itemsByPayee, payee, {
        ...overlay,
        amount: Math.abs(t.amount) / 100,
      });
    } else if (t.amount > 0) {
      const cat = t.categoryId ? catById.get(t.categoryId) : null;
      if (!t.categoryId || cat?.isIncome || t.isStartingBalance) {
        incomeByMonth.set(m, (incomeByMonth.get(m) ?? 0) + t.amount);
        pushTop(incomeItemsByMonth, m, overlay);
      }
    }
  }

  const spendingData = [...spendByCat.entries()]
    .map(([name, value]) => ({
      name,
      value,
      items: itemsByCat.get(name) ?? [],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const payeeData = [...spendByPayee.entries()]
    .map(([name, value]) => ({
      name,
      value,
      items: itemsByPayee.get(name) ?? [],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const incomeExpense = months.map((m) => ({
    month: m.slice(5),
    income: (incomeByMonth.get(m) ?? 0) / 100,
    expense: (expenseByMonth.get(m) ?? 0) / 100,
    net: ((incomeByMonth.get(m) ?? 0) - (expenseByMonth.get(m) ?? 0)) / 100,
    incomeItems: incomeItemsByMonth.get(m) ?? [],
    expenseItems: expenseItemsByMonth.get(m) ?? [],
  }));

  // Net worth: sum all account balances as of end of each month (approx using all tx up to month)
  const allTx = await prisma.transaction.findMany({
    where: { account: { budgetId: budget.id }, isChild: false },
    select: { accountId: true, date: true, amount: true },
  });
  const netWorth = months.map((m) => {
    let assets = 0;
    let debts = 0;
    for (const a of accounts) {
      const bal = allTx
        .filter((t) => t.accountId === a.id && t.date <= `${m}-31`)
        .reduce((s, t) => s + t.amount, 0);
      if (a.type === "CREDIT_CARD" || a.type === "TRACKING_LIABILITY") {
        debts += Math.abs(Math.min(0, bal));
        if (bal > 0) assets += bal;
      } else {
        if (bal >= 0) assets += bal;
        else debts += Math.abs(bal);
      }
    }
    return {
      month: m.slice(5),
      assets: assets / 100,
      debts: debts / 100,
      net: (assets - debts) / 100,
    };
  });

  const totalSpend = spendingData.reduce((s, x) => s + x.value, 0);

  const receiptLines = await prisma.receiptScanLine.findMany({
    where: {
      scan: {
        budgetId: budget.id,
        status: { in: ["ok", "preview"] },
        transaction: {
          date: { gte: `${start}-01`, lte: `${end}-31` },
        },
      },
      amountCents: { gt: 0 },
    },
    include: {
      matchedRule: { include: { category: true } },
      scan: {
        select: {
          status: true,
          transactionId: true,
        },
      },
    },
    take: 500,
  });

  const receiptByCat = new Map<string, number>();
  const receiptItemsByCat = new Map<string, Overlay[]>();
  const topReceiptItems: {
    description: string;
    amountCents: number;
    category: string;
  }[] = [];
  for (const line of receiptLines) {
    if (line.matchedRule?.ignore) continue;
    const cat =
      line.matchedRule?.category?.name ||
      line.categoryHint ||
      "Unknown";
    receiptByCat.set(cat, (receiptByCat.get(cat) ?? 0) + line.amountCents);
    pushTop(receiptItemsByCat, cat, {
      id: line.id,
      label: line.description,
      amount: line.amountCents / 100,
      href: line.scan.transactionId
        ? `/transactions/${line.scan.transactionId}`
        : undefined,
    });
    topReceiptItems.push({
      description: line.description,
      amountCents: line.amountCents,
      category: cat,
    });
  }
  topReceiptItems.sort((a, b) => b.amountCents - a.amountCents);
  const receiptCatRows = [...receiptByCat.entries()]
    .map(([name, value]) => ({
      name,
      value,
      items: receiptItemsByCat.get(name) ?? [],
    }))
    .sort((a, b) => b.value - a.value);
  const detailedParentIds = await prisma.receiptScan.findMany({
    where: {
      budgetId: budget.id,
      status: "ok",
      transaction: { date: { gte: `${start}-01`, lte: `${end}-31` } },
    },
    select: { transactionId: true },
    distinct: ["transactionId"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Reflect</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Last {span} months · {formatMoney(totalSpend, budget.currency)} spending
          in top categories
          {detailedParentIds.length > 0
            ? ` · ${detailedParentIds.length} receipt-detailed`
            : ""}
        </p>
      </div>

      <ReflectCharts
        currency={budget.currency}
        spending={spendingData.map((d) => ({
          name: d.name,
          value: d.value / 100,
          items: d.items,
        }))}
        payees={payeeData.map((d) => ({
          name: d.name,
          value: d.value / 100,
          items: d.items,
        }))}
        incomeExpense={incomeExpense}
        netWorth={netWorth}
        receiptSpending={receiptCatRows.slice(0, 12).map((d) => ({
          name: d.name,
          value: d.value / 100,
          items: d.items,
        }))}
      />

      {receiptCatRows.length > 0 ? (
        <section className={`${cardClass} p-4`}>
          <h2 className="text-sm font-semibold text-fg">
            Receipt-detailed spending
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            From Gemini bill scans in this range (line items, not bank memos).
            Charts above summarize the same data.
          </p>
          <ul className="mt-3 divide-y divide-rim-subtle md:hidden">
            {receiptCatRows.slice(0, 12).map((row) => (
              <li
                key={row.name}
                className="flex justify-between gap-3 py-2 text-sm"
              >
                <span className="text-fg">{row.name}</span>
                <span className="tabular-nums text-fg">
                  {formatMoney(row.value, budget.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-fg-muted">
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {receiptCatRows.slice(0, 12).map((row) => (
                  <tr key={row.name} className="border-t border-rim-subtle">
                    <td className="py-2 pr-3 text-fg">{row.name}</td>
                    <td className="py-2 text-right tabular-nums text-fg">
                      {formatMoney(row.value, budget.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {topReceiptItems.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                Top line items
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-fg-muted">
                {topReceiptItems.slice(0, 8).map((item, i) => (
                  <li
                    key={`${item.description}-${i}`}
                    className="flex justify-between gap-2"
                  >
                    <span className="min-w-0 truncate">
                      {item.description}
                      <span className="text-fg-subtle"> · {item.category}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatMoney(item.amountCents, budget.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold text-fg">Income vs Expense</h2>
        <ul className="mt-3 divide-y divide-rim-subtle md:hidden">
          {incomeExpense.map((row) => (
            <li key={row.month} className="space-y-1 py-3 text-sm">
              <div className="font-medium text-fg">{row.month}</div>
              <div className="flex justify-between text-fg-muted">
                <span>Income</span>
                <span className="tabular-nums text-ok">
                  {formatMoney(Math.round(row.income * 100), budget.currency)}
                </span>
              </div>
              <div className="flex justify-between text-fg-muted">
                <span>Expense</span>
                <span className="tabular-nums">
                  {formatMoney(Math.round(row.expense * 100), budget.currency)}
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Net</span>
                <span
                  className={`tabular-nums ${
                    row.net >= 0 ? "text-ok" : "text-danger"
                  }`}
                >
                  {formatMoney(Math.round(row.net * 100), budget.currency)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-fg-muted">
                <th className="py-2 pr-3 font-medium">Month</th>
                <th className="py-2 pr-3 font-medium">Income</th>
                <th className="py-2 pr-3 font-medium">Expense</th>
                <th className="py-2 font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {incomeExpense.map((row) => (
                <tr key={row.month} className="border-t border-rim-subtle">
                  <td className="py-2 pr-3 text-fg">{row.month}</td>
                  <td className="py-2 pr-3 tabular-nums text-ok">
                    {formatMoney(Math.round(row.income * 100), budget.currency)}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-fg">
                    {formatMoney(
                      Math.round(row.expense * 100),
                      budget.currency,
                    )}
                  </td>
                  <td
                    className={`py-2 tabular-nums font-medium ${
                      row.net >= 0 ? "text-ok" : "text-danger"
                    }`}
                  >
                    {formatMoney(Math.round(row.net * 100), budget.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
