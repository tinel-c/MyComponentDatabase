"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { moveMoney } from "@/app/(app)/plan/actions";
import {
  buttonSecondaryClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";

type Cat = { id: string; name: string };

export function MoveMoneyForm({
  month,
  categories,
}: {
  month: string;
  categories: Cat[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3"
      action={(fd) => {
        start(async () => {
          await moveMoney(fd);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="month" value={month} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          From
          <select name="fromId" required className={inputClass} disabled={pending}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          To
          <select name="toId" required className={inputClass} disabled={pending}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Amount
          <input
            name="amount"
            required
            inputMode="decimal"
            className={inputClass}
            placeholder="0.00"
            disabled={pending}
          />
        </label>
      </div>
      <button type="submit" className={buttonSecondaryClass} disabled={pending}>
        Move money
      </button>
    </form>
  );
}
