import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import type { ReflectOpportunity } from "@/lib/reflect-insights";
import { formatMoney, monthLabel } from "@/lib/money";
import {
  buttonPrimaryClass,
  cardClass,
} from "@/components/forms/field-classes";

const severityClass: Record<ReflectOpportunity["severity"], string> = {
  high: "border-danger/40 bg-danger-muted/40",
  medium: "border-rim bg-overlay/50",
  low: "border-rim-subtle bg-surface",
};

export function ReflectInsightsPanel({
  opportunities,
  nextMonth,
  focusMonth,
  currency,
}: {
  opportunities: ReflectOpportunity[];
  nextMonth: string;
  focusMonth: string;
  currency: string;
}) {
  if (opportunities.length === 0) return null;

  return (
    <section className={`${cardClass} space-y-3 p-3 sm:p-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
            <Lightbulb className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-fg">
              Plan {monthLabel(nextMonth)}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              Opportunities from {monthLabel(focusMonth)} — adjust envelopes
              before the next month starts.
            </p>
          </div>
        </div>
        <Link
          href={`/plan?month=${nextMonth}`}
          className={`${buttonPrimaryClass} inline-flex shrink-0 items-center gap-2`}
        >
          Open Plan
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <ul className="space-y-2">
        {opportunities.slice(0, 8).map((o) => (
          <li
            key={o.id}
            className={`rounded-xl border px-3 py-2.5 ${severityClass[o.severity]}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">{o.title}</p>
                <p className="mt-0.5 text-xs text-fg-muted">{o.detail}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {o.amountCents != null ? (
                  <span className="tabular-nums text-sm font-medium text-fg">
                    {formatMoney(o.amountCents, currency)}
                  </span>
                ) : null}
                <Link
                  href={o.href}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Adjust on Plan →
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
