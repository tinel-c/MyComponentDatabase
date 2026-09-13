"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  makePlannedFromTransaction,
  updateTransaction,
} from "@/app/(app)/transactions/actions";
import { DeleteTransactionButton } from "@/components/transactions/DeleteTransactionButton";
import type { SheetCategoryGroup } from "@/components/transactions/sheet-types";
import {
  sheetCell,
  sheetCellInput,
  sheetHeaderCell,
  sheetMoneyInput,
  sheetTableClass,
} from "@/components/transactions/sheet-styles";
import {
  buttonCompactClass,
  cardClass,
} from "@/components/forms/field-classes";

export type MatchedRuleLink = {
  id: string;
  matchText: string;
  href: string;
};

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
  scheduledTransactionId: string | null;
  matchedImportRule?: MatchedRuleLink | null;
  matchedReceiptRules?: MatchedRuleLink[];
  billGroup?: {
    merchant: string | null;
    scanId: string | null;
    splits: {
      id: string;
      categoryName: string;
      amountDisplay: string;
      notes: string | null;
    }[];
  } | null;
};

function PlannedRowAction({ row }: { row: RegisterRow }) {
  if (row.scheduledTransactionId) {
    return (
      <Link
        href={`/planned?id=${encodeURIComponent(row.scheduledTransactionId)}`}
        className={`${buttonCompactClass} !h-7 !px-1.5 !py-0 text-[10px]`}
        title="Edit planned payment"
        onClick={(e) => e.stopPropagation()}
      >
        Edit planned
      </Link>
    );
  }
  const canMake =
    !row.isTransfer &&
    !row.isSplit &&
    row.absAmount !== "0" &&
    row.absAmount !== "0.00";
  if (!canMake) return null;
  return (
    <form action={makePlannedFromTransaction}>
      <input type="hidden" name="transactionId" value={row.id} />
      <button
        type="submit"
        className={`${buttonCompactClass} !h-7 !px-1.5 !py-0 text-[10px]`}
        title="Make planned payment"
      >
        Make planned
      </button>
    </form>
  );
}

