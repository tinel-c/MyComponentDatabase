import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { loadPlanMonth } from "@/lib/plan-data";
import { addMonths, currentMonth, formatMoney, monthLabel } from "@/lib/money";
import { AssignCell } from "@/components/plan/AssignCell";
import { MoveMoneyForm } from "@/components/plan/MoveMoneyForm";
import { cardClass } from "@/components/forms/field-classes";
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

  const { groups, plan, currency } = await loadPlanMonth(budget.id, month);
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);

  const rtaClass =
    plan.rta === 0
      ? "bg-ok/15 text-ok border-ok/30"
      : plan.rta < 0
        ? "bg-danger-muted text-danger-fg border-danger/40"
        : "bg-accent-muted text-accent border-accent/30";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/plan?month=${prev}`}
          className="rounded-full border border-rim p-2 text-fg-muted hover:bg-overlay"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-center text-xl font-semibold tracking-tight text-fg">
          {monthLabel(month)}
        </h1>
        <Link
          href={`/plan?month=${next}`}
          className="rounded-full border border-rim p-2 text-fg-muted hover:bg-overlay"
          aria-label="Next month"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <div className={`sticky top-14 z-20 rounded-2xl border px-4 py-3 md:top-4 ${rtaClass}`}>
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">
          Ready to Assign
        </p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatMoney(plan.rta, currency)}
        </p>
      </div>

      <div className="space-y-4">
        {groups
          .filter((g) => !g.isIncome)
          .map((group) => (
            <section key={group.id} className={`${cardClass} overflow-hidden`}>
              <h2
                className="border-b border-rim-subtle px-4 py-3 text-sm font-semibold text-fg"
                style={{
                  borderLeft: `4px solid ${groupAccent(group.name)}`,
                  background:
                    "color-mix(in oklch, var(--accent-muted) 40%, transparent)",
                }}
              >
                {group.name}
              </h2>
              <ul className="divide-y divide-rim-subtle/60">
                <li className="hidden grid-cols-[minmax(0,1.2fr)_5.5rem_5.5rem_5rem] gap-2 px-4 py-2 text-[10px] uppercase tracking-wide text-fg-subtle sm:grid">
                  <span>Category</span>
                  <span className="text-right">Activity</span>
                  <span className="text-right">Assigned</span>
                  <span className="text-right">Available</span>
                </li>
                {group.categories.map((cat) => {
                  const row = plan.categories[cat.id];
                  const available = row?.available ?? 0;
                  const activity = row?.activity ?? 0;
                  const assigned = row?.assigned ?? 0;
                  return (
                    <li
                      key={cat.id}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_5.5rem_5.5rem_5rem]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-fg">{cat.name}</p>
                        <p className="text-xs text-fg-subtle sm:hidden">
                          Act {formatMoney(activity, currency)}
                        </p>
                      </div>
                      <div className="hidden text-right text-sm tabular-nums text-fg-muted sm:block">
                        {formatMoney(activity, currency)}
                      </div>
                      <AssignCell
                        categoryId={cat.id}
                        month={month}
                        assigned={assigned}
                        currency={currency}
                      />
                      <p
                        className={`text-right text-sm font-semibold tabular-nums ${
                          available < 0
                            ? "text-danger"
                            : available > 0
                              ? "text-ok"
                              : "text-fg-muted"
                        }`}
                      >
                        {formatMoney(available, currency)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
      </div>

      <div className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold text-fg">Move money</h2>
        <p className="mt-1 text-xs text-fg-muted">
          Shift assigned amounts between envelopes without changing Ready to Assign.
        </p>
        <div className="mt-3">
          <MoveMoneyForm
            month={month}
            categories={groups
              .filter((g) => !g.isIncome)
              .flatMap((g) => g.categories.map((c) => ({ id: c.id, name: c.name })))}
          />
        </div>
      </div>

      <p className="px-1 text-center text-xs text-fg-subtle">
        Available = carry-in + assigned + activity. Aim for Ready to Assign = 0.
      </p>
    </div>
  );
}
