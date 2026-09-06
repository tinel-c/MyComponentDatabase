"use server";

import { revalidatePath } from "next/cache";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  ensureYngsbCategories,
  seedDefaultImportRules,
} from "@/lib/starter-categories";
import {
  applyRules,
  findManualMatch,
  parseIngCsv,
  type AppliedRow,
} from "@/lib/ing-import/parse";
import { createDbSnapshot } from "@/lib/ing-import/snapshot";

export type PreviewRow = AppliedRow & {
  categoryName: string | null;
};

export type PreviewResult = {
  ok: true;
  rows: PreviewRow[];
  stats: {
    total: number;
    new: number;
    already: number;
    ignored: number;
    unmatched: number;
    manual: number;
  };
} | { ok: false; error: string };

async function loadRules(budgetId: string) {
  await ensureYngsbCategories(prisma, budgetId);
  await seedDefaultImportRules(prisma, budgetId);
  return prisma.importCategoryRule.findMany({
    where: { budgetId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function ensureImportSetup() {
  const { budget } = await requireBudgetAccess();
  await ensureYngsbCategories(prisma, budget.id);
  await seedDefaultImportRules(prisma, budget.id);
  return { ok: true as const };
}

export async function previewIngImport(formData: FormData): Promise<PreviewResult> {
  const { budget } = await requireBudgetAccess();
  const accountId = String(formData.get("accountId") ?? "");
  const csv = String(formData.get("csv") ?? "");
  const account = await prisma.financeAccount.findFirst({
    where: { id: accountId, budgetId: budget.id },
  });
  if (!account) return { ok: false, error: "Account not found" };
  if (!csv.trim()) return { ok: false, error: "Paste or upload an ING CSV" };

  const rules = await loadRules(budget.id);
  const cats = await prisma.category.findMany({
    where: { group: { budgetId: budget.id } },
    select: { id: true, name: true },
  });
  const nameById = new Map(cats.map((c) => [c.id, c.name]));

  const parsed = parseIngCsv(csv);
  if (parsed.length === 0) {
    return { ok: false, error: "No transactions found in CSV" };
  }

  const appliedRows = applyRules(parsed, rules, accountId, nameById);

  const fps = appliedRows.map((r) => r.fingerprint);
  const existing = await prisma.transaction.findMany({
    where: {
      accountId,
      importFingerprint: { in: fps },
    },
    select: { importFingerprint: true },
  });
  const existingSet = new Set(
    existing.map((e) => e.importFingerprint).filter(Boolean) as string[],
  );

  const manuals = await prisma.transaction.findMany({
    where: {
      accountId,
      importFingerprint: null,
      isChild: false,
    },
    select: { id: true, date: true, amount: true, notes: true },
  });

  const rows: PreviewRow[] = appliedRows.map((r) => {
    let status: AppliedRow["status"] = "new";
    let manualMatchId: string | null = null;
    if (r.ignored) {
      status = "ignored";
    } else if (existingSet.has(r.fingerprint)) {
      status = "already_imported";
    } else {
      manualMatchId = findManualMatch(r, manuals);
      if (manualMatchId) status = "possible_manual_match";
      else if (!r.categoryId) status = "unmatched";
      else status = "new";
    }
    return {
      ...r,
      status,
      manualMatchId,
      categoryName: r.categoryId ? nameById.get(r.categoryId) ?? null : null,
    };
  });

  const stats = {
    total: rows.length,
    new: rows.filter((r) => r.status === "new").length,
    already: rows.filter((r) => r.status === "already_imported").length,
    ignored: rows.filter((r) => r.status === "ignored").length,
    unmatched: rows.filter((r) => r.status === "unmatched").length,
    manual: rows.filter((r) => r.status === "possible_manual_match").length,
  };

  return { ok: true, rows, stats };
}

export type ConfirmDecision = {
  fingerprint: string;
  action: "import" | "skip" | "link" | "replace" | "import_anyway";
  manualMatchId?: string | null;
};

export async function confirmIngImport(formData: FormData): Promise<
  { ok: true; batchId: string; created: number } | { ok: false; error: string }
> {
  const { budget, session } = await requireBudgetAccess();
  const accountId = String(formData.get("accountId") ?? "");
  const csv = String(formData.get("csv") ?? "");
  const sourceLabel = String(formData.get("sourceLabel") ?? "paste").slice(0, 200);
  const decisionsRaw = String(formData.get("decisions") ?? "[]");

  const account = await prisma.financeAccount.findFirst({
    where: { id: accountId, budgetId: budget.id },
  });
  if (!account) return { ok: false, error: "Account not found" };

  let decisions: ConfirmDecision[] = [];
  try {
    decisions = JSON.parse(decisionsRaw) as ConfirmDecision[];
  } catch {
    return { ok: false, error: "Invalid decisions payload" };
  }
  const decisionByFp = new Map(decisions.map((d) => [d.fingerprint, d]));

  const rules = await loadRules(budget.id);
  const cats = await prisma.category.findMany({
    where: { group: { budgetId: budget.id } },
    select: { id: true, name: true },
  });
  const nameById = new Map(cats.map((c) => [c.id, c.name]));
  const parsed = parseIngCsv(csv);
  const applied = applyRules(parsed, rules, accountId, nameById);

  const batch = await prisma.importBatch.create({
    data: {
      budgetId: budget.id,
      accountId,
      sourceLabel,
      createdById: session.user?.id ?? null,
    },
  });

  let snapshotPath: string | null = null;
  try {
    const snap = createDbSnapshot(batch.id);
    snapshotPath = snap.relativePath;
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { snapshotPath },
    });
  } catch (e) {
    await prisma.importBatch.delete({ where: { id: batch.id } });
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Snapshot failed: ${e.message}`
          : "Snapshot failed — import aborted",
    };
  }

  let created = 0;
  let skipped = 0;
  let linked = 0;
  let ignored = 0;

  for (const row of applied) {
    if (row.ignored) {
      ignored++;
      await prisma.importBatchItem.create({
        data: {
          batchId: batch.id,
          action: "ignored",
          fingerprint: row.fingerprint,
          memoPreview: row.memo.slice(0, 160),
        },
      });
      continue;
    }

    const existing = await prisma.transaction.findFirst({
      where: { accountId, importFingerprint: row.fingerprint },
    });
    if (existing) {
      skipped++;
      await prisma.importBatchItem.create({
        data: {
          batchId: batch.id,
          action: "skipped_duplicate",
          transactionId: existing.id,
          fingerprint: row.fingerprint,
          memoPreview: row.memo.slice(0, 160),
        },
      });
      continue;
    }

    const decision = decisionByFp.get(row.fingerprint);
    const action = decision?.action ?? "import";

    if (action === "skip") {
      skipped++;
      await prisma.importBatchItem.create({
        data: {
          batchId: batch.id,
          action: "skipped_duplicate",
          fingerprint: row.fingerprint,
          memoPreview: row.memo.slice(0, 160),
        },
      });
      continue;
    }

    if (action === "link" && decision?.manualMatchId) {
      await prisma.transaction.update({
        where: { id: decision.manualMatchId },
        data: {
          importFingerprint: row.fingerprint,
          importContentHash: row.contentHash,
          importBatchId: batch.id,
        },
      });
      linked++;
      await prisma.importBatchItem.create({
        data: {
          batchId: batch.id,
          action: "linked_manual",
          transactionId: decision.manualMatchId,
          fingerprint: row.fingerprint,
          memoPreview: row.memo.slice(0, 160),
        },
      });
      continue;
    }

    if (action === "replace" && decision?.manualMatchId) {
      await prisma.transaction.delete({ where: { id: decision.manualMatchId } });
    }

    // import / import_anyway / replace
    let payeeId: string | null = null;
    const payeeName = row.payeeGuess?.trim();
    if (payeeName && payeeName !== "Unknown") {
      const payee = await prisma.payee.upsert({
        where: {
          budgetId_name: { budgetId: budget.id, name: payeeName },
        },
        create: {
          budgetId: budget.id,
          name: payeeName,
          lastCategoryId: row.categoryId,
        },
        update: row.categoryId ? { lastCategoryId: row.categoryId } : {},
      });
      payeeId = payee.id;
    }

    const txn = await prisma.transaction.create({
      data: {
        accountId,
        date: row.date,
        amount: row.amount,
        payeeId,
        categoryId: row.categoryId,
        notes: row.memo,
        cleared: true,
        importFingerprint: row.fingerprint,
        importContentHash: row.contentHash,
        importBatchId: batch.id,
      },
    });
    created++;
    await prisma.importBatchItem.create({
      data: {
        batchId: batch.id,
        action: "created",
        transactionId: txn.id,
        fingerprint: row.fingerprint,
        memoPreview: row.memo.slice(0, 160),
      },
    });
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      statsJson: JSON.stringify({ created, skipped, linked, ignored }),
    },
  });

  revalidatePath("/more/import");
  revalidatePath("/more/import-history");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/plan");
  return { ok: true, batchId: batch.id, created };
}

export async function createImportRuleFromForm(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const matchText = String(formData.get("matchText") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const ignore = formData.get("ignore") === "1" || formData.get("ignore") === "on";

  if (matchText.length < 3) {
    return { ok: false as const, error: "Match text must be at least 3 characters" };
  }

  const dup = await prisma.importCategoryRule.findFirst({
    where: { budgetId: budget.id, matchText },
  });
  if (dup) {
    return { ok: false as const, error: "A rule with this match text already exists" };
  }

  if (!ignore && categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, group: { budgetId: budget.id } },
    });
    if (!cat) return { ok: false as const, error: "Category not found" };
  }

  const max = await prisma.importCategoryRule.aggregate({
    where: { budgetId: budget.id },
    _max: { sortOrder: true },
  });

  await prisma.importCategoryRule.create({
    data: {
      budgetId: budget.id,
      matchText,
      categoryId: ignore ? null : categoryId,
      ignore,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/more/import-rules");
  revalidatePath("/more/import");
  revalidatePath("/more/import-history");
  return { ok: true as const };
}

/** Form-action wrapper (void return). */
export async function createImportRuleAction(formData: FormData) {
  await createImportRuleFromForm(formData);
}

export async function updateImportRule(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "");
  const matchText = String(formData.get("matchText") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const ignore = formData.get("ignore") === "1" || formData.get("ignore") === "on";
  const rule = await prisma.importCategoryRule.findFirst({
    where: { id, budgetId: budget.id },
  });
  if (!rule || matchText.length < 3) return;

  await prisma.importCategoryRule.update({
    where: { id },
    data: {
      matchText,
      categoryId: ignore ? null : categoryId,
      ignore,
    },
  });
  revalidatePath("/more/import-rules");
}

export async function deleteImportRule(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "");
  const rule = await prisma.importCategoryRule.findFirst({
    where: { id, budgetId: budget.id },
  });
  if (!rule) return;
  await prisma.importCategoryRule.delete({ where: { id } });
  revalidatePath("/more/import-rules");
}

export async function moveImportRule(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? "");
  const rules = await prisma.importCategoryRule.findMany({
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
    prisma.importCategoryRule.update({
      where: { id: a.id },
      data: { sortOrder: b.sortOrder },
    }),
    prisma.importCategoryRule.update({
      where: { id: b.id },
      data: { sortOrder: a.sortOrder },
    }),
  ]);
  revalidatePath("/more/import-rules");
}

export async function revertImportBatch(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const batchId = String(formData.get("batchId") ?? "");
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, budgetId: budget.id },
    include: { items: true },
  });
  if (!batch) return;

  const createdIds = batch.items
    .filter((i) => i.action === "created" && i.transactionId)
    .map((i) => i.transactionId!);

  if (createdIds.length) {
    await prisma.transaction.deleteMany({
      where: { id: { in: createdIds }, accountId: batch.accountId },
    });
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      statsJson: JSON.stringify({
        ...(batch.statsJson ? JSON.parse(batch.statsJson) : {}),
        reverted: true,
        revertedAt: new Date().toISOString(),
      }),
    },
  });

  revalidatePath("/more/import-history");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/plan");
}

export async function reapplyRulesToBatch(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const batchId = String(formData.get("batchId") ?? "");
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, budgetId: budget.id },
  });
  if (!batch) return;

  const rules = await loadRules(budget.id);
  const txns = await prisma.transaction.findMany({
    where: {
      importBatchId: batchId,
      categoryId: null,
      notes: { not: null },
    },
  });

  for (const txn of txns) {
    const memo = txn.notes ?? "";
    for (const rule of rules) {
      if (!memo.includes(rule.matchText)) continue;
      if (rule.ignore) break;
      if (rule.categoryId) {
        await prisma.transaction.update({
          where: { id: txn.id },
          data: { categoryId: rule.categoryId },
        });
      }
      break;
    }
  }

  revalidatePath("/more/import-history");
  revalidatePath("/transactions");
  revalidatePath("/plan");
}
