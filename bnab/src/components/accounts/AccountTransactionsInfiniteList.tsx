"use client";

import Link from "next/link";
import { useCallback } from "react";
import type { AccountRegisterItem } from "@/lib/account-register-chunk";
import { loadMoreAccountTransactions } from "@/app/(app)/accounts/[id]/load-more";
import { ClearToggle } from "@/components/accounts/ClearToggle";
import { DeleteTransactionButton } from "@/components/transactions/DeleteTransactionButton";
import { InfiniteList } from "@/components/ui/InfiniteList";
import { cardCompactClass } from "@/components/forms/field-classes";
import { formatMoney } from "@/lib/money";

export function AccountTransactionsInfiniteList({
  accountId,
  currency,
  initialItems,
  initialCursor,
  hasMore,
}: {
  accountId: string;
  currency: string;
  initialItems: AccountRegisterItem[];
  initialCursor: string | null;
  hasMore: boolean;
}) {
  const loadMore = useCallback(
    (cursor: string) => loadMoreAccountTransactions(accountId, cursor),
    [accountId],
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
          {items.map((t) => (
            <li key={t.id}>
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
                <DeleteTransactionButton
                  id={t.id}
                  returnTo={`/accounts/${accountId}`}
                  compact
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    />
  );
}
