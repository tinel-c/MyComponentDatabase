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

  const { groups, plan, currency, accountBalances } = await loadPlanMonth(
    budget.id,
    month,
  );
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

  const onBudgetAccounts = accountBalances.filter((a) => a.onBudget);
  const totalOnBudget = onBudgetAccounts.reduce((s, a) => s + a.balance, 0);

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

      {/* Income + accounts — desktop only for Income; accounts stay visible */}
      <div className="space-y-3">
        <div className="hidden items-center justify-between gap-2 px-1 md:flex">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
              Income
            </h2>
            <p className="text-xs text-fg-subtle">
              Received this month {formatMoney(incomeReceived, currency)} — goes
              to Ready to Assign
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

        {onBudgetAccounts.length > 0 && (
          <section className={`hidden ${cardClass} overflow-hidden md:block`}>
            <h3
              className="border-b border-rim-subtle px-4 py-2.5 text-sm font-semibold text-fg"
              style={{
                borderLeft: `4px solid var(--ok)`,
                background: "color-mix(in oklch, var(--ok) 10%, transparent)",
              }}
            >
              Accounts · remaining
            </h3>
            <ul className="divide-y divide-rim-subtle/60 px-3 py-1">
              {onBudgetAccounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 py-2 text-sm"
                >
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
                  <span
                    className={`shrink-0 font-semibold ${moneyClass} ${
                      a.balance < 0 ? "text-danger" : "text-fg"
                    }`}
                  >
                    {formatMoney(a.balance, currency)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="flex items-center gap-2 font-medium text-fg">
                  <Wallet
                    className="size-3.5 shrink-0"
                    style={{ color: "var(--ok)" }}
                    aria-hidden
                  />
                  Total on-budget
                </span>
                <span
                  className={`font-semibold ${moneyClass} ${
                    totalOnBudget < 0 ? "text-danger" : "text-ok"
                  }`}
                >
                  {formatMoney(totalOnBudget, currency)}
                </span>
              </li>
            </ul>
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
        Income increases Ready to Assign. Assign dollars into categories until
        RTA is 0.
      </p>
    </div>
  );
}
