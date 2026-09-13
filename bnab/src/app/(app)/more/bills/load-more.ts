"use server";

import { requireBudgetAccess } from "@/lib/authz";
import {
  fetchBillsChunk,
  parseBillStatusFilter,
  type BillListStatusFilter,
} from "@/lib/bills-chunk";

export async function loadMoreBills(
  cursor: string,
  statusFilter: BillListStatusFilter | string = "all",
) {
  const { budget } = await requireBudgetAccess();
  return fetchBillsChunk(
    budget.id,
    cursor,
    undefined,
    parseBillStatusFilter(statusFilter),
  );
}
