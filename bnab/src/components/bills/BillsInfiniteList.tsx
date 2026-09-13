"use client";

import Link from "next/link";
import { useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Link2,
  Link2Off,
} from "lucide-react";
import { loadMoreBills } from "@/app/(app)/more/bills/load-more";
import type {
  BillLinkState,
  BillListItem,
  BillListStatusFilter,
} from "@/lib/bills-chunk";
import { InfiniteList } from "@/components/ui/InfiniteList";
import { cardCompactClass } from "@/components/forms/field-classes";
import { formatMoney } from "@/lib/money";

function statusMeta(status: string): {
  label: string;
  className: string;
  Icon: typeof CheckCircle2;
} {
  switch (status) {
    case "ok":
      return {
        label: "Applied",
        className: "bg-ok/15 text-ok",
        Icon: CheckCircle2,
      };
    case "preview":
      return {
        label: "Preview",
        className: "bg-accent-muted text-accent",
        Icon: Clock,
      };
    case "needs_mapping":
      return {
        label: "Needs mapping",
        className: "bg-overlay text-fg-muted",
        Icon: Clock,
      };
    case "error":
      return {
        label: "Failed",
        className: "bg-danger-muted text-danger-fg",
        Icon: AlertCircle,
      };
    default:
      return {
        label: status || "Pending",
        className: "bg-overlay text-fg-muted",
        Icon: Clock,
      };
  }
}

function linkStateLabel(state: BillLinkState): string {
  switch (state) {
    case "unlinked":
      return "Unlinked";
    case "linked_register":
      return "Linked to register";
    case "awaiting_ing":
      return "Awaiting ING";
    case "linked_ing":
      return "Linked to ING";
  }
}

