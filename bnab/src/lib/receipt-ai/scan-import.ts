import type { PrismaClient } from "@prisma/client";
import { parseReceiptWithGemini } from "./gemini";
import { findTransactionsForReceipt, type TxnMatchCandidate } from "./match-transactions";
import { aggregateProposedSplits, mapReceiptLines } from "./map-lines";
import { applyReceiptSplits } from "./apply-split";
import { saveReceiptImage } from "./storage";
import { todayISO } from "@/lib/money";
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

/**
 * Create a manual (unfingerprint) transaction from a bill scan so Plan is
 * correct now; ING CSV import can later link via findManualMatch.
 */
export async function createTransactionFromBillScan(params: {
  prisma: PrismaClient;
  budgetId: string;
  scanId: string;
  accountId: string;
  /** Optional override; otherwise Gemini date or today. */
  date?: string | null;
  merchant?: string | null;
  totalCents?: number | null;
}): Promise<BillImportScanResult & { createdAsNew: true }> {
  const account = await params.prisma.financeAccount.findFirst({
    where: {
      id: params.accountId,
      budgetId: params.budgetId,
      closed: false,
      onBudget: true,
    },
  });
  if (!account) throw new Error("Pick an on-budget account");

  const scan = await params.prisma.receiptScan.findFirst({
    where: { id: params.scanId, budgetId: params.budgetId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!scan) throw new Error("Scan not found");
  if (scan.transactionId) {
    throw new Error("This bill is already linked to a transaction");
  }

  const meta = parseStoredReceiptMeta(scan.rawJson);
  const lineSum = scan.lines.reduce((s, l) => s + l.amountCents, 0);
  const totalCents =
    (params.totalCents && params.totalCents > 0
      ? params.totalCents
      : null) ??
    meta.totalCents ??
    (lineSum > 0 ? lineSum : null);
  if (!totalCents || totalCents <= 0) {
    throw new Error("Receipt total is missing — scan again");
  }

  const dateCandidate =
    params.date?.trim() ||
    meta.date ||
    todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateCandidate)
    ? dateCandidate
    : todayISO();

  const merchantName = (
    params.merchant?.trim() ||
    meta.merchant ||
    ""
  ).slice(0, 120);

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

  const proposedSplits = aggregateProposedSplits(mapped, totalCents);

  let payeeId: string | null = null;
  if (merchantName) {
    const primaryCat =
      proposedSplits.length === 1 ? proposedSplits[0].categoryId : null;
    const payee = await params.prisma.payee.upsert({
      where: {
        budgetId_name: { budgetId: params.budgetId, name: merchantName },
      },
      create: {
        budgetId: params.budgetId,
        name: merchantName,
        lastCategoryId: primaryCat,
      },
      update: primaryCat ? { lastCategoryId: primaryCat } : {},
    });
    payeeId = payee.id;
  }

  const linePreview = mapped
    .filter((l) => !l.ignored)
    .slice(0, 6)
    .map((l) => l.description)
    .join("; ")
    .slice(0, 160);

  const notes = [
    "Bill import · pending statement",
    linePreview || null,
  ]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 240);

  const singleCategory =
    proposedSplits.length === 1 ? proposedSplits[0].categoryId : null;

  const txn = await params.prisma.transaction.create({
    data: {
      accountId: account.id,
      date,
      amount: -Math.abs(totalCents),
      payeeId,
      categoryId: proposedSplits.length === 1 ? singleCategory : null,
      notes,
      cleared: false,
      // no importFingerprint — ING import will link later
    },
  });

  if (proposedSplits.length >= 1) {
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
  }

  await params.prisma.receiptScan.update({
    where: { id: scan.id },
    data: {
      transactionId: txn.id,
      status: "ok",
      errorText: null,
    },
  });

  return {
    scanId: scan.id,
    status: "ok",
    merchant: merchantName || null,
    receiptDate: date,
    receiptTotalCents: totalCents,
    autoMatchId: txn.id,
    candidates: [],
    nearby: [],
    lines: mapped,
    proposedSplits,
    transactionId: txn.id,
    createdAsNew: true,
  };
}
