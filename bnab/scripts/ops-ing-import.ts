/**
 * Ops: confirm an ING CSV into a FinanceAccount (fingerprint skip + transfer twins).
 *
 * Usage (on server or local with DATABASE_URL):
 *   npx tsx scripts/ops-ing-import.ts --account "Tinel" --csv /path/to.csv --label "Tranzactii_22-11-2026"
 *   npx tsx scripts/ops-ing-import.ts --list-accounts
 *
 * Dry-run (no writes):
 *   npx tsx scripts/ops-ing-import.ts --account "Tinel" --csv file.csv --dry-run
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { applyRules, parseIngCsv } from "../src/lib/ing-import/parse";
import { classifyIngRowAgainstLedger } from "../src/lib/ing-import/overlap";
import {
  ensureYngsbCategories,
  seedDefaultImportRules,
} from "../src/lib/starter-categories";
import { clearEngineMonthTips } from "../src/lib/engine-month-tip";

const prisma = new PrismaClient();

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function listAccounts() {
  const budgets = await prisma.budget.findMany({
    include: {
      accounts: {
        where: { closed: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true, type: true },
      },
    },
  });
  for (const b of budgets) {
    console.log(`Budget ${b.name} (${b.id})`);
    for (const a of b.accounts) {
      console.log(`  ${a.name}\t${a.type}\t${a.id}`);
    }
  }
}

async function main() {
  if (hasFlag("--list-accounts")) {
    await listAccounts();
    return;
  }

  const accountNeedle = arg("--account");
  const csvPath = arg("--csv");
  const label = (arg("--label") ?? csvPath?.split(/[/\\]/).pop() ?? "ops-import").slice(0, 200);
  const dryRun = hasFlag("--dry-run");

  if (!accountNeedle || !csvPath) {
    console.error(
      "Usage: npx tsx scripts/ops-ing-import.ts --account <name|id> --csv <path> [--label x] [--dry-run]",
    );
    process.exit(1);
  }

  const csv = readFileSync(csvPath, "utf8");
  const accounts = await prisma.financeAccount.findMany({
    where: { closed: false },
    include: { budget: true },
  });
  const account =
    accounts.find((a) => a.id === accountNeedle) ??
    accounts.find((a) => a.name.toLowerCase() === accountNeedle.toLowerCase()) ??
    accounts.find((a) =>
      a.name.toLowerCase().includes(accountNeedle.toLowerCase()),
    );
  if (!account) {
    console.error("Account not found. Use --list-accounts");
    process.exit(1);
  }

  const budgetId = account.budgetId;
  await ensureYngsbCategories(prisma, budgetId);
  await seedDefaultImportRules(prisma, budgetId);

  const rules = await prisma.importCategoryRule.findMany({
    where: { budgetId },
    orderBy: { sortOrder: "asc" },
  });
  const cats = await prisma.category.findMany({
    where: { group: { budgetId } },
    select: { id: true, name: true },
  });
  const nameById = new Map(cats.map((c) => [c.id, c.name]));

  const parsed = parseIngCsv(csv);
  const applied = applyRules(parsed, rules, account.id, nameById);
  const fps = applied.map((r) => r.fingerprint);
  const existing = await prisma.transaction.findMany({
    where: { accountId: account.id, importFingerprint: { in: fps } },
    select: { importFingerprint: true },
  });
  const existingSet = new Set(
    existing.map((e) => e.importFingerprint).filter(Boolean) as string[],
  );

  let wouldCreate = 0;
  let wouldSkip = 0;
  let wouldUnmatched = 0;
  for (const row of applied) {
    const { status } = classifyIngRowAgainstLedger(row, existingSet, []);
    if (status === "already_imported") wouldSkip += 1;
    else if (status === "unmatched") {
      wouldUnmatched += 1;
      wouldCreate += 1; // still create uncategorized
    } else wouldCreate += 1;
  }

  console.log(
    JSON.stringify(
      {
        account: account.name,
        accountId: account.id,
        budget: account.budget.name,
        label,
        parsed: parsed.length,
        wouldCreate,
        wouldSkip,
        wouldUnmatched,
        dryRun,
      },
      null,
      2,
    ),
  );

  if (dryRun) return;

  const batch = await prisma.importBatch.create({
    data: {
      budgetId,
      accountId: account.id,
      sourceLabel: label,
      createdById: null,
    },
  });

  let created = 0;
  let skipped = 0;
  let linked = 0;
  const batchItems: Array<{
    batchId: string;
    action: string;
    transactionId?: string;
    fingerprint: string;
    memoPreview: string;
    importRuleId?: string | null;
  }> = [];

  await prisma.$transaction(
    async (tx) => {
      for (const row of applied) {
        const memoPreview = row.memo.slice(0, 120);
        if (existingSet.has(row.fingerprint)) {
          skipped += 1;
          batchItems.push({
            batchId: batch.id,
            action: "skipped_duplicate",
            fingerprint: row.fingerprint,
            memoPreview,
          });
          continue;
        }

        if (row.transferAccountId && row.transferAccountId !== account.id) {
          const to = await tx.financeAccount.findFirst({
            where: { id: row.transferAccountId, budgetId },
          });
          if (!to || to.id === account.id) {
            skipped += 1;
            batchItems.push({
              batchId: batch.id,
              action: "skipped_duplicate",
              fingerprint: row.fingerprint,
              memoPreview,
            });
            continue;
          }
          const txn = await tx.transaction.create({
            data: {
              accountId: account.id,
              date: row.date,
              amount: row.amount,
              categoryId: row.ignored ? null : row.categoryId,
              notes: row.memo,
              cleared: true,
              importFingerprint: row.fingerprint,
              importContentHash: row.contentHash,
              importBatchId: batch.id,
            },
          });
          const twin = await tx.transaction.create({
            data: {
              accountId: to.id,
              date: row.date,
              amount: -row.amount,
              notes: row.memo,
              cleared: true,
              transferTwinId: txn.id,
              importBatchId: batch.id,
            },
          });
          await tx.transaction.update({
            where: { id: txn.id },
            data: { transferTwinId: twin.id },
          });
          existingSet.add(row.fingerprint);
          created += 2;
          batchItems.push({
            batchId: batch.id,
            action: "created",
            transactionId: txn.id,
            fingerprint: row.fingerprint,
            memoPreview,
            importRuleId: row.matchedRuleId,
          });
          batchItems.push({
            batchId: batch.id,
            action: "created_transfer_twin",
            transactionId: twin.id,
            fingerprint: row.fingerprint,
            memoPreview,
            importRuleId: row.matchedRuleId,
          });
          continue;
        }

        const txn = await tx.transaction.create({
          data: {
            accountId: account.id,
            date: row.date,
            amount: row.amount,
            categoryId: row.ignored ? null : row.categoryId,
            notes: row.memo,
            cleared: true,
            importFingerprint: row.fingerprint,
            importContentHash: row.contentHash,
            importBatchId: batch.id,
          },
        });
        existingSet.add(row.fingerprint);
        created += 1;
        batchItems.push({
          batchId: batch.id,
          action: "created",
          transactionId: txn.id,
          fingerprint: row.fingerprint,
          memoPreview,
          importRuleId: row.matchedRuleId,
        });
      }

      if (batchItems.length) {
        await tx.importBatchItem.createMany({ data: batchItems });
      }
      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          statsJson: JSON.stringify({ created, skipped, linked, ignored: 0 }),
        },
      });
    },
    { timeout: 600_000 },
  );

  await clearEngineMonthTips(budgetId);
  console.log(
    JSON.stringify({ ok: true, batchId: batch.id, created, skipped }, null, 2),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
