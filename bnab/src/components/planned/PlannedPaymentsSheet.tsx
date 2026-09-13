"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { updatePlannedPayment } from "@/app/(app)/more/actions";
import {
  buttonCompactClass,
  cardCompactClass,
  chipClass,
  chipMutedClass,
  denseTdClass,
  denseThClass,
  inputCompactClass,
} from "@/components/forms/field-classes";

export type PlannedSheetAccount = { id: string; name: string };
export type PlannedSheetCategoryGroup = {
  id: string;
  name: string;
  categories: { id: string; name: string }[];
};
export type PlannedSheetImportRule = { id: string; matchText: string };

export type PlannedSheetRow = {
  id: string;
  accountId: string;
  payeeName: string;
  categoryId: string;
  amountAbs: string;
  isInflow: boolean;
  notes: string;
  nextDate: string;
  recurrence: string;
  billingUrl: string;
  importRuleId: string;
  active: boolean;
  occurrenceCount: number;
  status: "due" | "upcoming" | "inactive";
};

type StatusFilter = "all" | "due" | "upcoming" | "inactive";

export function PlannedPaymentsSheet({
  rows,
  accounts,
  groups,
  importRules,
  highlightId,
}: {
  rows: PlannedSheetRow[];
  accounts: PlannedSheetAccount[];
  groups: PlannedSheetCategoryGroup[];
  importRules: PlannedSheetImportRule[];
  highlightId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`planned-${highlightId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (!q) return true;
      const hay = [
        row.payeeName,
        row.notes,
        row.billingUrl,
        row.nextDate,
        row.recurrence,
        accounts.find((a) => a.id === row.accountId)?.name ?? "",
        groups
          .flatMap((g) => g.categories)
          .find((c) => c.id === row.categoryId)?.name ?? "",
        importRules.find((r) => r.id === row.importRuleId)?.matchText ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, status, accounts, groups, importRules]);

  return (
    <div className="space-y-3">
      <div className={`${cardCompactClass} p-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter payee, notes, account…"
            className={`${inputCompactClass} min-w-[12rem] flex-1`}
            autoComplete="off"
            aria-label="Filter planned payments"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className={`${inputCompactClass} w-full sm:w-40`}
            aria-label="Status"
          >
            <option value="all">All</option>
            <option value="due">Due</option>
            <option value="upcoming">Upcoming</option>
            <option value="inactive">Inactive</option>
          </select>
          <p className="w-full text-xs text-fg-subtle sm:ml-auto sm:w-auto">
            {filtered.length}/{rows.length}
          </p>
        </div>
      </div>

      <div className={`${cardCompactClass} overflow-x-auto`}>
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <thead>
            <tr>
              <th className={denseThClass}>Status</th>
              <th className={denseThClass}>Account</th>
              <th className={denseThClass}>Amount</th>
              <th className={denseThClass}>In</th>
              <th className={denseThClass}>Payee</th>
              <th className={denseThClass}>Category</th>
              <th className={denseThClass}>Due</th>
              <th className={denseThClass}>Recurrence</th>
              <th className={denseThClass}>Notes</th>
              <th className={denseThClass}>Billing URL</th>
              <th className={denseThClass}>Import rule</th>
              <th className={denseThClass}>Active</th>
              <th className={denseThClass}>Hits</th>
              <th className={denseThClass}> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={14}
                  className={`${denseTdClass} py-6 text-center text-fg-muted`}
                >
                  No planned payments match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const formId = `planned-row-${row.id}`;
                const highlighted = highlightId === row.id;
                return (
                  <tr
                    key={row.id}
                    id={`planned-${row.id}`}
                    className={
                      highlighted
                        ? "bg-accent-muted/50"
                        : row.status === "due"
                          ? "bg-danger-muted/20"
                          : undefined
                    }
                  >
                    <td className={denseTdClass}>
                      <span
                        className={
                          row.status === "due"
                            ? chipClass
                            : row.status === "inactive"
                              ? chipMutedClass
                              : chipMutedClass
                        }
                      >
                        {row.status === "due"
                          ? "Due"
                          : row.status === "upcoming"
                            ? "Upcoming"
                            : "Inactive"}
                      </span>
                    </td>
                    <td className={denseTdClass}>
                      <form id={formId} action={updatePlannedPayment} className="hidden">
                        <input type="hidden" name="id" value={row.id} />
                      </form>
                      <select
                        form={formId}
                        name="accountId"
                        defaultValue={row.accountId}
                        className={inputCompactClass}
                        required
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={denseTdClass}>
                      <input
                        form={formId}
                        name="amount"
                        defaultValue={row.amountAbs}
                        inputMode="decimal"
                        className={`${inputCompactClass} w-20 text-right font-mono`}
                        required
                      />
                    </td>
                    <td className={`${denseTdClass} text-center`}>
                      <input
                        form={formId}
                        type="checkbox"
                        name="inflow"
                        value="1"
                        defaultChecked={row.isInflow}
                        className="size-4"
                        aria-label="Inflow"
                      />
                    </td>
                    <td className={denseTdClass}>
                      <input
                        form={formId}
                        name="payee"
                        defaultValue={row.payeeName}
                        className={`${inputCompactClass} min-w-[7rem]`}
                        autoComplete="off"
                      />
                    </td>
                    <td className={denseTdClass}>
                      <select
                        form={formId}
                        name="categoryId"
                        defaultValue={row.categoryId}
                        className={inputCompactClass}
                      >
                        <option value="">None</option>
                        {groups.map((g) => (
                          <optgroup key={g.id} label={g.name}>
                            {g.categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className={denseTdClass}>
                      <input
                        form={formId}
                        type="date"
                        name="nextDate"
                        defaultValue={row.nextDate}
                        className={inputCompactClass}
                        required
                      />
                    </td>
                    <td className={denseTdClass}>
                      <select
                        form={formId}
                        name="recurrence"
                        defaultValue={row.recurrence}
                        className={inputCompactClass}
                      >
                        <option value="WEEKLY">Weekly</option>
                        <option value="BIWEEKLY">Biweekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="YEARLY">Yearly</option>
                        <option value="ONCE">Once</option>
                      </select>
                    </td>
                    <td className={denseTdClass}>
                      <input
                        form={formId}
                        name="notes"
                        defaultValue={row.notes}
                        className={`${inputCompactClass} min-w-[7rem]`}
                        autoComplete="off"
                      />
                    </td>
                    <td className={denseTdClass}>
                      <input
                        form={formId}
                        name="billingUrl"
                        type="url"
                        defaultValue={row.billingUrl}
                        placeholder="https://"
                        className={`${inputCompactClass} min-w-[8rem]`}
                        autoComplete="off"
                      />
                    </td>
                    <td className={denseTdClass}>
                      <select
                        form={formId}
                        name="importRuleId"
                        defaultValue={row.importRuleId}
                        className={inputCompactClass}
                      >
                        <option value="">None</option>
                        {importRules.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.matchText}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`${denseTdClass} text-center`}>
                      <input
                        form={formId}
                        type="checkbox"
                        name="active"
                        value="1"
                        defaultChecked={row.active}
                        className="size-4"
                        aria-label="Active"
                      />
                    </td>
                    <td className={denseTdClass}>
                      {row.occurrenceCount > 0 ? (
                        <Link
                          href={`/transactions?planned=${encodeURIComponent(row.id)}`}
                          className="whitespace-nowrap text-accent hover:underline"
                        >
                          {row.occurrenceCount} txn
                          {row.occurrenceCount === 1 ? "" : "s"}
                        </Link>
                      ) : (
                        <span className="whitespace-nowrap text-fg-subtle">
                          0 txns
                        </span>
                      )}
                    </td>
                    <td className={denseTdClass}>
                      <button
                        type="submit"
                        form={formId}
                        className={buttonCompactClass}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
