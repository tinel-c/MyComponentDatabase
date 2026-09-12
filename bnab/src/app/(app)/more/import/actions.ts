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
  memoMatchesImportRule,
  parseIngCsv,
  type AppliedRow,
} from "@/lib/ing-import/parse";
import { classifyIngRowAgainstLedger, planIngConfirmAction } from "@/lib/ing-import/overlap";
import { createDbSnapshot } from "@/lib/ing-import/snapshot";

export type PreviewRow = AppliedRow & {
  categoryName: string | null;
  transferAccountName: string | null;
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
  const accounts = await prisma.financeAccount.findMany({
    where: { budgetId: budget.id },
    select: { id: true, name: true },
  });
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));

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
    select: {
      id: true,
      date: true,
      amount: true,
      notes: true,
      payee: { select: { name: true } },
    },
  });

  const manualLedger = manuals.map((m) => ({
    id: m.id,
    date: m.date,
    amount: m.amount,
    notes: m.notes,
    payeeName: m.payee?.name ?? null,
  }));

  const rows: PreviewRow[] = appliedRows.map((r) => {
    const { status, manualMatchId } = classifyIngRowAgainstLedger(
      r,
      existingSet,
      manualLedger,
    );
    return {
      ...r,
      status,
      manualMatchId,
      categoryName: r.categoryId ? nameById.get(r.categoryId) ?? null : null,
      transferAccountName: r.transferAccountId
        ? accountNameById.get(r.transferAccountId) ?? null
        : null,
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

  const fps = applied.map((r) => r.fingerprint);
  const existingRows = await prisma.transaction.findMany({
    where: { accountId, importFingerprint: { in: fps } },
    select: { id: true, importFingerprint: true },
  });
  const existingByFp = new Map(
    existingRows
      .filter((e) => e.importFingerprint)
      .map((e) => [e.importFingerprint as string, e.id]),
  );

  const payeeNames = [
    ...new Set(
      applied
        .map((r) => r.payeeGuess?.trim())
        .filter((n): n is string => Boolean(n) && n !== "Unknown"),
    ),
  ];
  const existingPayees =
    payeeNames.length > 0
      ? await prisma.payee.findMany({
          where: { budgetId: budget.id, name: { in: payeeNames } },
          select: { id: true, name: true },
        })
      : [];
  const payeeIdByName = new Map(existingPayees.map((p) => [p.name, p.id]));

  const batchItems: {
    batchId: string;
    action: string;
    transactionId?: string | null;
    fingerprint: string;
    memoPreview: string;
  }[] = [];

  for (const row of applied) {
    const memoPreview = row.memo.slice(0, 160);

    const existingId = existingByFp.get(row.fingerprint) ?? null;
    const decision = decisionByFp.get(row.fingerprint);
    const plan = planIngConfirmAction({
      ignored: row.ignored,
      fingerprint: row.fingerprint,
      fingerprintAlreadyOnAccount: Boolean(existingId),
      decision,
    });

    if (plan.kind === "skip_duplicate") {
      skipped++;
      batchItems.push({
        batchId: batch.id,
        action: "skipped_duplicate",
        transactionId: existingId,
        fingerprint: row.fingerprint,
        memoPreview,
      });
      continue;
    }

    if (plan.kind === "skip_user") {
      skipped++;
      batchItems.push({
        batchId: batch.id,
        action: "skipped_duplicate",
        fingerprint: row.fingerprint,
        memoPreview,
      });
      continue;
    }

    if (plan.kind === "link") {
      await prisma.transaction.update({
        where: { id: plan.manualMatchId },
        data: {
          importFingerprint: row.fingerprint,
          importContentHash: row.contentHash,
          importBatchId: batch.id,
          cleared: true,
          date: row.date,
          // Keep bill splits; clear category when ignore rule matched the ING memo
          ...(row.ignored ? { categoryId: null } : {}),
        },
      });
      await prisma.transaction.updateMany({
        where: { parentId: plan.manualMatchId },
        data: { date: row.date, cleared: true },
      });
      existingByFp.set(row.fingerprint, plan.manualMatchId);
      linked++;
      if (row.ignored) ignored++;
      batchItems.push({
        batchId: batch.id,
        action: "linked_manual",
        transactionId: plan.manualMatchId,
        fingerprint: row.fingerprint,
        memoPreview,
      });
      continue;
    }

    if (plan.kind === "replace_then_create") {
      await prisma.transaction.delete({ where: { id: plan.manualMatchId } });
    }

    let payeeId: string | null = null;
    const isTransfer = Boolean(row.transferAccountId);
    if (!isTransfer) {
      const payeeName = row.payeeGuess?.trim();
      if (payeeName && payeeName !== "Unknown") {
        let id = payeeIdByName.get(payeeName);
        if (!id) {
          const payee = await prisma.payee.create({
            data: {
              budgetId: budget.id,
              name: payeeName,
              lastCategoryId: row.ignored ? null : row.categoryId,
            },
          });
          id = payee.id;
          payeeIdByName.set(payeeName, id);
        } else if (row.categoryId && !row.ignored) {
          await prisma.payee.update({
            where: { id },
            data: { lastCategoryId: row.categoryId },
          });
        }
        payeeId = id;
      }
    }

    if (isTransfer && row.transferAccountId) {
      const to = await prisma.financeAccount.findFirst({
        where: { id: row.transferAccountId, budgetId: budget.id },
      });
      if (!to || to.id === accountId) {
        skipped++;
        batchItems.push({
          batchId: batch.id,
          action: "skipped_duplicate",
          fingerprint: row.fingerprint,
          memoPreview,
        });
        continue;
      }

      // Statement account keeps CSV sign; twin gets the opposite (out ↔ in pair).
      const txn = await prisma.transaction.create({
        data: {
          accountId,
          date: row.date,
          amount: row.amount,
          payeeId: null,
          categoryId: null,
          notes: row.memo,
          cleared: true,
          importFingerprint: row.fingerprint,
          importContentHash: row.contentHash,
          importBatchId: batch.id,
        },
      });
      const twin = await prisma.transaction.create({
        data: {
          accountId: to.id,
          date: row.date,
          amount: -row.amount,
          payeeId: null,
          categoryId: null,
          notes: row.memo,
          cleared: true,
          transferTwinId: txn.id,
          importBatchId: batch.id,
        },
      });
      await prisma.transaction.update({
        where: { id: txn.id },
        data: { transferTwinId: twin.id },
      });
      existingByFp.set(row.fingerprint, txn.id);
      created++;
      batchItems.push({
        batchId: batch.id,
        action: "created",
        transactionId: txn.id,
        fingerprint: row.fingerprint,
        memoPreview,
      });
      batchItems.push({
        batchId: batch.id,
        action: "created_transfer_twin",
        transactionId: twin.id,
        fingerprint: row.fingerprint,
        memoPreview,
      });
      continue;
    }

    const txn = await prisma.transaction.create({
      data: {
        accountId,
        date: row.date,
        amount: row.amount,
        payeeId,
        categoryId: row.ignored ? null : row.categoryId,
        notes: row.memo,
        cleared: true,
        importFingerprint: row.fingerprint,
        importContentHash: row.contentHash,
        importBatchId: batch.id,
      },
    });
    existingByFp.set(row.fingerprint, txn.id);
    created++;
    if (row.ignored) ignored++;
    batchItems.push({
      batchId: batch.id,
      action: "created",
      transactionId: txn.id,
      fingerprint: row.fingerprint,
      memoPreview,
    });
  }

  if (batchItems.length > 0) {
    await prisma.importBatchItem.createMany({ data: batchItems });
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
  const transferAccountId =
    String(formData.get("transferAccountId") ?? "") || null;
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

  let mode: "ignore" | "transfer" | "category";
  if (ignore) {
    mode = "ignore";
  } else if (transferAccountId) {
    mode = "transfer";
  } else if (categoryId) {
    mode = "category";
  } else {
    return {
      ok: false as const,
      error: "Pick a category, a transfer account, or enable Ignore",
    };
  }

  if (mode === "category" && categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, group: { budgetId: budget.id } },
    });
    if (!cat) return { ok: false as const, error: "Category not found" };
  }

  if (mode === "transfer" && transferAccountId) {
    const acct = await prisma.financeAccount.findFirst({
      where: { id: transferAccountId, budgetId: budget.id },
    });
    if (!acct) return { ok: false as const, error: "Transfer account not found" };
  }

  const max = await prisma.importCategoryRule.aggregate({
    where: { budgetId: budget.id },
    _max: { sortOrder: true },
  });

  await prisma.importCategoryRule.create({
    data: {
      budgetId: budget.id,
      matchText,
      ignore: mode === "ignore",
      categoryId: mode === "category" ? categoryId : null,
      transferAccountId: mode === "transfer" ? transferAccountId : null,
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
  const transferAccountId =
    String(formData.get("transferAccountId") ?? "") || null;
  const ignore = formData.get("ignore") === "1" || formData.get("ignore") === "on";
  const rule = await prisma.importCategoryRule.findFirst({
    where: { id, budgetId: budget.id },
  });
  if (!rule || matchText.length < 3) return;

  let mode: "ignore" | "transfer" | "category" | null = null;
  if (ignore) mode = "ignore";
  else if (transferAccountId) mode = "transfer";
  else if (categoryId) mode = "category";
  if (!mode) return;

  if (mode === "transfer") {
    const acct = await prisma.financeAccount.findFirst({
      where: { id: transferAccountId!, budgetId: budget.id },
    });
    if (!acct) return;
  }
  if (mode === "category") {
    const cat = await prisma.category.findFirst({
      where: { id: categoryId!, group: { budgetId: budget.id } },
    });
    if (!cat) return;
  }

  await prisma.importCategoryRule.update({
    where: { id },
    data: {
      matchText,
      ignore: mode === "ignore",
      categoryId: mode === "category" ? categoryId : null,
      transferAccountId: mode === "transfer" ? transferAccountId : null,
    },
  });
  revalidatePath("/more/import-rules");
  revalidatePath("/more/import");
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
    .filter(
      (i) =>
        (i.action === "created" || i.action === "created_transfer_twin") &&
        i.transactionId,
    )
    .map((i) => i.transactionId!);

  if (createdIds.length) {
    const twins = await prisma.transaction.findMany({
      where: { id: { in: createdIds } },
      select: { id: true, transferTwinId: true },
    });
    const twinIds = twins
      .map((t) => t.transferTwinId)
      .filter(
        (id): id is string =>
          typeof id === "string" && !createdIds.includes(id),
      );
    const allIds = [...new Set([...createdIds, ...twinIds])];
    // Clear twin links first so either side can delete cleanly.
    await prisma.transaction.updateMany({
      where: { id: { in: allIds } },
      data: { transferTwinId: null },
    });
    await prisma.transaction.deleteMany({
      where: { id: { in: allIds } },
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
      notes: { not: null },
    },
  });

  for (const txn of txns) {
    if (txn.transferTwinId) continue;
    const memo = txn.notes ?? "";
    for (const rule of rules) {
      if (!memoMatchesImportRule(memo, rule.matchText)) continue;
      if (rule.transferAccountId) {
        // Transfer pairs are created at import time; don't rewrite existing rows.
        break;
      }
      if (rule.ignore) {
        if (txn.categoryId) {
          await prisma.transaction.update({
            where: { id: txn.id },
            data: { categoryId: null },
          });
        }
        break;
      }
      if (rule.categoryId && txn.categoryId !== rule.categoryId) {
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
