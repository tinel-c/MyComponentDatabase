"use server";

import { requireBudgetAccess } from "@/lib/authz";
import {
  buildTransactionsWhere,
  fetchTransactionsRegisterChunk,
  type TransactionsListFilters,
} from "@/lib/transactions-register-chunk";
import type { RegisterRow } from "@/components/transactions/TransactionsRegister";

export async function loadMoreTransactions(
  filters: TransactionsListFilters,
  cursor: string,
): Promise<{
  items: RegisterRow[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const { budget } = await requireBudgetAccess();
  const where = buildTransactionsWhere(budget.id, filters);
  return fetchTransactionsRegisterChunk({
    budgetId: budget.id,
    where,
    cursor,
  });
}