function MappingLinks({
  importRule,
  receiptRules,
}: {
  importRule?: MatchedRuleLink | null;
  receiptRules?: MatchedRuleLink[];
}) {
  const receipts = receiptRules ?? [];
  if (!importRule && receipts.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] leading-tight">
      {importRule ? (
        <Link
          href={importRule.href}
          className="text-accent hover:underline"
          title={`Import mapping: ${importRule.matchText}`}
          onClick={(e) => e.stopPropagation()}
        >
          Import · {importRule.matchText}
        </Link>
      ) : null}
      {receipts.map((r) => (
        <Link
          key={r.id}
          href={r.href}
          className="text-accent hover:underline"
          title={`Receipt mapping: ${r.matchText}`}
          onClick={(e) => e.stopPropagation()}
        >
          Receipt · {r.matchText}
        </Link>
      ))}
    </div>
  );
}

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
      ? row.payee || row.billGroup?.merchant || "Bill"
      : row.payee;

  const categoryLabel = row.billGroup
    ? row.billGroup.merchant
      ? `Bill · ${row.billGroup.merchant}`
      : "Bill"
    : null;

  return (
    <>
    <tr
      className={`transition-colors ${
        pending
          ? "opacity-60"
          : "odd:bg-surface even:bg-canvas/40 hover:bg-accent-muted/25"
      }`}
      style={{ contentVisibility: "auto", containIntrinsicSize: "48px" }}
    >
      <td
        className={`${sheetCell} sticky left-0 z-[1] bg-inherit text-center shadow-[2px_0_6px_-2px_color-mix(in_oklch,var(--rim)_50%,transparent)]`}
      >
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
            {categoryLabel ?? (row.isSplit ? "Split" : "—")}
          </span>
        )}
      </td>
      <td className={`${sheetCell} hidden sm:table-cell`}>
        <input
          form={formId}
          name="notes"
          defaultValue={row.notes}
          disabled={pending}
          placeholder="Memo"
          className={sheetCellInput}
          onBlur={() => save()}
        />
        {row.billGroup ? (
          <Link
            href={`/transactions/${row.id}`}
            className="mt-1 block text-[10px] text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Bill · {row.billGroup.splits.length} categor
            {row.billGroup.splits.length === 1 ? "y" : "ies"}
          </Link>
        ) : null}
        <MappingLinks
          importRule={row.matchedImportRule}
          receiptRules={row.matchedReceiptRules}
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
            className={`${sheetMoneyInput}`}
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
          <span className="block truncate px-1.5 py-2.5 text-right text-xs font-mono tabular-nums text-fg-muted sm:text-sm">
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
            className={`${sheetMoneyInput} text-ok`}
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
          <span className="block truncate px-1.5 py-2.5 text-right text-xs font-mono tabular-nums text-ok sm:text-sm">
            {row.absAmount}
          </span>
        ) : null}
      </td>
      <td className={`${sheetCell} px-1 text-center`}>
        <div className="flex items-center justify-center gap-1">
          <PlannedRowAction row={row} />
          <DeleteTransactionButton id={row.id} returnTo="stay" compact />
        </div>
      </td>
    </tr>
    {row.billGroup?.splits.map((split) => (
      <tr
        key={`${row.id}-split-${split.id}`}
        className="bg-accent-muted/15 text-fg-muted"
      >
        <td
          className={`${sheetCell} sticky left-0 z-[1] bg-inherit shadow-[2px_0_6px_-2px_color-mix(in_oklch,var(--rim)_50%,transparent)]`}
        />
        <td className={sheetCell} colSpan={2} />
        <td className={sheetCell}>
          <span className="block border-l-2 border-accent-muted pl-2 text-[11px] text-fg-subtle">
            {split.notes ? (
              <span className="block truncate" title={split.notes}>
                {split.notes}
              </span>
            ) : null}
          </span>
        </td>
        <td className={sheetCell}>
          <span className="block truncate border-l-2 border-transparent pl-2 text-[11px] font-medium text-fg sm:text-xs">
            {split.categoryName}
          </span>
        </td>
        <td className={`${sheetCell} hidden sm:table-cell`}>
          <span className="block truncate px-1 text-[10px] text-fg-subtle">
            {split.notes ?? ""}
          </span>
        </td>
        <td className={sheetCell}>
          <span className="block truncate px-1.5 py-2 text-right text-xs font-mono tabular-nums text-fg-muted sm:text-sm">
            {split.amountDisplay}
          </span>
        </td>
        <td className={sheetCell} />
        <td className={sheetCell} />
      </tr>
    ))}
    </>
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
    <div className={`${cardClass} overflow-hidden`}>
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

      {/* Mobile cards */}
      <ul className="divide-y divide-rim-subtle md:hidden">
        {rows.map((row) => {
          const payeeDisplay = row.isTransfer
            ? row.transferLabel
              ? `Transfer: ${row.transferLabel}`
              : "Transfer"
            : row.isSplit
              ? row.payee || row.billGroup?.merchant || "Bill"
              : row.payee || "—";
          const catName = row.billGroup
            ? row.billGroup.merchant
              ? `Bill · ${row.billGroup.merchant}`
              : "Bill"
            : groups
                .flatMap((g) => g.categories)
                .find((c) => c.id === row.categoryId)?.name ??
              (row.isSplit ? "Split" : row.isTransfer ? "—" : "RTA");
          return (
            <li
              key={row.id}
              className="px-3 py-3"
              style={{ contentVisibility: "auto", containIntrinsicSize: "72px" }}
            >
              <a
                href={`/transactions/${row.id}`}
                className="block space-y-1 hover:opacity-90"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{payeeDisplay}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {row.date} · {row.accountName} · {catName}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 tabular-nums text-sm font-medium ${
                      row.isInflow ? "text-ok" : "text-fg"
                    }`}
                  >
                    {row.isInflow ? "+" : "−"}
                    {row.absAmount}
                  </p>
                </div>
              </a>
              {row.billGroup && row.billGroup.splits.length > 0 ? (
                <ul className="mt-2 space-y-1 border-l-2 border-accent-muted pl-3">
                  {row.billGroup.splits.map((s) => (
                    <li
                      key={s.id}
                      className="flex justify-between gap-2 text-xs text-fg-muted"
                    >
                      <span className="min-w-0 truncate">
                        {s.categoryName}
                        {s.notes ? (
                          <span className="text-fg-subtle"> · {s.notes}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {s.amountDisplay}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <MappingLinks
                importRule={row.matchedImportRule}
                receiptRules={row.matchedReceiptRules}
              />
              <div className="mt-2 flex items-center justify-end gap-1">
                <PlannedRowAction row={row} />
                <DeleteTransactionButton id={row.id} returnTo="stay" compact />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto overscroll-x-contain md:block">
        <table className={sheetTableClass}>
          <colgroup>
            <col className="w-10" />
            <col className="w-[7.5rem]" />
            <col className="w-[5.5rem]" />
            <col className="min-w-[7rem]" />
            <col className="min-w-[6.5rem]" />
            <col className="min-w-[7rem]" />
            <col className="w-[5.5rem]" />
            <col className="w-[5.5rem]" />
            <col className="w-[7.5rem]" />
          </colgroup>
          <thead>
            <tr>
              <th
                className={`${sheetHeaderCell} sticky left-0 z-20 text-center shadow-[2px_0_6px_-2px_color-mix(in_oklch,var(--rim)_50%,transparent)]`}
              >
                ✓
              </th>
              <th className={sheetHeaderCell}>Date</th>
              <th className={sheetHeaderCell}>Acct</th>
              <th className={sheetHeaderCell}>Payee</th>
              <th className={sheetHeaderCell}>Cat</th>
              <th className={`${sheetHeaderCell} hidden sm:table-cell`}>Memo</th>
              <th className={`${sheetHeaderCell} text-right`}>Out</th>
              <th className={`${sheetHeaderCell} text-right`}>In</th>
              <th className={`${sheetHeaderCell} text-center`}>Actions</th>
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
      </div>
      <p className="border-t border-rim-subtle px-3 py-2 text-[11px] text-fg-subtle">
        Tap a row on phone to edit or upload a bill · desktop sheet saves on leave ·
        mapping links open import / receipt rules · {currency}
      </p>
    </div>
  );
}
