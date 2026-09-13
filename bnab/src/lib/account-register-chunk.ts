import {
  dateIdCursorOr,
  decodeListCursor,
  LIST_PAGE_SIZE,
  nextCursorFromRows,
} from "@/lib/list-cursor";
import { prisma } from "@/lib/prisma";

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
};

export async function fetchAccountRegisterChunk(
  accountId: string,
  cursor?: string | null,
  take = LIST_PAGE_SIZE,
): Promise<{
  items: AccountRegisterItem[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const decoded = decodeListCursor(cursor);
  const baseWhere = { accountId, isChild: false };
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
      payee: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

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
  }));

  const { nextCursor, hasMore } = nextCursorFromRows(items, take);
  return { items, nextCursor, hasMore };
}
