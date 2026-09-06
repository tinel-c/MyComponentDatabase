"use server";

import { revalidatePath } from "next/cache";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { processReceiptDetailing } from "@/lib/receipt-ai";
import {
  bindBillScanToTransaction,
  scanBillForImport,
} from "@/lib/receipt-ai/scan-import";
import {
  ensureYngsbCategories,
  seedDefaultReceiptRules,
} from "@/lib/starter-categories";

export type ReceiptDetailActionState = {
  ok: boolean;
  error?: string;
  scanId?: string;
  proposedSplits?: {
    categoryId: string;
    categoryName: string;
    amountCents: number;
    notes: string;
  }[];
  lines?: {
    description: string;
    amountCents: number;
    categoryName: string | null;
    ignored: boolean;
  }[];
};

export type BillImportActionState = {
  ok: boolean;
  error?: string;
  phase?: "upload" | "mapping" | "preview" | "done";
  scanId?: string;
  merchant?: string | null;
  receiptDate?: string | null;
  receiptTotalCents?: number;
  transactionId?: string | null;
  needsMapping?: boolean;
  candidates?: {
    id: string;
    date: string;
    amount: number;
    payee: string | null;
    accountName: string;
    notes: string | null;
    alreadySplit: boolean;
  }[];
  nearby?: {
    id: string;
    date: string;
    amount: number;
    payee: string | null;
    accountName: string;
    notes: string | null;
    alreadySplit: boolean;
  }[];
  proposedSplits?: {
    categoryId: string;
    categoryName: string;
    amountCents: number;
    notes: string;
  }[];
  lines?: {
    description: string;
    amountCents: number;
    categoryName: string | null;
    ignored: boolean;
  }[];
};

async function readImage(formData: FormData): Promise<{
  bytes: Buffer;
  mimeType: string;
} | null> {
  const file = formData.get("bill");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Image too large (max 12 MB)");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  return { bytes: buf, mimeType: file.type || "image/jpeg" };
}

function mapImportResult(
  result: Awaited<ReturnType<typeof scanBillForImport>>,
): BillImportActionState {
  if (result.status === "error") {
    return {
      ok: false,
      error: result.errorText ?? "Scan failed",
      scanId: result.scanId,
      phase: "upload",
    };
  }
  const needsMapping = result.status === "needs_mapping" || !result.transactionId;
  return {
    ok: true,
    phase: needsMapping ? "mapping" : "preview",
    scanId: result.scanId,
    merchant: result.merchant,
    receiptDate: result.receiptDate,
    receiptTotalCents: result.receiptTotalCents,
    transactionId: result.transactionId,
    needsMapping,
    candidates: result.candidates,
    nearby: result.nearby,
    proposedSplits: result.proposedSplits,
    lines: result.lines.map((l) => ({
      description: l.description,
      amountCents: l.amountCents,
      categoryName: l.categoryName,
      ignored: l.ignored,
    })),
  };
}

/** Main Import bill: upload photo → Gemini → match by date+amount. */
export async function importBillScanAction(
  _prev: BillImportActionState,
  formData: FormData,
): Promise<BillImportActionState> {
  try {
    const { budget } = await requireBudgetAccess();
    await ensureYngsbCategories(prisma, budget.id);
    await seedDefaultReceiptRules(prisma, budget.id);

    const image = await readImage(formData);
    if (!image) return { ok: false, error: "Choose a bill photo", phase: "upload" };

    const result = await scanBillForImport({
      prisma,
      budgetId: budget.id,
      currency: budget.currency,
      imageBytes: image.bytes,
      mimeType: image.mimeType,
    });
    return mapImportResult(result);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Scan failed",
      phase: "upload",
    };
  }
}

/** User picks a bank transaction when auto-match failed or was ambiguous. */
export async function importBillMapAction(
  _prev: BillImportActionState,
  formData: FormData,
): Promise<BillImportActionState> {
  try {
    const { budget } = await requireBudgetAccess();
    const scanId = String(formData.get("scanId") ?? "");
    const transactionId = String(formData.get("transactionId") ?? "");
    if (!scanId || !transactionId) {
      return { ok: false, error: "Pick a transaction", phase: "mapping", scanId };
    }

    const result = await bindBillScanToTransaction({
      prisma,
      budgetId: budget.id,
      scanId,
      transactionId,
    });
    return mapImportResult({ ...result, status: "ok" });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Mapping failed",
      phase: "mapping",
    };
  }
}

/** Apply splits after Import bill preview. */
export async function importBillConfirmAction(
  _prev: BillImportActionState,
  formData: FormData,
): Promise<BillImportActionState> {
  try {
    const { budget } = await requireBudgetAccess();
    const transactionId = String(formData.get("transactionId") ?? "");
    const scanId = String(formData.get("scanId") ?? "");
    if (!transactionId || !scanId) {
      return { ok: false, error: "Missing scan", phase: "preview" };
    }

    // Reuse confirm path via form-shaped call
    const confirmFd = new FormData();
    confirmFd.set("transactionId", transactionId);
    confirmFd.set("scanId", scanId);
    const confirmed = await confirmReceiptDetail(
      { ok: false },
      confirmFd,
    );
    if (!confirmed.ok) {
      return {
        ok: false,
        error: confirmed.error,
        phase: "preview",
        scanId,
        transactionId,
      };
    }
    revalidatePath("/more/import-bill");
    return {
      ok: true,
      phase: "done",
      scanId,
      transactionId,
      proposedSplits: confirmed.proposedSplits,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Apply failed",
      phase: "preview",
    };
  }
}

