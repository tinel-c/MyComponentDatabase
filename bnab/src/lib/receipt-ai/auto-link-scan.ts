import type { PrismaClient } from "@prisma/client";
import { addDaysISO } from "@/lib/money";
import { applyReceiptSplits } from "./apply-split";
import { aggregateProposedSplits, mapReceiptLines } from "./map-lines";
import { bindBillScanToTransaction } from "./scan-import";

function amountClose(a: number, b: number, tol = 2): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) <= tol;
}

function parseStoredReceiptMeta(rawJson: string | null): {
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

function isoDateFromCreatedAt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type PendingScanMatch = {
  scanId: string;
  score: number;
  totalCents: number;
  date: string;
};

/**
 * Find unlinked receipt scans that match a bank outflow by amount (±2 bani)
 * and date (±3 days). Auto-link only when exactly one candidate scores ≥ 70.
 */
export async function findPendingReceiptScanForTransaction(params: {
  prisma: PrismaClient;
  budgetId: string;
  amountCents: number;
  date: string;
}): Promise<{
  candidates: PendingScanMatch[];
  autoMatchId: string | null;
}> {
  const abs = Math.abs(params.amountCents);
  if (abs <= 0 || params.amountCents > 0) {
    return { candidates: [], autoMatchId: null };
  }

  const dateFrom = addDaysISO(params.date, -3);
  const dateTo = addDaysISO(params.date, 3);

  const scans = await params.prisma.receiptScan.findMany({
    where: {
      budgetId: params.budgetId,
      transactionId: null,
      status: { in: ["ok", "needs_mapping"] },
      lines: { some: {} },
    },
    include: {
      lines: { select: { amountCents: true, matchedRule: { select: { ignore: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const candidates: PendingScanMatch[] = [];
  for (const scan of scans) {
    const meta = parseStoredReceiptMeta(scan.rawJson);
    const lineSum = scan.lines
      .filter((l) => !l.matchedRule?.ignore)
      .reduce((s, l) => s + l.amountCents, 0);
    const totalCents =
      meta.totalCents && meta.totalCents > 0 ? meta.totalCents : lineSum;
    if (!amountClose(totalCents, abs)) continue;

    const scanDate =
      meta.date ??
      (scan.createdAt ? isoDateFromCreatedAt(scan.createdAt) : null);
    if (!scanDate) continue;
    if (scanDate < dateFrom || scanDate > dateTo) continue;

    const dayDiff = Math.abs(
      (Date.parse(params.date) - Date.parse(scanDate)) / 86_400_000,
    );
    const score = 100 - dayDiff * 10;
    candidates.push({
      scanId: scan.id,
      score,
      totalCents,
      date: scanDate,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const autoMatchId =
    candidates.length === 1 && candidates[0].score >= 70
      ? candidates[0].scanId
      : null;

  return { candidates, autoMatchId };
}

/**
 * If exactly one pending scan matches this outflow, bind + apply splits.
 * Returns scanId when linked, null otherwise.
 */
export async function tryAutoLinkPendingScanToTransaction(params: {
  prisma: PrismaClient;
  budgetId: string;
  transactionId: string;
}): Promise<string | null> {
  const txn = await params.prisma.transaction.findFirst({
    where: {
      id: params.transactionId,
      account: { budgetId: params.budgetId },
      isChild: false,
    },
  });
  if (!txn || txn.amount >= 0 || txn.transferTwinId) return null;

  const already = await params.prisma.receiptScan.findFirst({
    where: { transactionId: txn.id },
    select: { id: true },
  });
  if (already) return null;

  const { autoMatchId } = await findPendingReceiptScanForTransaction({
    prisma: params.prisma,
    budgetId: params.budgetId,
    amountCents: txn.amount,
    date: txn.date,
  });
  if (!autoMatchId) return null;

  await bindBillScanToTransaction({
    prisma: params.prisma,
    budgetId: params.budgetId,
    scanId: autoMatchId,
    transactionId: txn.id,
  });

  const scan = await params.prisma.receiptScan.findFirst({
    where: { id: autoMatchId, budgetId: params.budgetId },
    include: { lines: true },
  });
  if (!scan) return autoMatchId;

  const categories = await params.prisma.category.findMany({
    where: { group: { budgetId: params.budgetId }, hidden: false },
    select: { id: true, name: true },
  });
  const categoriesByName = new Map(
    categories.map((c) => [c.name, { id: c.id, name: c.name }]),
  );
  const unknown = categoriesByName.get("Unknown") ?? null;
  const rules = await params.prisma.receiptCategoryRule.findMany({
    where: { budgetId: params.budgetId },
    include: { category: { select: { name: true } } },
    orderBy: { sortOrder: "asc" },
  });

  const mapped = mapReceiptLines({
    lines: scan.lines.map((l) => ({
      description: l.description,
      amount: l.amountCents / 100,
      categoryHint: l.categoryHint ?? undefined,
    })),
    rules: rules.map((r) => ({
      id: r.id,
      matchText: r.matchText,
      ignore: r.ignore,
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? null,
      sortOrder: r.sortOrder,
    })),
    categoriesByName,
    unknownCategoryId: unknown?.id ?? null,
    unknownCategoryName: unknown?.name ?? "Unknown",
  });

  const proposedSplits = aggregateProposedSplits(
    mapped,
    Math.abs(txn.amount),
  );
  if (proposedSplits.length < 1) {
    await params.prisma.receiptScan.update({
      where: { id: scan.id },
      data: { status: "ok" },
    });
    return autoMatchId;
  }

  const { childIdsByCategory } = await applyReceiptSplits({
    prisma: params.prisma,
    transactionId: txn.id,
    budgetId: params.budgetId,
    splits: proposedSplits,
  });

  for (const line of scan.lines) {
    const m = mapped.find(
      (x) =>
        x.description === line.description &&
        x.amountCents === line.amountCents,
    );
    const childId = m?.categoryId
      ? childIdsByCategory.get(m.categoryId)
      : undefined;
    if (childId) {
      await params.prisma.receiptScanLine.update({
        where: { id: line.id },
        data: { childTransactionId: childId },
      });
    }
  }

  await params.prisma.receiptScan.update({
    where: { id: scan.id },
    data: { status: "ok", transactionId: txn.id },
  });

  return autoMatchId;
}
