"use client";

import Link from "next/link";
import { useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Link2,
  Link2Off,
} from "lucide-react";
import { loadMoreBills } from "@/app/(app)/more/bills/load-more";
import type { BillListItem } from "@/lib/bills-chunk";
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
  const pendingIng =
    Boolean(txn) &&
    !txn!.importFingerprint &&
    (txn!.notes?.includes("Bill import") ?? false);
  const linkedIng = Boolean(txn?.importFingerprint);

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
        {!txn ? (
          <div className="flex items-start gap-2 text-xs text-fg-muted">
            <Link2Off className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
            <div>
              <p className="font-medium text-fg">No transaction linked</p>
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
            {linkedIng ? (
              <Link2 className="mt-0.5 size-3.5 shrink-0 text-ok" />
            ) : pendingIng ? (
              <Clock className="mt-0.5 size-3.5 shrink-0 text-accent" />
            ) : (
              <Link2 className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">
                {linkedIng
                  ? "Linked to ING"
                  : pendingIng
                    ? "Awaiting ING link"
                    : "Linked to register"}
              </p>
              <p className="mt-0.5 text-fg-muted">
                {txn.date} · {txn.accountName}
                {txn.payeeName ? ` · ${txn.payeeName}` : ""} ·{" "}
                {formatMoney(txn.amount, currency)}
              </p>
              {linkedIng && txn.importBatch ? (
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
    </div>
  );
}

export function BillsInfiniteList({
  currency,
  initialItems,
  initialCursor,
  hasMore,
}: {
  currency: string;
  initialItems: BillListItem[];
  initialCursor: string | null;
  hasMore: boolean;
}) {
  const loadMore = useCallback((cursor: string) => loadMoreBills(cursor), []);

  return (
    <InfiniteList
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
