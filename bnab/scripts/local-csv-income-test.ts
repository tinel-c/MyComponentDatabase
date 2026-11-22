/**
 * Local (no prod SSH) end-to-end check: import Downloads ING CSVs into a fresh
 * SQLite DB using prod-shaped accounts + import rules, then assert monthly
 * Paycheck / Other income in the DB matches CSV+rules.
 *
 * Usage (from bnab/):
 *   npx tsx scripts/local-csv-income-test.ts
 *   npx tsx scripts/local-csv-income-test.ts --csv-dir "C:/Users/tinel/Downloads"
 *
 * Env:
 *   BNAB_INCOME_TEST_DB  override DB path (default prisma/income-test.db)
 */
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { applyRules, parseIngCsv } from "../src/lib/ing-import/parse";
import {
  incomeForMonth,
  monthlyIncomeFromAppliedRows,
} from "../src/lib/ing-import/income-from-csv";
import { computeBudgetMonths } from "../src/lib/budget-engine/index";
import { seedStarterCategories } from "../src/lib/starter-categories";
import { clearEngineMonthTips } from "../src/lib/engine-month-tip";
import fixture from "../src/lib/ing-import/fixtures/prod-income-rules.json";

const DEFAULT_CSV_DIR = "C:/Users/tinel/Downloads";
const DEFAULT_CSVS = [
  "Tranzactii_22-11-2026_21-56-00.csv", // Constantin / Tinel
  "Tranzactii_22-11-2026_21-57-12.csv", // Monica
];
const ACCOUNT_BY_CSV: Record<string, string> = {
  "Tranzactii_22-11-2026_21-56-00.csv": "Tinel's account",
  "Tranzactii_22-11-2026_21-57-12.csv": "Monica's account",
};

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

