import type { Prisma } from "@prisma/client";
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

export type ImportHistoryItemFilters = {
  q?: string;
  rule?: string;
  planned?: string;
  action?: string;
};

/** Canonical ImportBatchItem.action values (import-vocabulary.md). */
export const IMPORT_HISTORY_ACTION_OPTIONS = [
  { value: "created", label: "Created" },
  { value: "created_transfer_twin", label: "Transfer twin" },
  { value: "linked_manual", label: "Linked existing" },
  { value: "linked_receipt_scan", label: "Linked bill scan" },
  { value: "skipped_duplicate", label: "Skipped duplicate" },
] as const;

const ACTION_VALUES = new Set(
  IMPORT_HISTORY_ACTION_OPTIONS.map((o) => o.value),
);

export function parseImportHistoryAction(
  raw: string | undefined,
): string | undefined {
  const v = raw?.trim();
  return v && ACTION_VALUES.has(v as (typeof IMPORT_HISTORY_ACTION_OPTIONS)[number]["value"])
    ? v
    : undefined;
}

export function buildImportBatchItemsWhere(
  batchId: string,
  filters: ImportHistoryItemFilters = {},
): Prisma.ImportBatchItemWhereInput {
  const q = filters.q?.trim();
  return {
    batchId,
    ...(filters.rule ? { importRuleId: filters.rule } : {}),
    ...(filters.planned ? { scheduledTransactionId: filters.planned } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    // SQLite LIKE is case-insensitive for ASCII a–z
    ...(q ? { memoPreview: { contains: q } } : {}),
  };
}

export async function fetchImportBatchItemsChunk(opts: {
  batchId: string;
  cursor?: string | null;
  take?: number;
  filters?: ImportHistoryItemFilters;
}): Promise<{
  items: ImportHistoryItemRow[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const take = opts.take ?? LIST_PAGE_SIZE;
  const cursorId = opts.cursor || null;
  const baseWhere = buildImportBatchItemsWhere(
    opts.batchId,
    opts.filters ?? {},
  );

  const rows = await prisma.importBatchItem.findMany({
    where: {
      ...baseWhere,
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
