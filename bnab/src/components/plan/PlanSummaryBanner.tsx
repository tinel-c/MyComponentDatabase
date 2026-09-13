import { formatMoney } from "@/lib/money";
import { moneyClass } from "@/components/forms/field-classes";
import { assignFromPlannedAction } from "@/app/(app)/plan/actions";

type Props = {
  rta: number;
  incomeToRta: number;
  toSavings?: number;
  totalAssigned: number;
  spent?: number;
  currency: string;
  month?: string;
};

export function PlanSummaryBanner({
  rta,
  incomeToRta,
  toSavings = 0,
  totalAssigned,
  spent = 0,
  currency,
  month,
}: Props) {
  const state = rta === 0 ? "zero" : rta < 0 ? "over" : "ready";

  const tint =
    state === "zero"
      ? "bg-ok/15 text-ok border-ok/30"
      : state === "over"
        ? "bg-danger-muted text-danger-fg border-danger/40"
        : "bg-accent-muted text-accent border-accent/30";

  const headline =
    state === "zero"
      ? "All money has a job"
      : state === "over"
        ? "Assigned too much"
        : "Ready to Assign";

  const hint =
    state === "zero"
      ? "Nice — every dollar is assigned"
      : state === "over"
        ? "Reduce assignments until this is 0"
        : "Assign this to categories until it’s 0";

  return (
    <div
      className={`sticky top-14 z-20 rounded-xl border px-3 py-2 shadow-sm backdrop-blur-sm md:top-4 ${tint}`}
      style={{
        boxShadow:
          "0 8px 24px color-mix(in oklch, var(--glow-accent) 18%, transparent)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
            {headline}
          </p>
          <p className={`mt-0.5 text-xl font-semibold leading-none ${moneyClass}`}>
            {formatMoney(rta, currency)}
          </p>
          <p className="mt-1 truncate text-[10px] leading-tight opacity-75">
            {hint}
          </p>
        </div>
        <div className="shrink-0 text-right text-[10px] leading-snug opacity-80">
          <p>
            Income{" "}
            <span className={`font-medium ${moneyClass}`}>
              {formatMoney(incomeToRta, currency)}
            </span>
          </p>
          {toSavings !== 0 ? (
            <p className="mt-0.5">
              To savings{" "}
              <span className={`font-medium ${moneyClass}`}>
                {formatMoney(toSavings, currency)}
              </span>
            </p>
          ) : null}
          <p className="mt-0.5">
            Assigned{" "}
            <span className={`font-medium ${moneyClass}`}>
              {formatMoney(totalAssigned, currency)}
            </span>
          </p>
          <p className="mt-0.5">
            Spent{" "}
            <span className={`font-medium ${moneyClass}`}>
              {formatMoney(spent, currency)}
            </span>
          </p>
          {month ? (
            <form action={assignFromPlannedAction} className="mt-1.5">
              <input type="hidden" name="month" value={month} />
              <button
                type="submit"
                title="Set Assigned to at least this month’s planned payment totals"
                className="font-medium text-accent hover:underline"
              >
                Assign from planned
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
