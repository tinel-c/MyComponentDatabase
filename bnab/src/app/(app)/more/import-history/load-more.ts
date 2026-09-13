"use server";

import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  fetchImportBatchItemsChunk,
  type ImportHistoryItemFilters,
} from "@/lib/import-history-items-chunk";

export async function loadMoreImportBatchItems(opts: {
  batchId: string;
  cursor: string;
  filters?: ImportHistoryItemFilters;
}) {
  const { budget } = await requireBudgetAccess();
  const batch = await prisma.importBatch.findFirst({
    where: { id: opts.batchId, budgetId: budget.id },
    select: { id: true },
  });
  if (!batch) {
    return {
      items: [],
      nextCursor: null as string | null,
      hasMore: false,
      ruleById: {} as Record<string, string>,
      scheduleLabelById: {} as Record<string, string>,
    };
  }
  const chunk = await fetchImportBatchItemsChunk({
    batchId: opts.batchId,
    cursor: opts.cursor,
    filters: opts.filters,
  });
  const ruleIds = [
    ...new Set(
      chunk.items
        .map((i) => i.importRuleId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const scheduleIds = [
    ...new Set(
      chunk.items
        .map((i) => i.scheduledTransactionId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const [rules, schedules] = await Promise.all([
    ruleIds.length
      ? prisma.importCategoryRule.findMany({
          where: { id: { in: ruleIds }, budgetId: budget.id },
          select: { id: true, matchText: true },
        })
      : Promise.resolve([]),
    scheduleIds.length
      ? prisma.scheduledTransaction.findMany({
          where: { id: { in: scheduleIds }, budgetId: budget.id },
          select: {
            id: true,
            notes: true,
            payee: { select: { name: true } },
            category: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  return {
    ...chunk,
    ruleById: Object.fromEntries(rules.map((r) => [r.id, r.matchText])),
    scheduleLabelById: Object.fromEntries(
      schedules.map((s) => [
        s.id,
        s.payee?.name ?? s.category?.name ?? s.notes?.slice(0, 40) ?? "Planned",
      ]),
    ),
  };
}
