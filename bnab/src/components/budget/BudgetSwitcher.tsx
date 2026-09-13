"use client";

import { switchBudgetAction } from "@/app/(app)/more/switch-budget";
import { inputClass, labelClass } from "@/components/forms/field-classes";

export type BudgetOption = { id: string; name: string; currency: string };

export function BudgetSwitcher({
  budgets,
  currentBudgetId,
  compact = false,
}: {
  budgets: BudgetOption[];
  currentBudgetId: string;
  compact?: boolean;
}) {
  if (budgets.length <= 1) return null;

  return (
    <form action={switchBudgetAction} className={compact ? "mt-2" : "space-y-1"}>
      {!compact ? (
        <label className={labelClass} htmlFor="bnab-budget-switch">
          Active budget
        </label>
      ) : null}
      <select
        id="bnab-budget-switch"
        name="budgetId"
        defaultValue={currentBudgetId}
        className={inputClass}
        onChange={(e) => {
          e.currentTarget.form?.requestSubmit();
        }}
        aria-label="Switch budget"
      >
        {budgets.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.currency})
          </option>
        ))}
      </select>
    </form>
  );
}
