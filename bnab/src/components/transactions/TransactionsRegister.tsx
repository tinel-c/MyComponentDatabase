"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateTransaction } from "@/app/(app)/transactions/actions";
import type { SheetCategoryGroup } from "@/components/transactions/sheet-types";
import {
  sheetCell,
  sheetCellInput,
  sheetHeaderCell,
  sheetTableClass,
} from "@/components/transactions/sheet-styles";

export type RegisterRow = {
  id: string;
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
};

function RegisterRowCells({
  row,
  groups,
  payees,
}: {
  row: RegisterRow;
  groups: SheetCategoryGroup[];
  payees: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [outflow, setOutflow] = useState(
    !row.isSplit && !row.isInflow ? row.absAmount : "",
  );
  const [inflow, setInflow] = useState(
    !row.isSplit && row.isInflow ? row.absAmount : "",
  );
  const [isCleared, setIsCleared] = useState(row.cleared);

  const formId = `txn-row-${row.id}`;
  const payeeListId = `reg-payees-${row.id}`;
  const canEditMoney = !row.isSplit;
  const canEditPayeeCategory = !row.isTransfer && !row.isSplit;

  const save = (opts?: {
    cleared?: boolean;
    outflow?: string;
    inflow?: string;
  }) => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const nextOut = opts?.outflow ?? outflow;
    const nextIn = opts?.inflow ?? inflow;
    const cleared = opts?.cleared ?? isCleared;

    let amount = row.absAmount;
    if (!row.isSplit) {
      const i = nextIn.trim();
      const o = nextOut.trim();
      amount = i || o || row.absAmount;
    }

    const fd = new FormData(form);
    fd.set("amount", amount);
    fd.set("returnTo", "stay");
    if (cleared) fd.set("cleared", "1");
    else fd.delete("cleared");
    if (!row.isTransfer && !row.isSplit && nextIn.trim()) {
      fd.set("inflow", "1");
    } else {
      fd.delete("inflow");
    }

    start(async () => {
      await updateTransaction(fd);
      router.refresh();
    });
  };

  const payeeDisplay = row.isTransfer
    ? row.transferLabel
      ? `Transfer: ${row.transferLabel}`
      : "Transfer"
    : row.isSplit
      ? row.payee || "Split"
      : row.payee;

  return (
    <tr className={pending ? "bg-surface opacity-60" : "bg-surface"}>
      <td className={`${sheetCell} text-center`}>
        <input
          type="checkbox"
          checked={isCleared}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setIsCleared(next);
            save({ cleared: next });
          }}
          className="size-3.5 accent-[var(--accent)]"
          aria-label="Cleared"
        />
      </td>
      <td className={sheetCell}>
        <input
          form={formId}
          name="date"
          type="date"
          required
          defaultValue={row.date}
          disabled={pending}
          className={sheetCellInput}
          onBlur={() => save()}
        />
      </td>
      <td className={sheetCell}>
        <span
          className="block truncate px-1 py-1.5 text-[11px] text-fg-muted sm:text-xs"
          title={row.accountName}
        >
          {row.accountName}
        </span>
      </td>
      <td className={sheetCell}>
        {canEditPayeeCategory ? (
          <>
            <input
              form={formId}
              name="payee"
              defaultValue={row.payee}
              list={payeeListId}
              autoComplete="off"
              disabled={pending}
              placeholder="Payee"
              className={sheetCellInput}
              onBlur={() => save()}
            />
            <datalist id={payeeListId}>
              {payees.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </>
        ) : (
          <span
            className="block truncate px-1 py-1.5 text-[11px] text-fg-muted sm:text-xs"
            title={payeeDisplay}
          >
            {payeeDisplay}
          </span>
        )}
      </td>
      <td className={sheetCell}>
        {canEditPayeeCategory ? (
          <select
            form={formId}
            name="categoryId"
            defaultValue={row.categoryId}
            disabled={pending}
            className={`${sheetCellInput} cursor-pointer`}
            onChange={() => save()}
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
          <span className="block truncate px-1 py-1.5 text-[11px] text-fg-muted sm:text-xs">
            {row.isSplit ? "Split" : "—"}
          </span>
        )}
      </td>
      <td className={sheetCell}>
        <input
          form={formId}
          name="notes"
          defaultValue={row.notes}
          disabled={pending}
          placeholder="Memo"
          className={sheetCellInput}
          onBlur={() => save()}
        />
      </td>
      <td className={sheetCell}>
        {canEditMoney ? (
          <input
            form={formId}
            inputMode="decimal"
            value={outflow}
            disabled={pending}
            placeholder="—"
            aria-label="Outflow"
            className={`${sheetCellInput} text-right tabular-nums`}
            onChange={(e) => {
              setOutflow(e.target.value);
              if (e.target.value.trim()) setInflow("");
            }}
            onBlur={(e) => {
              const v = e.currentTarget.value;
              save({
                outflow: v,
                inflow: v.trim() ? "" : inflow,
              });
            }}
          />
        ) : !row.isInflow ? (
          <span className="block truncate px-1 py-1.5 text-right text-[11px] tabular-nums text-fg-muted sm:text-xs">
            {row.absAmount}
          </span>
        ) : null}
      </td>
      <td className={sheetCell}>
        {canEditMoney ? (
          <input
            form={formId}
            inputMode="decimal"
            value={inflow}
            disabled={pending}
            placeholder="—"
            aria-label="Inflow"
            className={`${sheetCellInput} text-right tabular-nums text-ok`}
            onChange={(e) => {
              setInflow(e.target.value);
              if (e.target.value.trim()) setOutflow("");
            }}
            onBlur={(e) => {
              const v = e.currentTarget.value;
              save({
                inflow: v,
                outflow: v.trim() ? "" : outflow,
              });
            }}
          />
        ) : row.isInflow ? (
          <span className="block truncate px-1 py-1.5 text-right text-[11px] tabular-nums text-ok sm:text-xs">
            {row.absAmount}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

export function TransactionsRegister({
  rows,
  groups,
  payees,
  currency,
}: {
  rows: RegisterRow[];
  groups: SheetCategoryGroup[];
  payees: string[];
  currency: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-rim shadow-sm">
      <div className="hidden" aria-hidden>
        {rows.map((row) => (
          <form id={`txn-row-${row.id}`} key={row.id}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="returnTo" value="stay" />
            {row.isTransfer || row.isSplit ? (
              <>
                <input type="hidden" name="payee" value={row.payee} />
                <input type="hidden" name="categoryId" value={row.categoryId} />
              </>
            ) : null}
          </form>
        ))}
      </div>
      <table className={sheetTableClass}>
        <colgroup>
          <col className="w-[6%]" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
          <col className="w-[18%]" />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
        </colgroup>
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
          {rows.map((row) => (
            <RegisterRowCells
              key={row.id}
              row={row}
              groups={groups}
              payees={payees}
            />
          ))}
        </tbody>
      </table>
      <p className="border-t border-rim-subtle px-2 py-1.5 text-[10px] text-fg-subtle">
        Edits save when you leave a cell · {currency}
      </p>
    </div>
  );
}
