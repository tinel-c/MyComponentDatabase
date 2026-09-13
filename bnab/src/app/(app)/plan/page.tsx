import Link from "next/link";
import { ChevronLeft, ChevronRight, PiggyBank, Wallet } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { loadPlanMonthCached } from "@/lib/cache-tags";
import { addMonths, currentMonth, formatMoney, monthLabel } from "@/lib/money";
import { PlanSummaryBanner } from "@/components/plan/PlanSummaryBanner";
import { CategoryIcon } from "@/components/plan/CategoryIcon";
import { PlanCategoryList } from "@/components/plan/PlanCategoryList";
import {
  buttonCompactClass,
  cardClass,
  moneyClass,
} from "@/components/forms/field-classes";
import { accountTypeMeta, groupAccent } from "@/lib/ui-accents";
import { assignFromPlannedAction } from "./actions";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const month =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentMonth();

  const {
    groups,
    plan,
    currency,
    accountBalances,
    incomeByAccount,
    spendingByAccountByGroup,
    toSavingsByAccount,
  } = await loadPlanMonthCached(budget.id, month);
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);

  const incomeGroups = groups.filter((g) => g.isIncome);
  const spendingGroups = groups.filter((g) => !g.isIncome);

  const onBudgetAccounts = accountBalances.filter((a) => a.onBudget);
  const operatingAccounts = onBudgetAccounts.filter((a) => a.type !== "SAVINGS");
  const savingsAccounts = onBudgetAccounts.filter((a) => a.type === "SAVINGS");
  const totalOperating = operatingAccounts.reduce((s, a) => s + a.balance, 0);
  const totalSavings = savingsAccounts.reduce((s, a) => s + a.balance, 0);
  const totalAccountIncome = operatingAccounts.reduce(
    (s, a) => s + (incomeByAccount[a.id] ?? 0),
    0,
  );
  const totalToSavings = savingsAccounts.reduce(
    (s, a) => s + (toSavingsByAccount[a.id] ?? 0),
    0,
  );
  const totalByGroup = Object.fromEntries(
    spendingGroups.map((g) => [
      g.id,
      operatingAccounts.reduce(
        (s, a) => s + (spendingByAccountByGroup[a.id]?.[g.id] ?? 0),
        0,
      ),
    ]),
  ) as Record<string, number>;

  const spentThisMonth = spendingGroups.reduce(
    (sum, g) =>
      sum +
      g.categories.reduce(
        (s, c) => s + (plan.categories[c.id]?.activity ?? 0),
        0,
      ),
    0,
  );
  // Activity is signed (outflow negative); banner Spent is positive.
  const spentMagnitude = -spentThisMonth;

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/plan?month=${prev}`}
          className="rounded-full border border-rim p-2 text-fg-muted transition-colors hover:bg-overlay hover:text-fg active:scale-95"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="flex flex-col items-center gap-1.5">
          <h1 className="text-center text-xl font-semibold tracking-tight text-fg">
            {monthLabel(month)}
          </h1>
          <form action={assignFromPlannedAction}>
            <input type="hidden" name="month" value={month} />
            <button type="submit" className={buttonCompactClass}>
              Assign from planned
            </button>
          </form>
        </div>
        <Link
          href={`/plan?month=${next}`}
          className="rounded-full border border-rim p-2 text-fg-muted transition-colors hover:bg-overlay hover:text-fg active:scale-95"
          aria-label="Next month"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <PlanSummaryBanner
        rta={plan.rta}
        incomeToRta={plan.incomeToRta}
        toSavings={plan.toSavings}
        totalAssigned={plan.totalAssigned}
        spent={spentMagnitude}
        currency={currency}
      />

      {/* Income categories + Accounts (desktop); Categories assign stays below */}
      <div className="space-y-3">
        <div className="hidden space-y-3 md:block">
          {incomeGroups.length === 0 ? (
            <section
              className={`${cardClass} px-4 py-6 text-center text-sm text-fg-muted`}
            >
              No income categories yet. Add an Income group under More →
              Categories.
            </section>
          ) : (
            incomeGroups.map((group) => (
              <section key={group.id} className={`${cardClass} overflow-hidden`}>
                <h3
                  className="border-b border-rim-subtle px-4 py-3 text-sm font-semibold text-fg"
                  style={{
                    borderLeft: `4px solid ${groupAccent(group.name)}`,
                    background:
                      "color-mix(in oklch, var(--ok) 12%, transparent)",
                  }}
                >
                  {group.name}
                </h3>
                <ul className="divide-y divide-rim-subtle/60">
                  {group.categories.map((cat) => {
                    const activity = plan.categories[cat.id]?.activity ?? 0;
                    return (
                      <li
                        key={cat.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <CategoryIcon name={cat.name} groupName={group.name} />
                          <p className="min-w-0 truncate text-sm font-medium text-fg">
                            {cat.name}
                          </p>
                        </div>
                        <Link
                          href={`/transactions?categoryId=${encodeURIComponent(cat.id)}&month=${encodeURIComponent(month)}`}
                          prefetch
                          className={`shrink-0 text-sm font-semibold underline-offset-2 hover:underline ${moneyClass} ${
                            activity > 0 ? "text-ok" : "text-fg-muted"
                          }`}
                          title="View transactions that make up this activity"
                        >
                          {formatMoney(activity, currency)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>

        {operatingAccounts.length > 0 && (
          <section className={`hidden ${cardClass} overflow-hidden md:block`}>
            <div
              className="border-b border-rim-subtle px-4 py-2.5"
              style={{
                borderLeft: `4px solid var(--ok)`,
                background: "color-mix(in oklch, var(--ok) 10%, transparent)",
              }}
            >
              <h3 className="text-sm font-semibold text-fg">
                Accounts · income / groups / remaining
              </h3>
              <p className="mt-0.5 text-[11px] text-fg-subtle">
                Operating accounts only · savings are separate and do not count
                as income
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="border-b border-rim-subtle text-left text-[11px] uppercase tracking-wide text-fg-subtle">
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 text-right font-medium">Income</th>
                    {spendingGroups.map((g) => (
                      <th
                        key={g.id}
                        className="max-w-[7rem] truncate px-3 py-2 text-right font-medium"
                        title={g.name}
                        style={{ color: groupAccent(g.name) }}
                      >
                        {g.name}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">
                      Remaining
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rim-subtle/60">
                  {operatingAccounts.map((a) => {
                    const income = incomeByAccount[a.id] ?? 0;
                    const meta = accountTypeMeta(a.type);
                    const Icon = meta.icon;
                    return (
                      <tr key={a.id}>
                        <td className="px-3 py-2">
                          <span className="flex min-w-0 items-center gap-2 text-fg-muted">
                            <Icon
                              className="size-3.5 shrink-0"
                              style={{ color: meta.accent }}
                              aria-hidden
                            />
                            <Link
                              href={`/accounts/${a.id}`}
                              className="truncate hover:text-fg"
                            >
                              {a.name}
                            </Link>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/transactions?accountId=${encodeURIComponent(a.id)}&month=${encodeURIComponent(month)}&flow=income`}
                            className={`font-semibold underline-offset-2 hover:underline ${moneyClass} ${
                              income > 0 ? "text-ok" : "text-fg-muted"
                            }`}
                            title="Income transactions this month"
                          >
                            {formatMoney(income, currency)}
                          </Link>
                        </td>
                        {spendingGroups.map((g) => {
                          const amount =
                            spendingByAccountByGroup[a.id]?.[g.id] ?? 0;
                          const mag = -amount;
                          return (
                            <td key={g.id} className="px-3 py-2 text-right">
                              <Link
                                href={`/transactions?accountId=${encodeURIComponent(a.id)}&groupId=${encodeURIComponent(g.id)}&month=${encodeURIComponent(month)}`}
                                className={`font-semibold underline-offset-2 hover:underline ${moneyClass} ${
                                  amount < 0 ? "text-danger" : "text-fg-muted"
                                }`}
                                title={`${g.name} spending this month`}
                              >
                                {formatMoney(mag, currency)}
                              </Link>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/accounts/${a.id}`}
                            className={`font-semibold underline-offset-2 hover:underline ${moneyClass} ${
                              a.balance < 0 ? "text-danger" : "text-fg"
                            }`}
                            title="Account register (balance through month end)"
                          >
                            {formatMoney(a.balance, currency)}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-rim-subtle bg-overlay/30">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 font-medium text-fg">
                        <Wallet
                          className="size-3.5 shrink-0"
                          style={{ color: "var(--ok)" }}
                          aria-hidden
                        />
                        Total operating
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${moneyClass} text-ok`}
                    >
                      {formatMoney(totalAccountIncome, currency)}
                    </td>
                    {spendingGroups.map((g) => {
                      const total = totalByGroup[g.id] ?? 0;
                      return (
                        <td
                          key={g.id}
                          className={`px-3 py-2 text-right font-semibold ${moneyClass} ${
                            total < 0 ? "text-danger" : "text-fg-muted"
                          }`}
                        >
                          {formatMoney(-total, currency)}
                        </td>
                      );
                    })}
                    <td
                      className={`px-3 py-2 text-right font-semibold ${moneyClass} ${
                        totalOperating < 0 ? "text-danger" : "text-ok"
                      }`}
                    >
                      {formatMoney(totalOperating, currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {savingsAccounts.length > 0 && (
          <section className={`hidden ${cardClass} overflow-hidden md:block`}>
            <div
              className="border-b border-rim-subtle px-4 py-2.5"
              style={{
                borderLeft: "4px solid var(--accent)",
                background:
                  "color-mix(in oklch, var(--accent-muted) 35%, transparent)",
              }}
            >
              <h3 className="text-sm font-semibold text-fg">Savings</h3>
              <p className="mt-0.5 text-[11px] text-fg-subtle">
                Transfers in reduce Ready to Assign · not counted as income
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] text-sm">
                <thead>
                  <tr className="border-b border-rim-subtle text-left text-[11px] uppercase tracking-wide text-fg-subtle">
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Moved in
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Remaining
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rim-subtle/60">
                  {savingsAccounts.map((a) => {
                    const moved = toSavingsByAccount[a.id] ?? 0;
                    return (
                      <tr key={a.id}>
                        <td className="px-3 py-2">
                          <span className="flex min-w-0 items-center gap-2 text-fg-muted">
                            <PiggyBank
                              className="size-3.5 shrink-0"
                              style={{ color: "var(--ok)" }}
                              aria-hidden
                            />
                            <Link
                              href={`/accounts/${a.id}`}
                              className="truncate hover:text-fg"
                            >
                              {a.name}
                            </Link>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`font-semibold ${moneyClass} ${
                              moved > 0
                                ? "text-accent"
                                : moved < 0
                                  ? "text-ok"
                                  : "text-fg-muted"
                            }`}
                            title="Net transferred from operating accounts this month"
                          >
                            {formatMoney(moved, currency)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/accounts/${a.id}`}
                            className={`font-semibold underline-offset-2 hover:underline ${moneyClass} ${
                              a.balance < 0 ? "text-danger" : "text-fg"
                            }`}
                          >
                            {formatMoney(a.balance, currency)}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-rim-subtle bg-overlay/30">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 font-medium text-fg">
                        <PiggyBank
                          className="size-3.5 shrink-0"
                          style={{ color: "var(--ok)" }}
                          aria-hidden
                        />
                        Total savings
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${moneyClass} ${
                        totalToSavings > 0
                          ? "text-accent"
                          : totalToSavings < 0
                            ? "text-ok"
                            : "text-fg-muted"
                      }`}
                    >
                      {formatMoney(totalToSavings, currency)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${moneyClass} text-ok`}
                    >
                      {formatMoney(totalSavings, currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <div className="space-y-3 md:space-y-4">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Categories
        </h2>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:gap-4">
          {spendingGroups.map((group) => (
            <section key={group.id} className={`${cardClass} overflow-hidden`}>
              <h2
                className="border-b border-rim-subtle px-3 py-2 text-sm font-semibold text-fg md:px-4 md:py-2.5"
                style={{
                  borderLeft: `4px solid ${groupAccent(group.name)}`,
                  background:
                    "color-mix(in oklch, var(--accent-muted) 40%, transparent)",
                }}
              >
                {group.name}
              </h2>
              <PlanCategoryList
                groupName={group.name}
                categories={group.categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                }))}
                month={month}
                currency={currency}
                rta={plan.rta}
                rows={Object.fromEntries(
                  group.categories.map((c) => {
                    const row = plan.categories[c.id];
                    return [
                      c.id,
                      {
                        available: row?.available ?? 0,
                        activity: row?.activity ?? 0,
                        assigned: row?.assigned ?? 0,
                      },
                    ];
                  }),
                )}
              />
            </section>
          ))}
        </div>
      </div>

      <p className="hidden px-1 text-center text-xs text-fg-subtle md:block">
        Ready to Assign = Income − To savings − Assigned − hold. Drive RTA to 0.
      </p>
    </div>
  );
}
