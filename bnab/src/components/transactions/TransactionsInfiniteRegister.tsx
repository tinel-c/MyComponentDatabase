"use client";

import { useCallback } from "react";
import { loadMoreTransactions } from "@/app/(app)/transactions/load-more";
import type { TransactionsListFilters } from "@/lib/transactions-register-chunk";
import { InfiniteList } from "@/components/ui/InfiniteList";
import {
  TransactionsRegister,
  type RegisterRow,
} from "@/components/transactions/TransactionsRegister";
import type { SheetCategoryGroup } from "@/components/transactions/sheet-types";

export function TransactionsInfiniteRegister({
  initialRows,
  initialCursor,
  hasMore,
  filters,
  groups,
  payees,
  currency,
}: {
  initialRows: RegisterRow[];
  initialCursor: string | null;
  hasMore: boolean;
  filters: TransactionsListFilters;
  groups: SheetCategoryGroup[];
  payees: string[];
  currency: string;
}) {
  const loadMore = useCallback(
    (cursor: string) => loadMoreTransactions(filters, cursor),
    [filters],
  );

  return (
    <InfiniteList
      initialItems={initialRows}
      initialCursor={initialCursor}
      hasMore={hasMore}
      loadMore={loadMore}
      endLabel="End of register"
      renderList={(rows) => (
        <TransactionsRegister
          rows={rows}
          groups={groups}
          payees={payees}
          currency={currency}
        />
      )}
    />
  );
}
