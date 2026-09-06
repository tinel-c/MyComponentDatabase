"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { updateTransaction } from "@/app/(app)/transactions/actions";
import { DeleteTransactionButton } from "@/components/transactions/DeleteTransactionButton";
import type {
  SheetCategoryGroup,
  SheetChildRow,
} from "@/components/transactions/sheet-types";

export type { SheetCategoryGroup, SheetChildRow };

export function TransactionSheetEditor({
  txnId,
  accountName,
  date,
  payee,
  categoryId,
  notes,
  cleared,
  absAmount,
  isInflow,
  isSplit,
  isTransfer,
  transferLabel,
  currencyHint,
  groups,
  payees,
  childrenRows,
  returnTo = "/transactions",
}: {
  txnId: string;
  accountId: string;
  accountName: string;
  date: string;
  payee: string;
  categoryId: string;
  notes: string;
  cleared: boolean;
  absAmount: string;
  isInflow: boolean;
  isSplit: boolean;
  isTransfer: boolean;
  transferLabel: string | null;
  currencyHint: string;
  groups: SheetCategoryGroup[];
  payees: string[];
  childrenRows: SheetChildRow[];
  returnTo?: string;
}) {
  const [outflow, setOutflow] = useState(
    !isSplit && !isInflow ? absAmount : "",
  );
  const [inflow, setInflow] = useState(
    !isSplit && isInflow ? absAmount : "",
  );
  const [isCleared, setIsCleared] = useState(cleared);

  const amountValue = useMemo(() => {
    if (isSplit) return absAmount;
    const o = outflow.trim();
    const i = inflow.trim();
    if (i) return i;
    if (o) return o;
    return absAmount;
  }, [absAmount, inflow, isSplit, outflow]);

  const inflowFlag = useMemo(() => {
    if (isTransfer || isSplit) return "";
    return inflow.trim() ? "1" : "";
  }, [inflow, isSplit, isTransfer]);

  const payeeListId = `payees-${txnId}`;
  const canEditMoney = !isSplit;
  const canEditPayeeCategory = !isTransfer && !isSplit;
  const payeeReadonly = isTransfer
    ? (transferLabel ?? "Transfer")
    : payee || "Split";

  return (
    <div className="space-y-4 pb-28 md:pb-4">
      <form action={updateTransaction} className="space-y-3">
        <input type="hidden" name="id" value={txnId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="amount" value={amountValue} />
        {inflowFlag ? <input type="hidden" name="inflow" value="1" /> : null}
        {isCleared ? <input type="hidden" name="cleared" value="1" /> : null}
        {!canEditPayeeCategory ? (
          <>
            <input type="hidden" name="payee" value={payee} />
            <input type="hidden" name="categoryId" value={categoryId} />
          </>
        ) : null}

        <div className={`${cardClass} space-y-4 p-4 md:p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={isCleared}
                onChange={(e) => setIsCleared(e.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              Cleared
            </label>
            <p className="text-xs text-fg-subtle">
              {accountName}
              {isTransfer
                ? ` · Transfer with ${transferLabel ?? "other account"}`
                : ""}
              {isSplit ? " · Split" : ""} · {currencyHint}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={labelClass}>
              Date
              <input
                name="date"
                type="date"
                required
                defaultValue={date}
                className={inputClass}
              />
            </label>
            {canEditPayeeCategory ? (
              <label className={labelClass}>
                Payee
                <input
                  name="payee"
                  defaultValue={payee}
                  list={payeeListId}
                  autoComplete="off"
                  className={inputClass}
                />
                <datalist id={payeeListId}>
                  {payees.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
            ) : (
              <div>
                <p className="text-xs font-medium text-fg-muted">Payee</p>
                <p className="mt-1.5 text-sm text-fg">{payeeReadonly}</p>
              </div>
            )}
            {canEditPayeeCategory ? (
              <label className={`${labelClass} sm:col-span-2 lg:col-span-1`}>
                Category
                <select
                  name="categoryId"
                  defaultValue={categoryId}
                  className={inputClass}
                >
                  <option value="">RTA / none</option>
                  {groups.map((g) => (
                    <optgroup
                      key={g.id}
                      label={g.isIncome ? `${g.name} (In)` : g.name}
                    >
                      {g.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            ) : (
              <div>
                <p className="text-xs font-medium text-fg-muted">Category</p>
                <p className="mt-1.5 text-sm text-fg">
                  {isSplit ? "Split" : "—"}
                </p>
              </div>
            )}
            <label className={`${labelClass} sm:col-span-2 lg:col-span-1`}>
              Memo
              <input
                name="notes"
                defaultValue={notes}
                className={inputClass}
                placeholder="Memo"
              />
            </label>
          </div>

          {canEditMoney ? (
            <div className="grid grid-cols-2 gap-3 md:max-w-md">
              <label className={labelClass}>
                Outflow
                <input
                  inputMode="decimal"
                  value={outflow}
                  className={inputClass}
                  onChange={(e) => {
                    setOutflow(e.target.value);
                    if (e.target.value.trim()) setInflow("");
                  }}
                />
              </label>
              <label className={labelClass}>
                Inflow
                <input
                  inputMode="decimal"
                  value={inflow}
                  className={`${inputClass} text-ok`}
                  onChange={(e) => {
                    setInflow(e.target.value);
                    if (e.target.value.trim()) setOutflow("");
                  }}
                />
              </label>
            </div>
          ) : (
            <p className="text-lg font-semibold tabular-nums text-fg">
              {isInflow ? "+" : "−"}
              {absAmount}
            </p>
          )}

          {childrenRows.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                Split lines
              </h3>
              <ul className="mt-2 divide-y divide-rim-subtle rounded-xl border border-rim-subtle">
                {childrenRows.map((row) => (
                  <li
                    key={row.id}
                    className="flex justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="text-fg">{row.categoryName}</span>
                    <span className="tabular-nums text-fg-muted">
                      {row.isInflow ? "+" : "−"}
                      {row.amountDisplay}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-rim/60 bg-canvas/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="mx-auto flex w-full max-w-lg gap-2 pb-[env(safe-area-inset-bottom)] md:max-w-md md:pb-0">
            <button type="submit" className={`${buttonPrimaryClass} flex-1`}>
              Save
            </button>
            <Link href={returnTo} className={`${buttonSecondaryClass} flex-1`}>
              Cancel
            </Link>
          </div>
        </div>
      </form>

      <DeleteTransactionButton id={txnId} returnTo={returnTo} />
    </div>
  );
}
