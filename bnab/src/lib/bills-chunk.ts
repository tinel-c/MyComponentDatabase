import {
  createdAtIdCursorOr,
  decodeListCursor,
  LIST_PAGE_SIZE,
  nextCursorFromRows,
} from "@/lib/list-cursor";
import { prisma } from "@/lib/prisma";

export type BillListItem = {
  id: string;
  /** ISO createdAt — used as cursor date slot. */
  date: string;
  createdAtLabel: string;
  status: string;
  model: string | null;
  errorText: string | null;
  merchant: string | null;
  receiptDate: string | null;
  totalCents: number | null;
  lineCount: number;
  lineSumCents: number;
  transaction: {
    id: string;
    date: string;
    amount: number;
    accountName: string;
    payeeName: string | null;
    importFingerprint: string | null;
    notes: string | null;
    importBatch: {
      id: string;
      sourceLabel: string | null;
    } | null;
  } | null;
};

function parseReceiptMeta(rawJson: string | null): {
  merchant: string | null;
  date: string | null;
  totalCents: number | null;
} {
  if (!rawJson) return { merchant: null, date: null, totalCents: null };
  try {
    const obj = JSON.parse(rawJson) as Record<string, unknown>;
    const merchant =
      typeof obj.merchant === "string" ? obj.merchant.trim() || null : null;
    const date =
      typeof obj.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.date)
        ? obj.date
        : null;
    const totalCents =
      typeof obj.total === "number" && obj.total > 0
        ? Math.round(obj.total * 100)
        : null;
    return { merchant, date, totalCents };
  } catch {
    return { merchant: null, date: null, totalCents: null };
  }
}

export async function fetchBillsChunk(
  budgetId: string,
  cursor?: string | null,
  take = LIST_PAGE_SIZE,
): Promise<{
  items: BillListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const decoded = decodeListCursor(cursor);
  const baseWhere = { budgetId };
  const where = decoded
    ? { AND: [baseWhere, { OR: createdAtIdCursorOr(decoded) }] }
    : baseWhere;

  const scans = await prisma.receiptScan.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: {
      lines: { select: { id: true, amountCents: true } },
      transaction: {
        include: {
          payee: { select: { name: true } },
          account: { select: { name: true } },
          importBatch: {
            select: { id: true, sourceLabel: true },
          },
        },
      },
    },
  });

  const items: BillListItem[] = scans.map((scan) => {
    const meta = parseReceiptMeta(scan.rawJson);
    const lineSumCents = scan.lines.reduce((s, l) => s + l.amountCents, 0);
    const txn = scan.transaction;
    return {
      id: scan.id,
      date: scan.createdAt.toISOString(),
      createdAtLabel: scan.createdAt
        .toISOString()
        .slice(0, 16)
        .replace("T", " "),
      status: scan.status,
      model: scan.model,
      errorText: scan.errorText,
      merchant: meta.merchant,
      receiptDate: meta.date,
      totalCents: meta.totalCents,
      lineCount: scan.lines.length,
      lineSumCents,
      transaction: txn
        ? {
            id: txn.id,
            date: txn.date,
            amount: txn.amount,
            accountName: txn.account.name,
            payeeName: txn.payee?.name ?? null,
            importFingerprint: txn.importFingerprint,
            notes: txn.notes,
            importBatch: txn.importBatch
              ? {
                  id: txn.importBatch.id,
                  sourceLabel: txn.importBatch.sourceLabel,
                }
              : null,
          }
        : null,
    };
  });

  const { nextCursor, hasMore } = nextCursorFromRows(items, take);
  return { items, nextCursor, hasMore };
}
