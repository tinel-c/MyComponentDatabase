import type { PrismaClient } from "@prisma/client";
import { isBillImportPendingNotes } from "@/lib/ing-import/overlap";
import { currentMonth } from "@/lib/money";

export type AccountActivitySummary = {
  accountId: string;
  accountName: string;
  month: string;
  billsImported: number;
  manualEntries: number;
  ingBatches: number;
  ingTxnCount: number;
};

/**
 * Per finance-account activity for the current calendar month (desktop right rail).
 */
export async function loadAccountActivitySummaries(
  prisma: PrismaClient,
  budgetId: string,
  month = currentMonth(),
): Promise<AccountActivitySummary[]> {
  const accounts = await prisma.financeAccount.findMany({
    where: { budgetId, closed: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
  if (accounts.length === 0) return [];

  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const nextMonth =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const batchFrom = new Date(`${monthStart}T00:00:00.000Z`);
  const batchTo = new Date(`${nextMonth}T00:00:00.000Z`);

  const accountIds = accounts.map((a) => a.id);

  const [txns, batches] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        date: { gte: monthStart, lt: nextMonth },
        isChild: false,
      },
      select: {
        accountId: true,
        notes: true,
        importBatchId: true,
        importFingerprint: true,
        receiptScans: { select: { id: true }, take: 1 },
      },
    }),
    prisma.importBatch.findMany({
      where: {
        accountId: { in: accountIds },
        createdAt: { gte: batchFrom, lt: batchTo },
      },
      select: { accountId: true },
    }),
  ]);

  const batchCount = new Map<string, number>();
  for (const b of batches) {
    batchCount.set(b.accountId, (batchCount.get(b.accountId) ?? 0) + 1);
  }

  return accounts.map((a) => {
    const rows = txns.filter((t) => t.accountId === a.id);
    let billsImported = 0;
    let manualEntries = 0;
    let ingTxnCount = 0;
    for (const t of rows) {
      const billish =
        isBillImportPendingNotes(t.notes) || t.receiptScans.length > 0;
      if (billish) billsImported++;
      if (t.importFingerprint) ingTxnCount++;
      if (
        !t.importBatchId &&
        !billish &&
        !t.importFingerprint
      ) {
        manualEntries++;
      }
    }
    return {
      accountId: a.id,
      accountName: a.name,
      month,
      billsImported,
      manualEntries,
      ingBatches: batchCount.get(a.id) ?? 0,
      ingTxnCount,
    };
  });
}
