import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { addMonths, currentMonth, formatMoney } from "@/lib/money";
import { cardClass } from "@/components/forms/field-classes";
import { ReflectCharts } from "@/components/reflect/ReflectCharts";

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

  for (const m of months) {
    incomeByMonth.set(m, 0);
    expenseByMonth.set(m, 0);
  }

  for (const t of transactions) {
    if (t.transferTwinId) continue;
    if (!t.account.onBudget) continue;
    const m = t.date.slice(0, 7);
    if (t.amount < 0) {
      expenseByMonth.set(m, (expenseByMonth.get(m) ?? 0) + Math.abs(t.amount));
      if (t.categoryId) {
        const cat = catById.get(t.categoryId);
        if (cat && !cat.isIncome) {
          spendByCat.set(
            cat.name,
            (spendByCat.get(cat.name) ?? 0) + Math.abs(t.amount),
          );
        }
      }
      const payee = t.payee?.name ?? "Unknown";
      spendByPayee.set(payee, (spendByPayee.get(payee) ?? 0) + Math.abs(t.amount));
    } else if (t.amount > 0) {
      const cat = t.categoryId ? catById.get(t.categoryId) : null;
      if (!t.categoryId || cat?.isIncome || t.isStartingBalance) {
        incomeByMonth.set(m, (incomeByMonth.get(m) ?? 0) + t.amount);
      }
    }
  }

  const spendingData = [...spendByCat.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const payeeData = [...spendByPayee.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const incomeExpense = months.map((m) => ({
    month: m.slice(5),
    income: (incomeByMonth.get(m) ?? 0) / 100,
    expense: (expenseByMonth.get(m) ?? 0) / 100,
    net: ((incomeByMonth.get(m) ?? 0) - (expenseByMonth.get(m) ?? 0)) / 100,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Reflect</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Last {span} months · {formatMoney(totalSpend, budget.currency)} spending in top categories
        </p>
      </div>

      <ReflectCharts
        currency={budget.currency}
        spending={spendingData.map((d) => ({ ...d, value: d.value / 100 }))}
        payees={payeeData.map((d) => ({ ...d, value: d.value / 100 }))}
        incomeExpense={incomeExpense}
        netWorth={netWorth}
      />

      <section className={`${cardClass} overflow-x-auto p-4`}>
        <h2 className="text-sm font-semibold text-fg">Income vs Expense</h2>
        <table className="mt-3 w-full min-w-[28rem] text-left text-sm">
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
                  {formatMoney(Math.round(row.expense * 100), budget.currency)}
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
      </section>
    </div>
  );
}
