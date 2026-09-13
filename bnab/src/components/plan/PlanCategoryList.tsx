"use client";

import Link from "next/link";
import { AssignCell } from "@/components/plan/AssignCell";
import { AssignQuickButtons } from "@/components/plan/AssignQuickButtons";
import { CategoryIcon } from "@/components/plan/CategoryIcon";
import { PlanEmptyToggle } from "@/components/plan/PlanEmptyToggle";
import { usePlanWorkspaceOptional } from "@/components/plan/PlanWorkspace";
import { moneyClass } from "@/components/forms/field-classes";
import { formatMoney } from "@/lib/money";
import {
  planHref,
  rowMatchesPlanFocus,
  type PlanFocusFilter,
} from "@/lib/plan-url";

function activityHref(categoryId: string, month: string) {
  return `/transactions?categoryId=${encodeURIComponent(categoryId)}&month=${encodeURIComponent(month)}`;
}

type Cat = { id: string; name: string };

type Props = {
  groupName: string;
  categories: Cat[];
  month: string;
  currency: string;
  rta: number;
  showEmpty: boolean;
  focus: PlanFocusFilter | null;
  rows: Record<
    string,
    { available: number; activity: number; assigned: number }
  >;
};

/** Compact amount without currency code — fits narrow plan columns. */
function planAmount(minor: number): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** Desktop: Category · Activity · Assigned · Available · Quick */
const DESKTOP_GRID =
  "grid-cols-[minmax(0,1fr)_6rem_6.5rem_6rem_5.75rem] gap-x-3";

/**
 * Mobile single row — Category | Activity | Assign | Available
 */
const MOBILE_GRID =
  "grid grid-cols-[minmax(0,1fr)_3.25rem_4.25rem_3.5rem] items-center gap-x-1";

export function PlanCategoryList({
  groupName,
  categories,
  month,
  currency,
  rta,
  showEmpty,
  focus,
  rows,
}: Props) {
  const workspace = usePlanWorkspaceOptional();
  const liveRows = workspace?.rows ?? rows;
  const liveRta = workspace?.rta ?? rta;

  const enriched = categories.map((cat) => {
    const row = liveRows[cat.id];
    const available = row?.available ?? 0;
    const activity = row?.activity ?? 0;
    const assigned = row?.assigned ?? 0;
    const isEmpty = assigned === 0 && available === 0 && activity === 0;
    const matchesFocus = rowMatchesPlanFocus(focus, {
      available,
      activity,
      assigned,
    });
    return { cat, available, activity, assigned, isEmpty, matchesFocus };
  });

  const visible = enriched.filter((e) => e.matchesFocus);
  const emptyCount = visible.filter((e) => e.isEmpty).length;

  const showEmptyHref = planHref({ month, empty: true, focus });
  const hideEmptyHref = planHref({ month, empty: false, focus });

  if (focus && visible.length === 0) {
    return (
      <p className="px-3 py-3 text-center text-xs text-fg-muted">
        No categories match this filter.
      </p>
    );
  }

  return (
    <PlanEmptyToggle
      showEmpty={showEmpty}
      emptyCount={emptyCount}
      showEmptyHref={showEmptyHref}
      hideEmptyHref={hideEmptyHref}
    >
      <ul className="divide-y divide-rim-subtle/60">
        <li
          className={`${MOBILE_GRID} h-7 px-2 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle md:hidden`}
        >
          <span className="truncate">Category</span>
          <span className="text-right">Act</span>
          <span className="text-right">Assign</span>
          <span className="text-right">Avail</span>
        </li>

        <li
          className={`hidden h-8 ${DESKTOP_GRID} items-center px-3 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle md:grid`}
        >
          <span>Category</span>
          <span className="text-right">Activity</span>
          <span className="text-right">Assigned</span>
          <span className="text-right">Available</span>
          <span className="text-center">Quick</span>
        </li>

        {visible.map(({ cat, available, activity, assigned, isEmpty }) => (
          <li
            key={cat.id}
            className={
              isEmpty
                ? "max-md:group-data-[show-empty=0]/plan-empty:hidden"
                : undefined
            }
          >
            <div
              className={`${MOBILE_GRID} min-h-9 px-2 py-1 md:hidden`}
              title={cat.name}
            >
              <span className="min-w-0 truncate text-[13px] font-medium leading-none text-fg">
                {cat.name}
              </span>
              <Link
                href={activityHref(cat.id, month)}
                prefetch
                className={`whitespace-nowrap text-right text-[11px] leading-none text-fg-muted underline-offset-2 hover:text-accent hover:underline ${moneyClass}`}
                title={`View transactions · ${formatMoney(activity, currency)}`}
              >
                {planAmount(activity)}
              </Link>
              <div className="min-w-0">
                <AssignCell
                  categoryId={cat.id}
                  month={month}
                  assigned={assigned}
                  currency={currency}
                />
              </div>
              <span
                className={`whitespace-nowrap text-right text-[11px] font-semibold leading-none ${moneyClass} ${
                  available < 0
                    ? "text-danger"
                    : available > 0
                      ? "text-ok"
                      : "text-fg-muted"
                }`}
              >
                {planAmount(available)}
              </span>
            </div>

            <div
              className={`hidden h-10 items-center px-3 md:grid ${DESKTOP_GRID}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <CategoryIcon name={cat.name} groupName={groupName} />
                <p className="min-w-0 truncate text-sm font-medium text-fg">
                  {cat.name}
                </p>
              </div>
              <Link
                href={activityHref(cat.id, month)}
                prefetch
                className={`truncate text-right text-sm text-fg-muted underline-offset-2 hover:text-accent hover:underline ${moneyClass}`}
                title={`View transactions · ${formatMoney(activity, currency)}`}
              >
                {planAmount(activity)}
              </Link>
              <div className="min-w-0">
                <AssignCell
                  categoryId={cat.id}
                  month={month}
                  assigned={assigned}
                  currency={currency}
                />
              </div>
              <p
                className={`truncate text-right text-sm font-semibold ${moneyClass} ${
                  available < 0
                    ? "text-danger"
                    : available > 0
                      ? "text-ok"
                      : "text-fg-muted"
                }`}
                title={formatMoney(available, currency)}
              >
                {planAmount(available)}
              </p>
              <div className="flex w-[5.75rem] justify-center">
                <AssignQuickButtons
                  categoryId={cat.id}
                  month={month}
                  available={available}
                  rta={liveRta}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </PlanEmptyToggle>
  );
}
