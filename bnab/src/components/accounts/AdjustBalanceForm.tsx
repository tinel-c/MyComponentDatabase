"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustAccountBalance } from "@/app/(app)/plan/actions";
import { formatMoney, parseMoneyInput, todayISO } from "@/lib/money";
import {
  buttonPrimaryClass,
  inputClass,
  labelClass,
  moneyClass,
} from "@/components/forms/field-classes";

type Props = {
  accountId: string;
  currentBalance: number;
  currency: string;
};

export function AdjustBalanceForm({
  accountId,
  currentBalance,
  currency,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseMoneyInput(raw), [raw]);
  const diff =
    parsed === null || raw.trim() === "" ? null : parsed - currentBalance;

  return (
    <form
      className="space-y-3"
      action={(fd) => {
        setError(null);
        if (parsed === null) {
          setError("Enter a valid statement balance");
          return;
        }
        if (diff === 0) {
          setError("Already matches — no adjustment needed");
          return;
        }
        start(async () => {
          await adjustAccountBalance(fd);
          setRaw("");
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="accountId" value={accountId} />
      <p className="text-xs text-fg-muted">
        Current in BNAB:{" "}
        <span className={`font-semibold text-fg ${moneyClass}`}>
          {formatMoney(currentBalance, currency)}
        </span>
      </p>
      <label className={labelClass}>
        ING / statement balance
        <input
          name="statementBalance"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          inputMode="decimal"
          required
          placeholder="e.g. 1520,45"
          className={`${inputClass} ${moneyClass}`}
        />
      </label>
      <label className={labelClass}>
        Adjustment date
        <input
          type="date"
          name="date"
          defaultValue={todayISO()}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Note (optional)
        <input
          name="notes"
          maxLength={120}
          placeholder="e.g. after Aug statement"
          className={inputClass}
        />
      </label>

      {diff !== null && diff !== 0 && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            diff > 0
              ? "border-ok/30 bg-ok/10 text-ok"
              : "border-danger/30 bg-danger-muted text-danger-fg"
          }`}
        >
          Will insert{" "}
          <span className={`font-semibold ${moneyClass}`}>
            {formatMoney(diff, currency)}
          </span>{" "}
          ({diff > 0
            ? "inflow → Other income → Ready to Assign"
            : "outflow → reduces Ready to Assign"})
        </p>
      )}

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <button
        type="submit"
        disabled={pending || !raw.trim()}
        className={`${buttonPrimaryClass} w-full`}
      >
        {pending ? "Adjusting…" : "Adjust to statement balance"}
      </button>
    </form>
  );
}
