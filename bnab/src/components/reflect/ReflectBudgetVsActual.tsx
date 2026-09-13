import Link from "next/link";
import { formatMoney } from "@/lib/money";
import {
  cardClass,
  tableClass,
  tdClass,
  thClass,
} from "@/components/forms/field-classes";

export type BudgetVsActualRow = {
  categoryId: string;
  name: string;
  assigned: number;
  spent: number;
  available: number;
  suggested: number;
  overspent: boolean;
};

export function ReflectBudgetVsActual({
  rows,
  nextMonth,
  currency,
}: {
  rows: BudgetVsActualRow[];
  nextMonth: string;
  currency: string;
}) {
  if (rows.length === 0) return null;

  return (
    <section className={`${cardClass} p-3 sm:p-4`}>
      <h2 className="text-sm font-semibold text-fg">Budget vs actual</h2>
      <p className="mt-1 text-xs text-fg-muted">
        Assigned vs spent for the focus month. Suggested is a 3-month average
        (display only) for planning {nextMonth}.
      </p>

      <ul className="mt-3 divide-y divide-rim-subtle md:hidden">
        {rows.slice(0, 14).map((r) => (
          <li key={r.categoryId} className="space-y-1 py-2.5 text-sm">
            <Link
              href={`/plan?month=${nextMonth}#cat-${r.categoryId}`}
              className="font-medium text-fg hover:text-accent"
            >
              {r.name}
            </Link>
            <div className="flex justify-between text-fg-muted">
              <span>Assigned</span>
              <span className="tabular-nums">
                {formatMoney(r.assigned, currency)}
              </span>
            </div>
            <div className="flex justify-between text-fg-muted">
              <span>Spent</span>
              <span className="tabular-nums">
                {formatMoney(r.spent, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Available</span>
              <span
                className={`tabular-nums font-medium ${
                  r.overspent
                    ? "text-danger"
                    : r.available > 0
                      ? "text-ok"
                      : "text-fg"
                }`}
              >
                {formatMoney(r.available, currency)}
              </span>
            </div>
            <div className="flex justify-between text-fg-subtle">
              <span>Suggested next</span>
              <span className="tabular-nums">
                {formatMoney(r.suggested, currency)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Category</th>
              <th className={`${thClass} text-right`}>Assigned</th>
              <th className={`${thClass} text-right`}>Spent</th>
              <th className={`${thClass} text-right`}>Available</th>
              <th className={`${thClass} text-right`}>Suggested next</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 16).map((r) => (
              <tr key={r.categoryId} className="border-t border-rim-subtle">
                <td className={tdClass}>
                  <Link
                    href={`/plan?month=${nextMonth}#cat-${r.categoryId}`}
                    className="text-fg hover:text-accent"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {formatMoney(r.assigned, currency)}
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {formatMoney(r.spent, currency)}
                </td>
                <td
                  className={`${tdClass} text-right tabular-nums font-medium ${
                    r.overspent
                      ? "text-danger"
                      : r.available > 0
                        ? "text-ok"
                        : ""
                  }`}
                >
                  {formatMoney(r.available, currency)}
                </td>
                <td className={`${tdClass} text-right tabular-nums text-fg-muted`}>
                  {formatMoney(r.suggested, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
