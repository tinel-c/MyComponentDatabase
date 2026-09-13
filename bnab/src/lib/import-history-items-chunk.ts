import { prisma } from "@/lib/prisma";
import { LIST_PAGE_SIZE } from "@/lib/list-cursor";

export type ImportHistoryItemRow = {
  id: string;
  action: string;
  memoPreview: string | null;
  transactionId: string | null;
  importRuleId: string | null;
  scheduledTransactionId: string | null;
  classification: string | null;
};

export async function fetchImportBatchItemsChunk(opts: {
  batchId: string;
  cursor?: string | null;
  take?: number;
}): Promise<{
  items: ImportHistoryItemRow[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const take = opts.take ?? LIST_PAGE_SIZE;
  const cursorId = opts.cursor || null;

  const rows = await prisma.importBatchItem.findMany({
    where: {
      batchId: opts.batchId,
      ...(cursorId ? { id: { gt: cursorId } } : {}),
    },
    orderBy: { id: "asc" },
    take,
    select: {
      id: true,
      action: true,
      memoPreview: true,
      transactionId: true,
      importRuleId: true,
      scheduledTransactionId: true,
      classification: true,
    },
  });

  const hasMore = rows.length === take;
  const nextCursor = hasMore ? rows[rows.length - 1]!.id : null;
  return { items: rows, nextCursor, hasMore };
}