function fmt(n: number): string {
  return (n / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resolveDbPath(): string {
  const override = process.env.BNAB_INCOME_TEST_DB;
  if (override) return resolve(override);
  return resolve(process.cwd(), "prisma", "income-test.db");
}

async function wipeAndOpen(dbPath: string): Promise<PrismaClient> {
  for (const p of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (existsSync(p)) unlinkSync(p);
  }
  process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`;
  // Prisma needs schema applied; use db push via child would be slow — assume
  // migrate already ran against this schema; create empty file then push.
  const { execSync } = await import("node:child_process");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    cwd: process.cwd(),
  });
  return new PrismaClient();
}

async function seedLocal(prisma: PrismaClient) {
  const admin = await prisma.user.upsert({
    where: { email: "local-income-test@example.com" },
    create: {
      email: "local-income-test@example.com",
      name: "Local Income Test",
      role: "ADMIN",
    },
    update: {},
  });

  const budget = await prisma.budget.create({
    data: {
      name: "Income Test Household",
      currency: "RON",
      firstMonth: "2025-11",
      members: { create: { userId: admin.id, role: "ADMIN" } },
    },
  });

  await seedStarterCategories(prisma, budget.id);

  let sort = 0;
  for (const a of fixture.accounts) {
    await prisma.financeAccount.create({
      data: {
        budgetId: budget.id,
        name: a.name,
        type: a.type as "CHECKING" | "SAVINGS" | "CASH" | "CREDIT",
        onBudget: true,
        sortOrder: sort++,
      },
    });
  }

  const accounts = await prisma.financeAccount.findMany({
    where: { budgetId: budget.id },
  });
  const accountIdByName = new Map(accounts.map((a) => [a.name, a.id]));

  const cats = await prisma.category.findMany({
    where: { group: { budgetId: budget.id } },
    select: { id: true, name: true },
  });
  const categoryIdByName = new Map(cats.map((c) => [c.name, c.id]));

  // Replace default import rules with prod-shaped fixture (income + ignore + transfers).
  await prisma.importCategoryRule.deleteMany({ where: { budgetId: budget.id } });
  for (const rule of fixture.rules) {
    const categoryId = rule.categoryName
      ? (categoryIdByName.get(rule.categoryName) ?? null)
      : null;
    // Skip spend rules whose category was not seeded (not needed for income assert).
    if (rule.categoryName && !categoryId && !rule.ignore && !rule.transferAccountName) {
      continue;
    }
    const transferAccountId = rule.transferAccountName
      ? (accountIdByName.get(rule.transferAccountName) ?? null)
      : null;
    if (rule.transferAccountName && !transferAccountId) continue;

    try {
      await prisma.importCategoryRule.create({
        data: {
          budgetId: budget.id,
          matchText: rule.matchText,
          ignore: rule.ignore,
          sortOrder: rule.sortOrder,
          categoryId,
          transferAccountId,
        },
      });
    } catch {
      // unique matchText collision — skip
    }
  }

  return { budgetId: budget.id, accountIdByName, categoryIdByName };
}

async function importCsv(
  prisma: PrismaClient,
  budgetId: string,
  accountId: string,
  csvPath: string,
  label: string,
) {
  const csv = readFileSync(csvPath, "utf8");
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
  const applied = applyRules(parsed, rules, accountId, nameById);

  const batch = await prisma.importBatch.create({
    data: { budgetId, accountId, sourceLabel: label },
  });

  let created = 0;
  const existing = new Set<string>();

  // Chunk writes — full year CSV is large.
  const CHUNK = 200;
  for (let i = 0; i < applied.length; i += CHUNK) {
    const slice = applied.slice(i, i + CHUNK);
    await prisma.$transaction(
      async (tx) => {
        for (const row of slice) {
          if (existing.has(row.fingerprint)) continue;
          if (row.transferAccountId && row.transferAccountId !== accountId) {
            const txn = await tx.transaction.create({
              data: {
                accountId,
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
                accountId: row.transferAccountId,
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
            existing.add(row.fingerprint);
            created += 2;
            continue;
          }
          await tx.transaction.create({
            data: {
              accountId,
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
          existing.add(row.fingerprint);
          created += 1;
        }
      },
      { timeout: 600_000 },
    );
  }

  await clearEngineMonthTips(budgetId);
  return { parsed: parsed.length, created };
}

function expectedIncomeFromCsvs(
  csvPaths: { path: string; accountId: string }[],
  rules: {
    id: string;
    matchText: string;
    ignore: boolean;
    sortOrder: number;
    categoryId: string | null;
    transferAccountId: string | null;
  }[],
  incomeIds: Set<string>,
  nameById: Map<string, string>,
) {
  const byMonth = new Map<string, Map<string, number>>();
  for (const { path, accountId } of csvPaths) {
    const parsed = parseIngCsv(readFileSync(path, "utf8"));
    const applied = applyRules(parsed, rules, accountId, nameById);
    for (const bucket of monthlyIncomeFromAppliedRows(applied, incomeIds)) {
      let cats = byMonth.get(bucket.month);
      if (!cats) {
        cats = new Map();
        byMonth.set(bucket.month, cats);
      }
      for (const [id, amount] of Object.entries(bucket.byCategoryId)) {
        cats.set(id, (cats.get(id) ?? 0) + amount);
      }
    }
  }
  return byMonth;
}

async function main() {
  const csvDir = arg("--csv-dir") ?? DEFAULT_CSV_DIR;
  const csvFiles = DEFAULT_CSVS.map((name) => ({
    name,
    path: resolve(csvDir, name),
    accountName: ACCOUNT_BY_CSV[name],
  }));
  for (const f of csvFiles) {
    if (!existsSync(f.path)) {
      console.error(`Missing CSV: ${f.path}`);
      process.exit(1);
    }
  }

  console.log("=== 1) Unit-style: CSV + fixture rules → Plan engine activity ===");
  // Synthetic IDs for pure in-memory path (no DB).
  const synPaycheck = "paycheck";
  const synOther = "other";
  const synIncome = new Set([synPaycheck, synOther]);
  const synNameById = new Map([
    [synPaycheck, "Paycheck"],
    [synOther, "Other income"],
  ]);
  const synRules = fixture.rules
    .filter(
      (r) =>
        r.ignore ||
        r.categoryName === "Paycheck" ||
        r.categoryName === "Other income" ||
        r.transferAccountName,
    )
    .map((r, i) => ({
      id: `r${i}`,
      matchText: r.matchText,
      ignore: r.ignore,
      sortOrder: r.sortOrder,
      categoryId:
        r.categoryName === "Paycheck"
          ? synPaycheck
          : r.categoryName === "Other income"
            ? synOther
            : null,
      transferAccountId: r.transferAccountName ? `xfer-${r.transferAccountName}` : null,
    }));

  const memBuckets = new Map<string, Map<string, number>>();
  for (const f of csvFiles) {
    const applied = applyRules(
      parseIngCsv(readFileSync(f.path, "utf8")),
      synRules,
      `acct-${f.accountName}`,
      synNameById,
    );
    for (const b of monthlyIncomeFromAppliedRows(applied, synIncome)) {
      let cats = memBuckets.get(b.month);
      if (!cats) {
        cats = new Map();
        memBuckets.set(b.month, cats);
      }
      for (const [id, amt] of Object.entries(b.byCategoryId)) {
        cats.set(id, (cats.get(id) ?? 0) + amt);
      }
    }
  }

  const engineTxns = [];
  let txI = 0;
  for (const f of csvFiles) {
    const applied = applyRules(
      parseIngCsv(readFileSync(f.path, "utf8")),
      synRules,
      `acct-${f.accountName}`,
      synNameById,
    );
    for (const row of applied) {
      if (row.ignored || !row.categoryId || !synIncome.has(row.categoryId)) continue;
      engineTxns.push({
        id: `t${txI++}`,
        accountId: `acct-${f.accountName}`,
        date: row.date,
        amount: row.amount,
        categoryId: row.categoryId,
        isParent: false,
        isChild: false,
        transferTwinId: row.transferAccountId ? `twin-${txI}` : null,
        isStartingBalance: false,
      });
    }
  }

  const months = [...memBuckets.keys()].sort();
  const plan = computeBudgetMonths({
    firstMonth: months[0] ?? "2025-11",
    endMonth: months[months.length - 1] ?? "2026-11",
    accounts: csvFiles.map((f) => ({
      id: `acct-${f.accountName}`,
      onBudget: true,
      type: "CHECKING",
      creditCategoryId: null,
    })),
    categories: [
      { id: synPaycheck, isIncome: true, isSystem: false, systemKey: null },
      { id: synOther, isIncome: true, isSystem: false, systemKey: null },
    ],
    transactions: engineTxns,
    assigned: [],
  });

  let memFail = 0;
  console.log(`${"month".padEnd(10)} ${"category".padEnd(14)} ${"CSV".padStart(14)} ${"Plan".padStart(14)}`);
  for (const month of months) {
    const planM = plan.find((m) => m.month === month);
    for (const [catId, catName] of [
      [synPaycheck, "Paycheck"],
      [synOther, "Other income"],
    ] as const) {
      const csvAmt = memBuckets.get(month)?.get(catId) ?? 0;
      const planAmt = planM?.categories[catId]?.activity ?? 0;
      if (csvAmt === 0 && planAmt === 0) continue;
      const ok = csvAmt === planAmt;
      if (!ok) memFail += 1;
      console.log(
        `${ok ? "  " : "!!"}${month.padEnd(8)} ${catName.padEnd(14)} ${fmt(csvAmt).padStart(14)} ${fmt(planAmt).padStart(14)}`,
      );
    }
  }
  if (memFail) {
    console.error(`In-memory Plan mismatch: ${memFail}`);
    process.exit(1);
  }
  console.log("In-memory CSV ↔ Plan activity: OK\n");

  console.log("=== 2) Local SQLite instance: import CSVs + compare DB ===");
  const dbPath = resolveDbPath();
  console.log(`DB: ${dbPath}`);
  const prisma = await wipeAndOpen(dbPath);
  try {
    const { budgetId, accountIdByName, categoryIdByName } =
      await seedLocal(prisma);

    for (const f of csvFiles) {
      const accountId = accountIdByName.get(f.accountName);
      if (!accountId) throw new Error(`Missing account ${f.accountName}`);
      console.log(`Importing ${f.name} → ${f.accountName}…`);
      const stats = await importCsv(
        prisma,
        budgetId,
        accountId,
        f.path,
        f.name,
      );
      console.log(`  parsed=${stats.parsed} created=${stats.created}`);
    }

    const paycheckId = categoryIdByName.get("Paycheck")!;
    const otherId = categoryIdByName.get("Other income")!;
    const incomeIds = new Set([paycheckId, otherId]);

    const rules = await prisma.importCategoryRule.findMany({
      where: { budgetId },
      orderBy: { sortOrder: "asc" },
    });
    const nameById = new Map(
      [...categoryIdByName.entries()].map(([n, id]) => [id, n]),
    );

    const expected = expectedIncomeFromCsvs(
      csvFiles.map((f) => ({
        path: f.path,
        accountId: accountIdByName.get(f.accountName)!,
      })),
      rules,
      incomeIds,
      nameById,
    );

    const siteRows = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        categoryId: { in: [...incomeIds] },
        isChild: false,
      },
      _sum: { amount: true },
      _count: true,
    });
    // groupBy doesn't give month — query raw-ish via findMany aggregate in JS
    const incomeTxns = await prisma.transaction.findMany({
      where: { categoryId: { in: [...incomeIds] }, isChild: false },
      select: { date: true, amount: true, categoryId: true },
    });
    const siteByMonth = new Map<string, Map<string, number>>();
    for (const t of incomeTxns) {
      const month = t.date.slice(0, 7);
      let cats = siteByMonth.get(month);
      if (!cats) {
        cats = new Map();
        siteByMonth.set(month, cats);
      }
      const id = t.categoryId!;
      cats.set(id, (cats.get(id) ?? 0) + t.amount);
    }

    const allMonths = [
      ...new Set([...expected.keys(), ...siteByMonth.keys()]),
    ].sort();

    console.log(
      `\n${"month".padEnd(10)} ${"category".padEnd(14)} ${"CSV".padStart(14)} ${"Local DB".padStart(14)} ${"delta".padStart(14)}`,
    );
    let fail = 0;
    for (const month of allMonths) {
      for (const [catId, catName] of [
        [paycheckId, "Paycheck"],
        [otherId, "Other income"],
      ] as const) {
        const csvAmt = expected.get(month)?.get(catId) ?? 0;
        const dbAmt = siteByMonth.get(month)?.get(catId) ?? 0;
        if (csvAmt === 0 && dbAmt === 0) continue;
        const delta = dbAmt - csvAmt;
        const ok = delta === 0;
        if (!ok) fail += 1;
        console.log(
          `${ok ? "  " : "!!"}${month.padEnd(8)} ${catName.padEnd(14)} ${fmt(csvAmt).padStart(14)} ${fmt(dbAmt).padStart(14)} ${fmt(delta).padStart(14)}`,
        );
      }
    }

    // Also spot-check Plan engine on local DB txns for one month with Paycheck
    const sampleMonth =
      allMonths.find((m) => (expected.get(m)?.get(paycheckId) ?? 0) > 0) ??
      allMonths[0];
    if (sampleMonth) {
      const bucket = incomeForMonth(
        [...expected.entries()].map(([month, cats]) => ({
          month,
          byCategoryId: Object.fromEntries(cats),
          total: [...cats.values()].reduce((a, b) => a + b, 0),
        })),
        sampleMonth,
      );
      const dbPay = siteByMonth.get(sampleMonth)?.get(paycheckId) ?? 0;
      console.log(
        `\nSample ${sampleMonth} Paycheck: CSV ${fmt(bucket.byCategoryId[paycheckId] ?? 0)} / DB ${fmt(dbPay)}`,
      );
    }

    console.log(`\nIncome txns in DB: ${incomeTxns.length}`);
    console.log(
      `Category totals (all months):`,
      siteRows.map((r) => ({
        cat: nameById.get(r.categoryId!),
        sum: fmt(r._sum.amount ?? 0),
        n: r._count,
      })),
    );

    if (fail) {
      console.error(`\nFAIL: ${fail} month/category mismatch(es) on local DB`);
      process.exit(2);
    }
    console.log("\nPASS: local DB income matches CSV+rules for every month.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
