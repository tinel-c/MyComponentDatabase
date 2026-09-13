"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import type { AccountRegisterItem } from "@/lib/account-register-chunk";
import type { AccountRegisterFilters } from "@/lib/account-register-chunk";
import { loadMoreAccountTransactions } from "@/app/(app)/accounts/[id]/load-more";
import { makePlannedFromTransaction } from "@/app/(app)/transactions/actions";
import { ClearToggle } from "@/components/accounts/ClearToggle";
import { DeleteTransactionButton } from "@/components/transactions/DeleteTransactionButton";
import { InfiniteList } from "@/components/ui/InfiniteList";
import {
  buttonCompactClass,
  cardCompactClass,
} from "@/components/forms/field-classes";
import { formatMoney } from "@/lib/money";

function AccountPlannedAction({
  item,
  onLinked,
}: {
  item: AccountRegisterItem;
  onLinked: (scheduledTransactionId: string, label: string) => void;
}) {
  const [pending, start] = useTransition();
  const linkedId = item.scheduledTransactionId;

  if (linkedId) {
    return (
      <Link
        href={`/planned?id=${encodeURIComponent(linkedId)}`}
        className="text-accent hover:underline"
      >
        {item.plannedLabel ?? "Planned"}
      </Link>
    );
  }

  const canMakePlanned =
    !item.transferTwinId && !item.isParent && item.amount !== 0;
  if (!canMakePlanned) {
    return <span className="text-fg-subtle">—</span>;
  }

  return (
    <button
      type="button"
      disabled={pending}
      className={`${buttonCompactClass} !px-1.5 !py-0.5 text-[10px]`}
      onClick={() => {
        const fd = new FormData();
        fd.set("transactionId", item.id);
        start(async () => {
          const res = await makePlannedFromTransaction(fd);
          if (res.ok && res.scheduledTransactionId) {
            onLinked(
              res.scheduledTransactionId,
              res.label ?? item.payeeName ?? "Planned",
            );
          }
        });
      }}
    >
      {pending ? "…" : "Make planned"}
    </button>
  );
}

export function AccountTransactionsInfiniteList({
  accountId,
  currency,
  initialItems,
  initialCursor,
  hasMore,
  filters = {},
}: {
  accountId: string;
  currency: string;
  initialItems: AccountRegisterItem[];
  initialCursor: string | null;
  hasMore: boolean;
  filters?: AccountRegisterFilters;
}) {
  const [optimisticPlanned, setOptimisticPlanned] = useState<
    Record<string, { id: string; label: string }>
  >({});

  const loadMore = useCallback(
    (cursor: string) =>
      loadMoreAccountTransactions(accountId, cursor, filters),
    [accountId, filters],
  );

  return (
    <InfiniteList
      initialItems={initialItems}
      initialCursor={initialCursor}
      hasMore={hasMore}
      loadMore={loadMore}
      endLabel="End of account register"
      renderList={(items) => (
        <ul className={`${cardCompactClass} divide-y divide-rim-subtle/60`}>
          {items.map((raw) => {
            const o = optimisticPlanned[raw.id];
            const t: AccountRegisterItem =
              o && !raw.scheduledTransactionId
                ? {
                    ...raw,
                    scheduledTransactionId: o.id,
                    plannedLabel: o.label,
                  }
                : raw;
            return (
              <li
                key={t.id}
                style={{
                  contentVisibility: "auto",
                  containIntrinsicSize: "56px",
                }}
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <ClearToggle id={t.id} cleared={t.cleared} />
                  <Link
                    href={`/transactions/${t.id}`}
                    prefetch
                    className="flex min-w-0 flex-1 items-center gap-3 py-1"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-fg">
                        {t.transferTwinId
                          ? "Transfer"
                          : t.payeeName ??
                            t.notes ??
                            (t.isStartingBalance
                              ? "Starting balance"
                              : "Transaction")}
                      </p>
                      <p className="text-xs text-fg-subtle">
                        {t.date}
                        {t.categoryName ? ` · ${t.categoryName}` : ""}
                        {t.payeeName === "Balance Adjustment"
                          ? " · adjustment"
                          : ""}
                        {t.isParent ? " · split" : ""}
                        {t.reconciled ? " · reconciled" : ""}
                      </p>
                    </div>
                    <p
                      className={`tabular-nums font-medium ${
                        t.amount < 0 ? "text-fg" : "text-ok"
                      }`}
                    >
                      {formatMoney(t.amount, currency)}
                    </p>
                  </Link>
                  <div className="shrink-0 text-right text-[11px]">
                    <AccountPlannedAction
                      item={t}
                      onLinked={(schedId, label) => {
                        setOptimisticPlanned((prev) => ({
                          ...prev,
                          [t.id]: { id: schedId, label },
                        }));
                      }}
                    />
                  </div>
                  <DeleteTransactionButton
                    id={t.id}
                    returnTo={`/accounts/${accountId}`}
                    compact
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    />
  );
}
