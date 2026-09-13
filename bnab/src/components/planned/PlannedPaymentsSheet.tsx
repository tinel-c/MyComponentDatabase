"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  enterPlannedPaymentFromCash,
  updatePlannedPayment,
} from "@/app/(app)/more/actions";
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
  active: boolean;
  occurrenceCount: number;
  status: "due" | "upcoming" | "inactive";
};

type StatusFilter = "all" | "due" | "upcoming" | "inactive";

export function PlannedPaymentsSheet({
  rows,
  accounts,
  groups,
  highlightId,
  cashAccountName,
}: {
  rows: PlannedSheetRow[];
  accounts: PlannedSheetAccount[];
  groups: PlannedSheetCategoryGroup[];
  highlightId?: string | null;
  /** Open CASH account name for Pay button; null if none. */
  cashAccountName: string | null;
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
          .flatMap((g) => g.categories.map((c) => ({ ...c, groupName: g.name })))
          .find((c) => c.id === row.categoryId)?.name ?? "",
        groups.find((g) =>
          g.categories.some((c) => c.id === row.categoryId),
        )?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, status, accounts, groups]);

  const grouped = useMemo(() => {
    const catToGroup = new Map<string, { id: string; name: string }>();
    for (const g of groups) {
      for (const c of g.categories) {
        catToGroup.set(c.id, { id: g.id, name: g.name });
      }
    }
    const byGroup = new Map<string, { name: string; rows: PlannedSheetRow[] }>();
    for (const g of groups) {
      byGroup.set(g.id, { name: g.name, rows: [] });
    }
    const uncategorized: PlannedSheetRow[] = [];
    for (const row of filtered) {
      const g = row.categoryId ? catToGroup.get(row.categoryId) : undefined;
      if (!g) {
        uncategorized.push(row);
        continue;
      }
      const bucket = byGroup.get(g.id);
      if (bucket) bucket.rows.push(row);
      else uncategorized.push(row);
    }
    const sections = [...byGroup.entries()]
      .filter(([, v]) => v.rows.length > 0)
      .map(([id, v]) => ({ id, name: v.name, rows: v.rows }));
    if (uncategorized.length > 0) {
      sections.push({
        id: "__none__",
        name: "Uncategorized",
        rows: uncategorized,
      });
    }
    return sections;
  }, [filtered, groups]);

  const colSpan = 13;

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
            {cashAccountName
              ? ` · Pay uses ${cashAccountName}`
              : " · No cash account for Pay"}
          </p>
        </div>
      </div>

      <div className={`${cardCompactClass} overflow-x-auto`}>
        <table className="w-full min-w-[60rem] border-collapse text-sm">
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
              <th className={denseThClass}>Active</th>
              <th className={denseThClass}>Hits</th>
              <th className={denseThClass}> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className={`${denseTdClass} py-6 text-center text-fg-muted`}
                >
                  No planned payments match this filter.
                </td>
              </tr>
            ) : (
              grouped.map((section) => (
                <Fragment key={section.id}>
                  <tr className="bg-overlay/60">
                    <td
                      colSpan={colSpan}
                      className={`${denseTdClass} py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle`}
                    >
                      {section.name}
                      <span className="ml-2 font-normal tabular-nums">
                        ({section.rows.length})
                      </span>
                    </td>
                  </tr>
                  {section.rows.map((row) => {
                    const formId = `planned-row-${row.id}`;
                    const highlighted = highlightId === row.id;
                    const canPayCash =
                      row.status === "due" && Boolean(cashAccountName);
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
                              row.status === "due" ? chipClass : chipMutedClass
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
                          <form
                            id={formId}
                            action={updatePlannedPayment}
                            className="hidden"
                          >
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
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {canPayCash ? (
                              <form action={enterPlannedPaymentFromCash}>
                                <input type="hidden" name="id" value={row.id} />
                                <button
                                  type="submit"
                                  className={buttonCompactClass}
                                  title={`Create transaction on ${cashAccountName}`}
                                >
                                  Pay cash
                                </button>
                              </form>
                            ) : null}
                            <button
                              type="submit"
                              form={formId}
                              className={buttonCompactClass}
                            >
                              Save
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
