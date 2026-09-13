"use server";

import { requireBudgetAccess } from "@/lib/authz";
import { fetchBillsChunk } from "@/lib/bills-chunk";

export async function loadMoreBills(cursor: string) {
  const { budget } = await requireBudgetAccess();
  return fetchBillsChunk(budget.id, cursor);
}
