import type { PrismaClient } from "@prisma/client";
import { applyReceiptSplits } from "./apply-split";
import { parseReceiptWithGemini } from "./gemini";
import { aggregateProposedSplits, mapReceiptLines } from "./map-lines";
import { saveReceiptImage } from "./storage";
import type { ProcessReceiptResult } from "./types";

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

/**
 * Programmatic entry: parse a bill image for an existing ING/bank transaction,
 * map lines via ReceiptCategoryRule, optionally apply category splits.
 */
export async function processReceiptDetailing(params: {
  prisma: PrismaClient;
  budgetId: string;
  currency: string;
  transactionId: string;
  imageBytes: Buffer;
  mimeType: string;
  /** When true, write split children; otherwise preview only. */
  confirm?: boolean;
}): Promise<ProcessReceiptResult> {
  const mime = params.mimeType.toLowerCase().split(";")[0].trim();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Unsupported image type (use JPEG, PNG, or WebP)");
  }

  const txn = await params.prisma.transaction.findFirst({
    where: {
      id: params.transactionId,
      account: { budgetId: params.budgetId },
      isChild: false,
    },
    include: { payee: true },
  });
  if (!txn) throw new Error("Transaction not found");
  if (txn.transferTwinId) throw new Error("Cannot detail a transfer");

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

  let imagePath: string | null = null;
  try {
    imagePath = await saveReceiptImage({
      budgetId: params.budgetId,
      transactionId: txn.id,
      bytes: params.imageBytes,
      ext: extForMime(mime),
    });
  } catch {
    imagePath = null;
  }

  const scan = await params.prisma.receiptScan.create({
    data: {
      budgetId: params.budgetId,
      transactionId: txn.id,
      imagePath,
      status: "pending",
    },
  });

  try {
    const gemini = await parseReceiptWithGemini({
      imageBytes: params.imageBytes,
      mimeType: mime,
      categoryNames: categories
        .filter((c) => !c.isIncome)
        .map((c) => c.name),
      currency: params.currency,
      expectedTotalCents: Math.abs(txn.amount),
      merchantHint: txn.payee?.name ?? txn.notes,
      dateHint: txn.date,
    });

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

    const proposedSplits = aggregateProposedSplits(
      mapped,
      Math.abs(txn.amount),
    );

    if (proposedSplits.length < 1) {
      throw new Error("No categorizable lines found on the receipt");
    }

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

    let applied = false;
    if (params.confirm) {
      const { childIdsByCategory } = await applyReceiptSplits({
        prisma: params.prisma,
        transactionId: txn.id,
        budgetId: params.budgetId,
        splits: proposedSplits,
      });

      const lines = await params.prisma.receiptScanLine.findMany({
        where: { scanId: scan.id },
      });
      for (const line of lines) {
        const mappedLine = mapped.find(
          (m) =>
            m.description === line.description &&
            m.amountCents === line.amountCents,
        );
        const childId = mappedLine?.categoryId
          ? childIdsByCategory.get(mappedLine.categoryId)
          : undefined;
        if (childId) {
          await params.prisma.receiptScanLine.update({
            where: { id: line.id },
            data: { childTransactionId: childId },
          });
        }
      }
      applied = true;
    }

    await params.prisma.receiptScan.update({
      where: { id: scan.id },
      data: {
        status: params.confirm ? "ok" : "preview",
        model: gemini.model,
        rawJson: gemini.rawText,
        errorText: null,
      },
    });

    return {
      scanId: scan.id,
      status: params.confirm ? "ok" : "preview",
      lines: mapped,
      proposedSplits,
      applied,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Receipt scan failed";
    await params.prisma.receiptScan.update({
      where: { id: scan.id },
      data: { status: "error", errorText: message },
    });
    return {
      scanId: scan.id,
      status: "error",
      errorText: message,
      lines: [],
      proposedSplits: [],
    };
  }
}

export { applyReceiptSplits } from "./apply-split";
export { aggregateProposedSplits, mapReceiptLines } from "./map-lines";
export { parseReceiptWithGemini } from "./gemini";
export {
  scanBillForImport,
  bindBillScanToTransaction,
} from "./scan-import";
export { findTransactionsForReceipt } from "./match-transactions";
