"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { formatMoney } from "@/lib/money";
import { assignToCategory } from "@/app/(app)/plan/actions";
import { inputClass, moneyClass } from "@/components/forms/field-classes";

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
        className={`${inputClass} ${moneyClass} mt-0 min-h-10 w-[6rem] py-2 text-right`}
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label={`Assign ${formatMoney(assigned, currency)}`}
      />
    </form>
  );
}
