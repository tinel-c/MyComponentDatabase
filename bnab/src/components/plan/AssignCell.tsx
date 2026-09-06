"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { formatMoney } from "@/lib/money";
import { assignToCategory } from "@/app/(app)/plan/actions";
import { moneyClass } from "@/components/forms/field-classes";

export function AssignCell({
  categoryId,
  month,
  assigned,
  currency,
}: {
  categoryId: string;
  month: string;
  assigned: number;
  currency: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <form
      className="flex justify-end"
      action={(fd) => {
        start(async () => {
          await assignToCategory(fd);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="month" value={month} />
      <input
        name="amount"
        defaultValue={(assigned / 100).toFixed(2)}
        inputMode="decimal"
        disabled={pending}
        className={`${moneyClass} w-full min-w-0 rounded-md border border-rim/80 bg-canvas/60 px-1.5 py-1.5 text-right text-xs text-fg outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 disabled:opacity-50`}
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label={`Assign ${formatMoney(assigned, currency)}`}
      />
    </form>
  );
}
