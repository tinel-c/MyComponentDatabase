import type { PrismaClient } from "@prisma/client";
import { parseReceiptWithGemini } from "./gemini";
import { findTransactionsForReceipt, type TxnMatchCandidate } from "./match-transactions";
import { aggregateProposedSplits, mapReceiptLines } from "./map-lines";
import { saveReceiptImage } from "./storage";
import type { MappedReceiptLine, ProposedSplit } from "./types";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function extForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

export type BillImportScanResult = {
  scanId: string;
  status: "ok" | "error" | "needs_mapping";
  errorText?: string;
  merchant?: string | null;
  receiptDate?: string | null;
  receiptTotalCents?: number;
  autoMatchId: string | null;
  candidates: TxnMatchCandidate[];
  nearby: TxnMatchCandidate[];
  lines: MappedReceiptLine[];
  proposedSplits: ProposedSplit[];
  transactionId?: string | null;
};

/**
 * Upload-first bill import: parse with Gemini, match bank txn by date+amount,
 * or return candidates for manual mapping.
 */
export async function scanBillForImport(params: {
  prisma: PrismaClient;
  budgetId: string;
  currency: string;
  imageBytes: Buffer;
  mimeType: string;
}): Promise<BillImportScanResult> {
  const mime = params.mimeType.toLowerCase().split(";")[0].trim();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Unsupported image type (use JPEG, PNG, or WebP)");
  }

  const categories = await params.prisma.category.findMany({
    where: { group: { budgetId: params.budgetId }, hidden: false },
    select: { id: true, name: true, isIncome: true },
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

  const scan = await params.prisma.receiptScan.create({
    data: {
      budgetId: params.budgetId,
      transactionId: null,
      status: "pending",
    },
  });

  let imagePath: string | null = null;
  try {
    imagePath = await saveReceiptImage({
      budgetId: params.budgetId,
      transactionId: scan.id,
      bytes: params.imageBytes,
      ext: extForMime(mime),
    });
  } catch {
    imagePath = null;
  }

  try {
    const gemini = await parseReceiptWithGemini({
      imageBytes: params.imageBytes,
      mimeType: mime,
      categoryNames: categories.filter((c) => !c.isIncome).map((c) => c.name),
      currency: params.currency,
      expectedTotalCents: 0,
    });

    const lineSumCents = Math.round(
      gemini.lines.reduce((s, l) => s + l.amount, 0) * 100,
    );
    const totalCents =
      typeof gemini.total === "number" && gemini.total > 0
        ? Math.round(gemini.total * 100)
        : lineSumCents;

    if (totalCents <= 0) {
      throw new Error("Could not read a total from the receipt");
    }

    const mapped = mapReceiptLines({
      lines: gemini.lines,
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

    await params.prisma.receiptScanLine.deleteMany({ where: { scanId: scan.id } });
    await params.prisma.receiptScanLine.createMany({
      data: mapped.map((line, i) => ({
        scanId: scan.id,
        description: line.description,
        amountCents: line.amountCents,
        categoryHint: line.categoryHint,
        matchedRuleId: line.matchedRuleId,
        sortOrder: i,
      })),
    });

    const { exact, nearby, autoMatchId } = await findTransactionsForReceipt({
      prisma: params.prisma,
      budgetId: params.budgetId,
      amountCents: totalCents,
      receiptDate: gemini.date ?? null,
    });

    const proposedSplits = aggregateProposedSplits(mapped, totalCents);

    await params.prisma.receiptScan.update({
      where: { id: scan.id },
      data: {
        imagePath,
        model: gemini.model,
        rawJson: gemini.rawText,
        status: autoMatchId ? "preview" : "needs_mapping",
        transactionId: autoMatchId,
        errorText: null,
      },
    });

    return {
      scanId: scan.id,
      status: autoMatchId ? "ok" : "needs_mapping",
      merchant: gemini.merchant ?? null,
      receiptDate: gemini.date ?? null,
      receiptTotalCents: totalCents,
      autoMatchId,
      candidates: exact,
      nearby,
      lines: mapped,
      proposedSplits,
      transactionId: autoMatchId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bill scan failed";
    await params.prisma.receiptScan.update({
      where: { id: scan.id },
      data: { status: "error", errorText: message, imagePath },
    });
    return {
      scanId: scan.id,
      status: "error",
      errorText: message,
      autoMatchId: null,
      candidates: [],
      nearby: [],
      lines: [],
      proposedSplits: [],
    };
  }
}

/** Attach a scanned bill to a chosen bank transaction and return proposed splits. */
export async function bindBillScanToTransaction(params: {
  prisma: PrismaClient;
  budgetId: string;
  scanId: string;
  transactionId: string;
}): Promise<BillImportScanResult> {
  const scan = await params.prisma.receiptScan.findFirst({
    where: { id: params.scanId, budgetId: params.budgetId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!scan) throw new Error("Scan not found");

  const txn = await params.prisma.transaction.findFirst({
    where: {
      id: params.transactionId,
      account: { budgetId: params.budgetId },
      isChild: false,
    },
    include: {
      payee: true,
      account: { select: { name: true } },
    },
  });
  if (!txn) throw new Error("Transaction not found");
  if (txn.transferTwinId) throw new Error("Cannot detail a transfer");

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

  await params.prisma.receiptScan.update({
    where: { id: scan.id },
    data: {
      transactionId: txn.id,
      status: "preview",
    },
  });

  return {
    scanId: scan.id,
    status: "ok",
    receiptTotalCents: Math.abs(txn.amount),
    autoMatchId: txn.id,
    candidates: [
      {
        id: txn.id,
        date: txn.date,
        amount: txn.amount,
        payee: txn.payee?.name ?? null,
        accountName: txn.account.name,
        notes: txn.notes,
        alreadySplit: txn.isParent,
        score: 100,
      },
    ],
    nearby: [],
    lines: mapped,
    proposedSplits,
    transactionId: txn.id,
  };
}