export async function previewReceiptDetail(
  _prev: ReceiptDetailActionState,
  formData: FormData,
): Promise<ReceiptDetailActionState> {
  try {
    const { budget } = await requireBudgetAccess();
    await ensureYngsbCategories(prisma, budget.id);
    await seedDefaultReceiptRules(prisma, budget.id);

    const transactionId = String(formData.get("transactionId") ?? "");
    if (!transactionId) return { ok: false, error: "Missing transaction" };

    const image = await readImage(formData);
    if (!image) return { ok: false, error: "Choose a bill photo" };

    const result = await processReceiptDetailing({
      prisma,
      budgetId: budget.id,
      currency: budget.currency,
      transactionId,
      imageBytes: image.bytes,
      mimeType: image.mimeType,
      confirm: false,
    });

    if (result.status === "error") {
      return { ok: false, error: result.errorText ?? "Scan failed", scanId: result.scanId };
    }

    return {
      ok: true,
      scanId: result.scanId,
      proposedSplits: result.proposedSplits,
      lines: result.lines.map((l) => ({
        description: l.description,
        amountCents: l.amountCents,
        categoryName: l.categoryName,
        ignored: l.ignored,
      })),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Scan failed",
    };
  }
}

export async function confirmReceiptDetail(
  _prev: ReceiptDetailActionState,
  formData: FormData,
): Promise<ReceiptDetailActionState> {
  try {
    const { budget } = await requireBudgetAccess();
    const transactionId = String(formData.get("transactionId") ?? "");
    const scanId = String(formData.get("scanId") ?? "");
    if (!transactionId || !scanId) {
      return { ok: false, error: "Missing scan" };
    }

    const scan = await prisma.receiptScan.findFirst({
      where: { id: scanId, budgetId: budget.id, transactionId },
      include: { lines: true },
    });
    if (!scan || !scan.rawJson) {
      return { ok: false, error: "Preview scan not found — upload again" };
    }

    // Re-run apply using stored lines + current rules via image re-process if image exists,
    // else rebuild splits from stored lines.
    const { applyReceiptSplits, aggregateProposedSplits, mapReceiptLines } =
      await import("@/lib/receipt-ai");

    const categories = await prisma.category.findMany({
      where: { group: { budgetId: budget.id }, hidden: false },
      select: { id: true, name: true },
    });
    const categoriesByName = new Map(
      categories.map((c) => [c.name, { id: c.id, name: c.name }]),
    );
    const unknown = categoriesByName.get("Unknown") ?? null;
    const rules = await prisma.receiptCategoryRule.findMany({
      where: { budgetId: budget.id },
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

    const txn = await prisma.transaction.findFirst({
      where: { id: transactionId, account: { budgetId: budget.id } },
    });
    if (!txn) return { ok: false, error: "Transaction not found" };

    const proposedSplits = aggregateProposedSplits(
      mapped,
      Math.abs(txn.amount),
    );
    if (proposedSplits.length < 1) {
      return { ok: false, error: "Nothing to apply" };
    }

    const { childIdsByCategory } = await applyReceiptSplits({
      prisma,
      transactionId,
      budgetId: budget.id,
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
        await prisma.receiptScanLine.update({
          where: { id: line.id },
          data: { childTransactionId: childId },
        });
      }
    }

    await prisma.receiptScan.update({
      where: { id: scan.id },
      data: { status: "ok" },
    });

    revalidatePath("/plan");
    revalidatePath("/reflect");
    revalidatePath("/transactions");
    revalidatePath(`/transactions/${transactionId}`);
    revalidatePath(`/accounts/${txn.accountId}`);

    return {
      ok: true,
      scanId,
      proposedSplits,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Apply failed",
    };
  }
}

export async function createReceiptRuleAction(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const matchText = String(formData.get("matchText") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const ignore = formData.get("ignore") === "1";
  if (matchText.length < 2) return;

  const max = await prisma.receiptCategoryRule.aggregate({
    where: { budgetId: budget.id },
    _max: { sortOrder: true },
  });
  await prisma.receiptCategoryRule.create({
    data: {
      budgetId: budget.id,
      matchText,
      categoryId: ignore ? null : categoryId,
      ignore,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/more/receipt-rules");
}

export async function updateReceiptRule(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "");
  const matchText = String(formData.get("matchText") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const ignore = formData.get("ignore") === "1";
  const rule = await prisma.receiptCategoryRule.findFirst({
    where: { id, budgetId: budget.id },
  });
  if (!rule || matchText.length < 2) return;
  await prisma.receiptCategoryRule.update({
    where: { id },
    data: {
      matchText,
      categoryId: ignore ? null : categoryId,
      ignore,
    },
  });
  revalidatePath("/more/receipt-rules");
}

export async function deleteReceiptRule(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "");
  await prisma.receiptCategoryRule.deleteMany({
    where: { id, budgetId: budget.id },
  });
  revalidatePath("/more/receipt-rules");
}

export async function moveReceiptRule(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? "");
  const rules = await prisma.receiptCategoryRule.findMany({
    where: { budgetId: budget.id },
    orderBy: { sortOrder: "asc" },
  });
  const idx = rules.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const swapWith = dir === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= rules.length) return;
  const a = rules[idx];
  const b = rules[swapWith];
  await prisma.$transaction([
    prisma.receiptCategoryRule.update({
      where: { id: a.id },
      data: { sortOrder: b.sortOrder },
    }),
    prisma.receiptCategoryRule.update({
      where: { id: b.id },
      data: { sortOrder: a.sortOrder },
    }),
  ]);
  revalidatePath("/more/receipt-rules");
}
