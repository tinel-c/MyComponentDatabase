import type { Prisma } from "@prisma/client";
import {
  dateIdCursorOr,
  decodeListCursor,
  LIST_PAGE_SIZE,
  nextCursorFromRows,
} from "@/lib/list-cursor";
import { prisma } from "@/lib/prisma";

export type AccountRegisterFilters = {
  q?: string;
  categoryId?: string;
  dir?: "in" | "out";
  from?: string;
  to?: string;
  cleared?: "0" | "1";
  planned?: "linked" | "none";
};

export type AccountRegisterItem = {
  id: string;
  date: string;
  amount: number;
  cleared: boolean;
  reconciled: boolean;
  isParent: boolean;
  isStartingBalance: boolean;
  transferTwinId: string | null;
  payeeName: string | null;
  categoryName: string | null;
  notes: string | null;
  scheduledTransactionId: string | null;
  plannedLabel: string | null;
};

export function buildAccountRegisterWhere(
  accountId: string,
  filters: AccountRegisterFilters = {},
): Prisma.TransactionWhereInput {
  const { q, categoryId, dir, from, to, cleared, planned } = filters;
  const dateFilter: Prisma.StringFilter | undefined =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

  return {
    accountId,
    isChild: false,
    ...(categoryId ? { categoryId } : {}),
    ...(dir === "in"
      ? { amount: { gt: 0 } }
      : dir === "out"
        ? { amount: { lt: 0 } }
        : {}),
    ...(dateFilter ? { date: dateFilter } : {}),
    ...(cleared === "1"
      ? { cleared: true }
      : cleared === "0"
        ? { cleared: false }
        : {}),
    ...(planned === "linked"
      ? { scheduledTransactionId: { not: null } }
      : planned === "none"
        ? { scheduledTransactionId: null }
        : {}),
    ...(q
      ? {
          OR: [
            { notes: { contains: q } },
            { payee: { name: { contains: q } } },
            { category: { name: { contains: q } } },
          ],
        }
      : {}),
  };
}

export async function fetchAccountRegisterChunk(
  accountId: string,
  cursor?: string | null,
  take = LIST_PAGE_SIZE,
  filters: AccountRegisterFilters = {},
): Promise<{
  items: AccountRegisterItem[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const decoded = decodeListCursor(cursor);
  const baseWhere = buildAccountRegisterWhere(accountId, filters);
  const where = decoded
    ? { AND: [baseWhere, { OR: dateIdCursorOr(decoded) }] }
    : baseWhere;

  const rows = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      date: true,
      amount: true,
      cleared: true,
      reconciled: true,
      isParent: true,
      isStartingBalance: true,
      transferTwinId: true,
      notes: true,
      scheduledTransactionId: true,
      payee: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  const scheduleIds = [
    ...new Set(
      rows
        .map((r) => r.scheduledTransactionId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const schedules = scheduleIds.length
    ? await prisma.scheduledTransaction.findMany({
        where: { id: { in: scheduleIds } },
        select: {
          id: true,
          notes: true,
          payee: { select: { name: true } },
          category: { select: { name: true } },
        },
      })
    : [];
  const labelById = new Map(
    schedules.map((s) => {
      const label =
        s.payee?.name ??
        s.category?.name ??
        s.notes?.slice(0, 40) ??
        "Planned";
      return [s.id, label] as const;
    }),
  );

  const items: AccountRegisterItem[] = rows.map((t) => ({
    id: t.id,
    date: t.date,
    amount: t.amount,
    cleared: t.cleared,
    reconciled: t.reconciled,
    isParent: t.isParent,
    isStartingBalance: t.isStartingBalance,
    transferTwinId: t.transferTwinId,
    payeeName: t.payee?.name ?? null,
    categoryName: t.category?.name ?? null,
    notes: t.notes,
    scheduledTransactionId: t.scheduledTransactionId,
    plannedLabel: t.scheduledTransactionId
      ? (labelById.get(t.scheduledTransactionId) ?? "Planned")
      : null,
  }));

  const { nextCursor, hasMore } = nextCursorFromRows(items, take);
  return { items, nextCursor, hasMore };
}