function BillAiAudit({
  scan,
  currency,
}: {
  scan: BillListItem;
  currency: string;
}) {
  const totalCents =
    scan.totalCents ?? (scan.lineSumCents > 0 ? scan.lineSumCents : null);
  const txn = scan.transaction;

  return (
    <details className="group border-t border-rim-subtle">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-fg-muted hover:bg-overlay/40 hover:text-fg">
        <ChevronDown
          className="size-3.5 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
        AI audit
        {scan.lines.length > 0
          ? ` · ${scan.lines.length} bill line${scan.lines.length === 1 ? "" : "s"}`
          : ""}
      </summary>
      <div className="space-y-3 border-t border-rim-subtle bg-overlay/20 px-3 py-3 text-xs">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
          <dt className="text-fg-subtle">Store</dt>
          <dd className="text-fg">{scan.merchant || "—"}</dd>
          <dt className="text-fg-subtle">Purchase date</dt>
          <dd className="text-fg">{scan.receiptDate || "—"}</dd>
          <dt className="text-fg-subtle">Receipt total</dt>
          <dd className="tabular-nums text-fg">
            {totalCents != null
              ? formatMoney(-Math.abs(totalCents), currency)
              : "—"}
          </dd>
          <dt className="text-fg-subtle">AI model</dt>
          <dd className="text-fg">{scan.model || "—"}</dd>
          <dt className="text-fg-subtle">Bill link state</dt>
          <dd className="text-fg">{linkStateLabel(scan.linkState)}</dd>
          <dt className="text-fg-subtle">Linked transaction</dt>
          <dd className="min-w-0 text-fg">
            {txn ? (
              <Link
                href={`/transactions/${txn.id}`}
                className="text-accent underline hover:text-fg"
              >
                {txn.id.slice(0, 10)}…
                <span className="ml-1 text-fg-muted no-underline">
                  ({linkStateLabel(scan.linkState)})
                </span>
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </dl>

        {scan.lines.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-rim-subtle">
            <table className="w-full min-w-[28rem] text-left">
              <thead>
                <tr className="border-b border-rim-subtle bg-overlay/50 text-[10px] uppercase tracking-wide text-fg-subtle">
                  <th className="px-2 py-1.5 font-semibold">Bill line</th>
                  <th className="px-2 py-1.5 text-right font-semibold">
                    Line amount
                  </th>
                  <th className="px-2 py-1.5 font-semibold">AI category hint</th>
                  <th className="px-2 py-1.5 font-semibold">Category matched</th>
                  <th className="px-2 py-1.5 font-semibold">Receipt rule hit</th>
                </tr>
              </thead>
              <tbody>
                {scan.lines.map((line) => (
                  <tr
                    key={line.id}
                    className="border-b border-rim-subtle last:border-0"
                  >
                    <td className="max-w-[10rem] truncate px-2 py-1.5 text-fg">
                      {line.ignored ? (
                        <span className="text-fg-subtle">(ignore) </span>
                      ) : null}
                      {line.description}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-fg-muted">
                      {formatMoney(line.amountCents, currency)}
                    </td>
                    <td className="px-2 py-1.5 text-fg-muted">
                      {line.categoryHint || "—"}
                    </td>
                    <td className="px-2 py-1.5 text-fg">
                      {line.ignored
                        ? "Ignored"
                        : line.categoryMatched || "—"}
                    </td>
                    <td className="px-2 py-1.5 text-fg-muted">
                      {line.receiptRule
                        ? line.receiptRule.ignore
                          ? `Ignore · “${line.receiptRule.matchText}”`
                          : `“${line.receiptRule.matchText}”${
                              line.receiptRule.categoryName
                                ? ` → ${line.receiptRule.categoryName}`
                                : ""
                            }`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-fg-muted">No bill lines on this scan.</p>
        )}
      </div>
    </details>
  );
}

function BillCard({
  scan,
  currency,
}: {
  scan: BillListItem;
  currency: string;
}) {
  const totalCents =
    scan.totalCents ?? (scan.lineSumCents > 0 ? scan.lineSumCents : null);
  const st = statusMeta(scan.status);
  const StatusIcon = st.Icon;
  const txn = scan.transaction;

  return (
    <div className={`${cardCompactClass} overflow-hidden`}>
      <div className="flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${st.className}`}
            >
              <StatusIcon className="size-3" aria-hidden />
              {st.label}
            </span>
            <span className="text-[10px] text-fg-subtle">
              {scan.createdAtLabel}
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-fg">
            {scan.merchant || txn?.payeeName || "Receipt"}
            {scan.receiptDate || txn?.date
              ? ` · ${scan.receiptDate ?? txn?.date}`
              : ""}
          </p>
          <p className="text-xs text-fg-muted">
            {totalCents != null
              ? formatMoney(-Math.abs(totalCents), currency)
              : "—"}
            {scan.lineCount > 0
              ? ` · ${scan.lineCount} line${scan.lineCount === 1 ? "" : "s"}`
              : ""}
            {scan.model ? ` · ${scan.model}` : ""}
          </p>
          {scan.errorText ? (
            <p className="text-xs text-danger-fg">{scan.errorText}</p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-rim-subtle bg-overlay/30 px-3 py-2">
        {scan.linkState === "unlinked" || !txn ? (
          <div className="flex items-start gap-2 text-xs text-fg-muted">
            <Link2Off className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
            <div>
              <p className="font-medium text-fg">Unlinked</p>
              <p>
                Finish on{" "}
                <Link
                  href="/more/import-bill"
                  className="text-accent hover:underline"
                >
                  Import bill
                </Link>
                .
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-xs">
            {scan.linkState === "linked_ing" ? (
              <Link2 className="mt-0.5 size-3.5 shrink-0 text-ok" />
            ) : scan.linkState === "awaiting_ing" ? (
              <Clock className="mt-0.5 size-3.5 shrink-0 text-accent" />
            ) : (
              <Link2 className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">
                {linkStateLabel(scan.linkState)}
              </p>
              <p className="mt-0.5 text-fg-muted">
                {txn.date} · {txn.accountName}
                {txn.payeeName ? ` · ${txn.payeeName}` : ""} ·{" "}
                {formatMoney(txn.amount, currency)}
              </p>
              {scan.linkState === "linked_ing" && txn.importBatch ? (
                <p className="mt-0.5 text-[10px] text-fg-subtle">
                  <Link
                    href={`/more/import-history?batch=${txn.importBatch.id}`}
                    className="text-accent hover:underline"
                  >
                    Import history
                  </Link>
                </p>
              ) : null}
              <Link
                href={`/transactions/${txn.id}`}
                className="mt-1 inline-block text-accent underline hover:text-fg"
              >
                Open transaction
              </Link>
            </div>
          </div>
        )}
      </div>

      <BillAiAudit scan={scan} currency={currency} />
    </div>
  );
}

export function BillsInfiniteList({
  currency,
  initialItems,
  initialCursor,
  hasMore,
  statusFilter = "all",
}: {
  currency: string;
  initialItems: BillListItem[];
  initialCursor: string | null;
  hasMore: boolean;
  statusFilter?: BillListStatusFilter;
}) {
  const loadMore = useCallback(
    (cursor: string) => loadMoreBills(cursor, statusFilter),
    [statusFilter],
  );

  return (
    <InfiniteList
      key={statusFilter}
      initialItems={initialItems}
      initialCursor={initialCursor}
      hasMore={hasMore}
      loadMore={loadMore}
      endLabel="End of bills"
      renderList={(items) => (
        <ul className="space-y-2">
          {items.map((scan) => (
            <li key={scan.id}>
              <BillCard scan={scan} currency={currency} />
            </li>
          ))}
        </ul>
      )}
    />
  );
}
