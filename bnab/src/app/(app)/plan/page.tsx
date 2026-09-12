import Link from "next/link";
import { ChevronLeft, ChevronRight, Landmark, Wallet } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { loadPlanMonth } from "@/lib/plan-data";
import { addMonths, currentMonth, formatMoney, monthLabel } from "@/lib/money";
import { MoveMoneyForm } from "@/components/plan/MoveMoneyForm";
import { PlanSummaryBanner } from "@/components/plan/PlanSummaryBanner";
import { CategoryIcon } from "@/components/plan/CategoryIcon";
import { PlanCategoryList } from "@/components/plan/PlanCategoryList";
import {
  buttonSecondaryClass,
  cardClass,
  moneyClass,
} from "@/components/forms/field-classes";
import { groupAccent } from "@/lib/ui-accents";

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
    spendingByAccount,
  } = await loadPlanMonth(budget.id, month);
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);

  const incomeGroups = groups.filter((g) => g.isIncome);
  const spendingGroups = groups.filter((g) => !g.isIncome);

  const incomeReceived = incomeGroups.reduce((sum, g) => {
    return (
      sum +
      g.categories.reduce((s, c) => s + (plan.categories[c.id]?.activity ?? 0), 0)
    );
  }, 0);

  const spendingActivitySum = spendingGroups.reduce((sum, g) => {
    return (
      sum +
      g.categories.reduce((s, c) => s + (plan.categories[c.id]?.activity ?? 0), 0)
    );
  }, 0);
  /** Display magnitude of month spend (activity is negative for outflows). */
  const spendingTotal = -spendingActivitySum;

  const onBudgetAccounts = accountBalances.filter((a) => a.onBudget);
  const totalOnBudget = onBudgetAccounts.reduce((s, a) => s + a.balance, 0);
  const totalAccountIncome = onBudgetAccounts.reduce(
    (s, a) => s + (incomeByAccount[a.id] ?? 0),
    0,
  );
  const totalAccountSpending = onBudgetAccounts.reduce(
    (s, a) => s + (spendingByAccount[a.id] ?? 0),
    0,
  );

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
        <h1 className="text-center text-xl font-semibold tracking-tight text-fg">
          {monthLabel(month)}
        </h1>
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
        totalAssigned={plan.totalAssigned}
        currency={currency}
      />

      {/* Income → Spending → Accounts (desktop); Categories assign stays below */}
      <div className="space-y-3">
        <div className="hidden items-center justify-between gap-2 px-1 md:flex">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
              Income
            </h2>
            <p className="text-xs text-fg-subtle">
              Received this month{" "}
              <Link
                href={`/transactions?month=${encodeURIComponent(month)}&flow=income`}
                className="font-medium text-fg underline-offset-2 hover:underline"
              >
                {formatMoney(incomeReceived, currency)}
              </Link>{" "}
              — income categories only (banner Income may also include starting
              balances / adjustments)
            </p>
          </div>
          <Link
            href="/transactions/new?inflow=1"
            prefetch
            className={`${buttonSecondaryClass} shrink-0 px-3 text-xs`}
          >
            Add income
          </Link>
        </div>

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

        <div className="hidden items-center justify-between gap-2 px-1 md:flex">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
              Spending
            </h2>
            <p className="text-xs text-fg-subtle">
              Spent this month{" "}
              <Link
                href={`/transactions?month=${encodeURIComponent(month)}&flow=spending`}
                className="font-medium text-fg underline-offset-2 hover:underline"
              >
                {formatMoney(spendingTotal, currency)}
              </Link>{" "}
              — by category group (details in Categories below)
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          {spendingGroups.length === 0 ? (
            <section
              className={`${cardClass} px-4 py-6 text-center text-sm text-fg-muted`}
            >
              No spending categories yet. Add groups under More → Categories.
            </section>
          ) : (
            <section className={`${cardClass} overflow-hidden`}>
              <ul className="divide-y divide-rim-subtle/60">
                {spendingGroups.map((group) => {
                  const groupActivity = group.categories.reduce(
                    (s, c) => s + (plan.categories[c.id]?.activity ?? 0),
                    0,
                  );
                  const spent = -groupActivity;
                  return (
                    <li
                      key={group.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                      style={{
                        borderLeft: `4px solid ${groupAccent(group.name)}`,
                      }}
                    >
                      <p className="min-w-0 truncate text-sm font-semibold text-fg">
                        {group.name}
                      </p>
                      <Link
                        href={`/transactions?groupId=${encodeURIComponent(group.id)}&month=${encodeURIComponent(month)}`}
                        prefetch
                        className={`shrink-0 text-sm font-semibold underline-offset-2 hover:underline ${moneyClass} ${
                          groupActivity < 0 ? "text-danger" : "text-fg-muted"
                        }`}
                        title="View transactions in this group"
                      >
                        {formatMoney(spent, currency)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {onBudgetAccounts.length > 0 && (
          <section className={`hidden ${cardClass} overflow-hidden md:block`}>
            <div
              className="border-b border-rim-subtle px-4 py-2.5"
              style={{
                borderLeft: `4px solid var(--ok)`,
                background: "color-mix(in oklch, var(--ok) 10%, transparent)",
              }}
            >
              <h3 className="text-sm font-semibold text-fg">
                Accounts · income / spending / remaining
              </h3>
              <p className="mt-0.5 text-[11px] text-fg-subtle">
                Month income & spending by account · remaining is balance through
                month end
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="border-b border-rim-subtle text-left text-[11px] uppercase tracking-wide text-fg-subtle">
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 text-right font-medium">Income</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Spending
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Remaining
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rim-subtle/60">
                  {onBudgetAccounts.map((a) => {
                    const income = incomeByAccount[a.id] ?? 0;
                    const spending = spendingByAccount[a.id] ?? 0;
                    const spendingMag = -spending;
                    return (
                      <tr key={a.id}>
                        <td className="px-3 py-2">
                          <span className="flex min-w-0 items-center gap-2 text-fg-muted">
                            <Landmark
                              className="size-3.5 shrink-0"
                              style={{ color: "var(--accent)" }}
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
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/transactions?accountId=${encodeURIComponent(a.id)}&month=${encodeURIComponent(month)}&flow=spending`}
                            className={`font-semibold underline-offset-2 hover:underline ${moneyClass} ${
                              spending < 0 ? "text-danger" : "text-fg-muted"
                            }`}
                            title="Spending transactions this month"
                          >
                            {formatMoney(spendingMag, currency)}
                          </Link>
                        </td>
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
                        Total on-budget
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${moneyClass} text-ok`}
                    >
                      {formatMoney(totalAccountIncome, currency)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${moneyClass} text-danger`}
                    >
                      {formatMoney(-totalAccountSpending, currency)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${moneyClass} ${
                        totalOnBudget < 0 ? "text-danger" : "text-ok"
                      }`}
                    >
                      {formatMoney(totalOnBudget, currency)}
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

      <div className={`hidden ${cardClass} p-4 md:block`}>
        <h2 className="text-sm font-semibold text-fg">Move money</h2>
        <p className="mt-1 text-xs text-fg-muted">
          Shift assigned amounts between envelopes without changing Ready to
          Assign.
        </p>
        <div className="mt-3">
          <MoveMoneyForm
            month={month}
            categories={spendingGroups.flatMap((g) =>
              g.categories.map((c) => ({ id: c.id, name: c.name })),
            )}
          />
        </div>
      </div>

      <p className="hidden px-1 text-center text-xs text-fg-subtle md:block">
        Ready to Assign = Income (to RTA) − Assigned − hold. Drive RTA to 0.
      </p>
    </div>
  );
}
