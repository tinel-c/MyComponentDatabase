"use client";

import { useEffect, useRef, useTransition } from "react";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { assignToCategory } from "@/app/(app)/plan/actions";
import { moneyClass } from "@/components/forms/field-classes";
import { usePlanWorkspaceOptional } from "@/components/plan/PlanWorkspace";
import { usePendingActionsOptional } from "@/components/providers/PendingActionsProvider";

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
  const workspace = usePlanWorkspaceOptional();
  const pendingActions = usePendingActionsOptional();
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const liveAssigned = workspace?.rows[categoryId]?.assigned ?? assigned;

  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = (liveAssigned / 100).toFixed(2);
    }
  }, [liveAssigned]);

  return (
    <form
      className="flex justify-end"
      action={(fd) => {
        start(async () => {
          const runFn = async () => {
            const patch = await assignToCategory(fd);
            if (patch?.ok) workspace?.applyPatch(patch);
          };
          if (pendingActions) {
            await pendingActions.runPending("Updating assignment…", runFn);
          } else {
            await runFn();
          }
        });
      }}
    >
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="month" value={month} />
      <input
        ref={inputRef}
        name="amount"
        defaultValue={(liveAssigned / 100).toFixed(2)}
        inputMode="decimal"
        disabled={pending}
        className={`${moneyClass} w-full min-w-0 rounded-md border border-rim/80 bg-canvas/60 px-1.5 py-1.5 text-right text-xs text-fg outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 disabled:opacity-50`}
        onBlur={(e) => {
          const parsed = parseMoneyInput(e.currentTarget.value);
          if (parsed === null) return;
          if (parsed === liveAssigned) return;
          e.currentTarget.form?.requestSubmit();
        }}
        aria-label={`Assign ${formatMoney(liveAssigned, currency)}`}
      />
    </form>
  );
}
