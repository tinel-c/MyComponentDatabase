import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { addMonths, currentMonth, formatMoney } from "@/lib/money";
import { cardClass, tableClass, thClass, tdClass } from "@/components/forms/field-classes";
import { ReflectChartsLazy as ReflectCharts } from "@/components/reflect/ReflectChartsLazy";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart3 } from "lucide-react";
import Link from "next/link";

type Overlay = {
  id: string;
  label: string;
  date?: string;
  amount: number;
  href?: string;
};

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

/** Month-end balances via one sorted pass per account (prefix sums). */
function netWorthByMonth(
  accounts: { id: string; type: string }[],
  allTx: { accountId: string; date: string; amount: number }[],
  months: string[],
) {
  const byAccount = new Map<string, { date: string; amount: number }[]>();
  for (const t of allTx) {
    let list = byAccount.get(t.accountId);
    if (!list) {
      list = [];
      byAccount.set(t.accountId, list);
    }
    list.push(t);
  }

  type Prefix = { date: string; bal: number };
  const prefixes = new Map<string, Prefix[]>();
  for (const [accountId, list] of byAccount) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const pref: Prefix[] = [];
    let bal = 0;
    for (const t of list) {
      bal += t.amount;
      pref.push({ date: t.date, bal });
    }
    prefixes.set(accountId, pref);
  }

  function balanceAt(accountId: string, monthEnd: string): number {
    const pref = prefixes.get(accountId);
    if (!pref || pref.length === 0) return 0;
    // Last entry with date <= monthEnd
    let lo = 0;
    let hi = pref.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (pref[mid].date <= monthEnd) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans >= 0 ? pref[ans].bal : 0;
  }

  return months.map((m) => {
    const monthEnd = `${m}-31`;
    let assets = 0;
    let debts = 0;
    for (const a of accounts) {
      const bal = balanceAt(a.id, monthEnd);
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
}

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
  const rangeFrom = `${start}-01`;
  const rangeTo = `${end}-31`;

  const [accounts, categories, transactions, allTx, receiptLines, detailedParentIds] =
    await Promise.all([
      prisma.financeAccount.findMany({
        where: { budgetId: budget.id },
        select: { id: true, type: true, onBudget: true, name: true },
      }),
      prisma.category.findMany({
        where: { group: { budgetId: budget.id } },
        select: { id: true, name: true, isIncome: true },
      }),
      prisma.transaction.findMany({
        where: {
          account: { budgetId: budget.id },
          isParent: false,
          date: { gte: rangeFrom, lte: rangeTo },
        },
        select: {
          id: true,
          date: true,
          amount: true,
          categoryId: true,
          transferTwinId: true,
          isStartingBalance: true,
          notes: true,
          payee: { select: { name: true } },
          category: { select: { name: true } },
          account: { select: { onBudget: true } },
        },
      }),
      prisma.transaction.findMany({
        where: {
          account: { budgetId: budget.id },
          isChild: false,
          date: { lte: rangeTo },
        },
        select: { accountId: true, date: true, amount: true },
      }),
      prisma.receiptScanLine.findMany({
        where: {
          scan: {
            budgetId: budget.id,
            status: { in: ["ok", "preview"] },
            transaction: {
              date: { gte: rangeFrom, lte: rangeTo },
            },
          },
          amountCents: { gt: 0 },
        },
        select: {
          id: true,
          description: true,
          amountCents: true,
          categoryHint: true,
          matchedRule: {
            select: {
              ignore: true,
              category: { select: { name: true } },
            },
          },
          scan: { select: { transactionId: true } },
        },
        take: 500,
      }),
      prisma.receiptScan.findMany({
        where: {
          budgetId: budget.id,
          status: "ok",
          transaction: { date: { gte: rangeFrom, lte: rangeTo } },
        },
        select: { transactionId: true },
        distinct: ["transactionId"],
      }),
    ]);

  const catById = new Map(categories.map((c) => [c.id, c]));
  const months: string[] = [];
  for (let i = 0; i < span; i++) months.push(addMonths(start, i));

  const spendByCat = new Map<string, number>();
  const spendByPayee = new Map<string, number>();
  const incomeByMonth = new Map<string, number>();
  const expenseByMonth = new Map<string, number>();
  const itemsByCat = new Map<string, Overlay[]>();
  const itemsByPayee = new Map<string, Overlay[]>();
  const incomeItemsByMonth = new Map<string, Overlay[]>();
  const expenseItemsByMonth = new Map<string, Overlay[]>();

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

  const netWorth = netWorthByMonth(accounts, allTx, months);
  const totalSpend = spendingData.reduce((s, x) => s + x.value, 0);

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

  const spanLinks = [3, 6, 12].map((n) => (
    <Link
      key={n}
      href={`/reflect?months=${n}`}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        span === n
          ? "bg-accent-muted text-accent"
          : "text-fg-muted hover:bg-overlay hover:text-fg"
      }`}
    >
      {n} mo
    </Link>
  ));

  const hasAnyData =
    spendingData.length > 0 ||
    incomeExpense.some((r) => r.income > 0 || r.expense > 0) ||
    receiptCatRows.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
        <div className="flex flex-wrap gap-1.5">{spanLinks}</div>
      </div>

      {!hasAnyData ? (
        <EmptyState
          icon={BarChart3}
          title="Nothing to reflect on yet"
          description="Import a statement or add transactions — charts will appear here."
          action={
            <Link
              href="/more/import"
              className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg"
            >
              Import ING
            </Link>
          }
        />
      ) : (
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
      )}

      {receiptCatRows.length > 0 ? (
        <section className={`${cardClass} p-4`}>
          <h2 className="text-sm font-semibold text-fg">
            Receipt-detailed spending
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            From Gemini bill scans in this range (line items, not bank memos).
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
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Category</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {receiptCatRows.slice(0, 12).map((row) => (
                  <tr key={row.name} className="border-t border-rim-subtle">
                    <td className={tdClass}>{row.name}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>
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

      {hasAnyData ? (
        <details className={`${cardClass} p-4`}>
          <summary className="cursor-pointer text-sm font-semibold text-fg">
            Income vs Expense table
          </summary>
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
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Month</th>
                  <th className={thClass}>Income</th>
                  <th className={thClass}>Expense</th>
                  <th className={thClass}>Net</th>
                </tr>
              </thead>
              <tbody>
                {incomeExpense.map((row) => (
                  <tr key={row.month} className="border-t border-rim-subtle">
                    <td className={tdClass}>{row.month}</td>
                    <td className={`${tdClass} tabular-nums text-ok`}>
                      {formatMoney(Math.round(row.income * 100), budget.currency)}
                    </td>
                    <td className={`${tdClass} tabular-nums`}>
                      {formatMoney(
                        Math.round(row.expense * 100),
                        budget.currency,
                      )}
                    </td>
                    <td
                      className={`${tdClass} tabular-nums font-medium ${
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
        </details>
      ) : null}
    </div>
  );
}
