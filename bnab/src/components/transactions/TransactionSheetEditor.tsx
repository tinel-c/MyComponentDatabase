"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buttonDangerClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
} from "@/components/forms/field-classes";
import {
  deleteTransaction,
  updateTransaction,
} from "@/app/(app)/transactions/actions";
import type {
  SheetCategoryGroup,
  SheetChildRow,
} from "@/components/transactions/sheet-types";
import {
  sheetCell,
  sheetCellInput,
  sheetHeaderCell,
  sheetMoneyInput,
  sheetTableClass,
} from "@/components/transactions/sheet-styles";

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

  return (
    <div className="space-y-4 pb-28">
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

        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className={sheetTableClass}>
              <thead>
                <tr>
                  <th className={`${sheetHeaderCell} text-center`}>✓</th>
                  <th className={sheetHeaderCell}>Date</th>
                  <th className={sheetHeaderCell}>Acct</th>
                  <th className={sheetHeaderCell}>Payee</th>
                  <th className={sheetHeaderCell}>Cat</th>
                  <th className={sheetHeaderCell}>Memo</th>
                  <th className={`${sheetHeaderCell} text-right`}>Out</th>
                  <th className={`${sheetHeaderCell} text-right`}>In</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-surface">
                  <td className={`${sheetCell} text-center`}>
                    <input
                      type="checkbox"
                      checked={isCleared}
                      onChange={(e) => setIsCleared(e.target.checked)}
                      className="size-4 accent-[var(--accent)]"
                      aria-label="Cleared"
                    />
                  </td>
                  <td className={sheetCell}>
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={date}
                      className={sheetCellInput}
                    />
                  </td>
                  <td className={sheetCell}>
                    <span
                      className="block truncate px-1.5 py-2.5 text-xs text-fg-muted sm:text-sm"
                      title={accountName}
                    >
                      {accountName}
                    </span>
                  </td>
                  <td className={sheetCell}>
                    {canEditPayeeCategory ? (
                      <>
                        <input
                          name="payee"
                          defaultValue={payee}
                          list={payeeListId}
                          autoComplete="off"
                          placeholder="Payee"
                          className={sheetCellInput}
                        />
                        <datalist id={payeeListId}>
                          {payees.map((p) => (
                            <option key={p} value={p} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <span className="block truncate px-1.5 py-2.5 text-xs text-fg-muted sm:text-sm">
                        {isTransfer
                          ? (transferLabel ?? "Transfer")
                          : payee || "Split"}
                      </span>
                    )}
                  </td>
                  <td className={sheetCell}>
                    {canEditPayeeCategory ? (
                      <select
                        name="categoryId"
                        defaultValue={categoryId}
                        className={`${sheetCellInput} cursor-pointer`}
                      >
                        <option value="">RTA</option>
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
                    ) : (
                      <span className="block truncate px-1.5 py-2.5 text-xs text-fg-muted sm:text-sm">
                        {isSplit ? "Split" : "—"}
                      </span>
                    )}
                  </td>
                  <td className={sheetCell}>
                    <input
                      name="notes"
                      defaultValue={notes}
                      placeholder="Memo"
                      className={sheetCellInput}
                    />
                  </td>
                  <td className={sheetCell}>
                    {canEditMoney ? (
                      <input
                        inputMode="decimal"
                        value={outflow}
                        placeholder="—"
                        aria-label="Outflow"
                        className={sheetMoneyInput}
                        onChange={(e) => {
                          setOutflow(e.target.value);
                          if (e.target.value.trim()) setInflow("");
                        }}
                      />
                    ) : !isInflow ? (
                      <span className="block px-1.5 py-2.5 text-right text-xs font-mono tabular-nums text-fg-muted sm:text-sm">
                        {absAmount}
                      </span>
                    ) : null}
                  </td>
                  <td className={sheetCell}>
                    {canEditMoney ? (
                      <input
                        inputMode="decimal"
                        value={inflow}
                        placeholder="—"
                        aria-label="Inflow"
                        className={`${sheetMoneyInput} text-ok`}
                        onChange={(e) => {
                          setInflow(e.target.value);
                          if (e.target.value.trim()) setOutflow("");
                        }}
                      />
                    ) : isInflow ? (
                      <span className="block px-1.5 py-2.5 text-right text-xs font-mono tabular-nums text-ok sm:text-sm">
                        {absAmount}
                      </span>
                    ) : null}
                  </td>
                </tr>

                {childrenRows.map((row) => (
                  <tr key={row.id} className="bg-overlay/40">
                    <td className={sheetCell} />
                    <td className={sheetCell} />
                    <td className={sheetCell} />
                    <td className={sheetCell}>
                      <span className="block truncate px-1.5 py-2.5 text-xs text-fg-subtle">
                        ↳ split
                      </span>
                    </td>
                    <td className={sheetCell}>
                      <span className="block truncate px-1.5 py-2.5 text-xs text-fg">
                        {row.categoryName}
                      </span>
                    </td>
                    <td className={sheetCell} />
                    <td className={sheetCell}>
                      {!row.isInflow ? (
                        <span className="block px-1.5 py-2.5 text-right text-xs font-mono tabular-nums">
                          {row.amountDisplay}
                        </span>
                      ) : null}
                    </td>
                    <td className={sheetCell}>
                      {row.isInflow ? (
                        <span className="block px-1.5 py-2.5 text-right text-xs font-mono tabular-nums text-ok">
                          {row.amountDisplay}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-rim-subtle px-3 py-2 text-[11px] text-fg-subtle">
            {currencyHint}
            {isTransfer
              ? ` · Transfer with ${transferLabel ?? "other account"}`
              : ""}
            {isSplit ? " · Split lines are read-only" : ""}
          </p>
        </div>

        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-rim/60 bg-canvas/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="mx-auto flex max-w-5xl gap-2 pb-[env(safe-area-inset-bottom)] md:pb-0">
            <button type="submit" className={`${buttonPrimaryClass} flex-1`}>
              Save
            </button>
            <Link href={returnTo} className={`${buttonSecondaryClass} flex-1`}>
              Cancel
            </Link>
          </div>
        </div>
      </form>

      <form action={deleteTransaction}>
        <input type="hidden" name="id" value={txnId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          className={`${buttonDangerClass} w-full md:w-auto`}
        >
          Delete transaction
        </button>
      </form>
    </div>
  );
}
