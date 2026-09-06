import { formatMoney } from "@/lib/money";
import { moneyClass } from "@/components/forms/field-classes";

type Props = {
  rta: number;
  incomeToRta: number;
  totalAssigned: number;
  currency: string;
};

/**
 * YNAB-style Ready to Assign strip:
 * - Positive → money left to give jobs (accent)
 * - Zero → all set (green)
 * - Negative → assigned too much (danger)
 */
export function PlanSummaryBanner({
  rta,
  incomeToRta,
  totalAssigned,
  currency,
}: Props) {
  const state =
    rta === 0 ? "zero" : rta < 0 ? "over" : "ready";

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
      className={`sticky top-14 z-20 rounded-xl border px-3 py-2 md:top-4 ${tint}`}
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
          <p className="mt-0.5">
            Assigned{" "}
            <span className={`font-medium ${moneyClass}`}>
              {formatMoney(totalAssigned, currency)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
