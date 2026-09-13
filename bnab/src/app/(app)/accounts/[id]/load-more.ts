"use server";

import { requireBudgetAccess } from "@/lib/authz";
import { fetchAccountRegisterChunk } from "@/lib/account-register-chunk";
import { prisma } from "@/lib/prisma";

export async function loadMoreAccountTransactions(
  accountId: string,
  cursor: string,
) {
  const { budget } = await requireBudgetAccess();
  const account = await prisma.financeAccount.findFirst({
    where: { id: accountId, budgetId: budget.id },
    select: { id: true },
  });
  if (!account) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  return fetchAccountRegisterChunk(accountId, cursor);
}
