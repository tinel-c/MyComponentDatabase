import type { Prisma } from "@prisma/client";
import {
  createdAtIdCursorOr,
  decodeListCursor,
  LIST_PAGE_SIZE,
  nextCursorFromRows,
} from "@/lib/list-cursor";
import { prisma } from "@/lib/prisma";
import { BILL_IMPORT_PENDING_NOTE } from "@/lib/ing-import/overlap";

export type BillListStatusFilter = "all" | "unlinked" | "needs_mapping";

/** Vocabulary: Bill link state */
export type BillLinkState =
  | "unlinked"
  | "linked_register"
  | "awaiting_ing"
  | "linked_ing";

export type BillAuditLine = {
  id: string;
  description: string;
  amountCents: number;
  /** AI category hint — raw Gemini hint (often coerced to a budget name). */
  categoryHint: string | null;
  /** Category matched — rule category, else hint when not ignored. */
  categoryMatched: string | null;
  ignored: boolean;
  /** Receipt rule hit */
  receiptRule: {
    id: string;
    matchText: string;
    ignore: boolean;
    categoryName: string | null;
  } | null;
};

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
  lines: BillAuditLine[];
  linkState: BillLinkState;
  transaction: {
    id: string;
    date: string;
    amount: number;
    accountName: string;
    payeeName: string | null;
    importFingerprint: string | null;
    notes: string | null;
    isPendingBill: boolean;
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

function linkStateFor(txn: {
  importFingerprint: string | null;
  notes: string | null;
  isPendingBill: boolean;
} | null): BillLinkState {
  if (!txn) return "unlinked";
  if (txn.importFingerprint) return "linked_ing";
  if (
    txn.isPendingBill ||
    (txn.notes?.includes(BILL_IMPORT_PENDING_NOTE) ?? false) ||
    (txn.notes?.includes("Bill import") ?? false)
  ) {
    return "awaiting_ing";
  }
  return "linked_register";
}

export function parseBillStatusFilter(
  raw: string | null | undefined,
): BillListStatusFilter {
  if (raw === "unlinked" || raw === "needs_mapping") return raw;
  return "all";
}

export async function fetchBillsChunk(
  budgetId: string,
  cursor?: string | null,
  take = LIST_PAGE_SIZE,
  statusFilter: BillListStatusFilter = "all",
): Promise<{
  items: BillListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const decoded = decodeListCursor(cursor);
  const baseWhere: Prisma.ReceiptScanWhereInput = { budgetId };
  if (statusFilter === "unlinked") {
    baseWhere.transactionId = null;
  } else if (statusFilter === "needs_mapping") {
    baseWhere.status = "needs_mapping";
  }
  const where: Prisma.ReceiptScanWhereInput = decoded
    ? { AND: [baseWhere, { OR: createdAtIdCursorOr(decoded) }] }
    : baseWhere;

  const scans = await prisma.receiptScan.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: {
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          matchedRule: {
            select: {
              id: true,
              matchText: true,
              ignore: true,
              category: { select: { name: true } },
            },
          },
        },
      },
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
    const lines: BillAuditLine[] = scan.lines.map((l) => {
      const ignored = Boolean(l.matchedRule?.ignore);
      const ruleCategory = l.matchedRule?.category?.name ?? null;
      const categoryMatched = ignored
        ? null
        : (ruleCategory ?? l.categoryHint ?? null);
      return {
        id: l.id,
        description: l.description,
        amountCents: l.amountCents,
        categoryHint: l.categoryHint,
        categoryMatched,
        ignored,
        receiptRule: l.matchedRule
          ? {
              id: l.matchedRule.id,
              matchText: l.matchedRule.matchText,
              ignore: l.matchedRule.ignore,
              categoryName: ruleCategory,
            }
          : null,
      };
    });
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
      lines,
      linkState: linkStateFor(
        txn
          ? {
              importFingerprint: txn.importFingerprint,
              notes: txn.notes,
              isPendingBill: txn.isPendingBill,
            }
          : null,
      ),
      transaction: txn
        ? {
            id: txn.id,
            date: txn.date,
            amount: txn.amount,
            accountName: txn.account.name,
            payeeName: txn.payee?.name ?? null,
            importFingerprint: txn.importFingerprint,
            notes: txn.notes,
            isPendingBill: txn.isPendingBill,
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
