/**
 * Compare Plan UI Income Activity + banner Spent (via loadPlanMonth)
 * against CSV+rules sums for every month in the local income-test DB.
 *
 * Usage (from bnab/):
 *   npx tsx scripts/local-plan-display-vs-csv.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dbPath = resolve(process.cwd(), "prisma", "income-test.db");
if (!existsSync(dbPath)) {
  console.error(
    "Missing prisma/income-test.db — run: npm run test:income-local",
  );
  process.exit(1);
}

process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`;

const CSV_DIR = "C:/Users/tinel/Downloads";
const CSVS = [
  {
    file: "Tranzactii_22-11-2026_21-56-00.csv",
    account: "Tinel's account",
  },
  {
    file: "Tranzactii_22-11-2026_21-57-12.csv",
    account: "Monica's account",
  },
];

function planAmount(minor: number): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { parseIngCsv, applyRules } = await import(
    "../src/lib/ing-import/parse"
  );
  const {
    monthlyIncomeFromAppliedRows,
    monthlySpendFromAppliedRows,
  } = await import("../src/lib/ing-import/income-from-csv");
  const { loadPlanMonth } = await import("../src/lib/plan-data");

  const prisma = new PrismaClient();
  try {
    const budget = await prisma.budget.findFirstOrThrow();
    const accounts = await prisma.financeAccount.findMany({
      where: { budgetId: budget.id },
    });
    const accountIdByName = new Map(accounts.map((a) => [a.name, a.id]));
    const allCats = await prisma.category.findMany({
      where: { group: { budgetId: budget.id } },
      select: { id: true, name: true, isIncome: true },
    });
    const paycheck = allCats.find((c) => c.name === "Paycheck");
    const other = allCats.find((c) => c.name === "Other income");
    if (!paycheck || !other) throw new Error("Missing income categories");

    const incomeIds = new Set(
      allCats.filter((c) => c.isIncome).map((c) => c.id),
    );
    const spendingIds = new Set(
      allCats.filter((c) => !c.isIncome).map((c) => c.id),
    );
    const nameById = new Map(allCats.map((c) => [c.id, c.name]));
    const rules = await prisma.importCategoryRule.findMany({
      where: { budgetId: budget.id },
      orderBy: { sortOrder: "asc" },
    });

    const csvIncomeByMonth = new Map<string, Map<string, number>>();
    const csvSpendByMonth = new Map<string, number>();

    for (const c of CSVS) {
      const path = resolve(CSV_DIR, c.file);
      if (!existsSync(path)) {
        console.error(`Missing ${path}`);
        process.exit(1);
      }
      const accountId = accountIdByName.get(c.account);
      if (!accountId) throw new Error(`No account ${c.account}`);
      const applied = applyRules(
        parseIngCsv(readFileSync(path, "utf8")),
        rules,
        accountId,
        nameById,
      );
      for (const b of monthlyIncomeFromAppliedRows(applied, incomeIds)) {
        let m = csvIncomeByMonth.get(b.month);
        if (!m) {
          m = new Map();
          csvIncomeByMonth.set(b.month, m);
        }
        for (const [id, amt] of Object.entries(b.byCategoryId)) {
          m.set(id, (m.get(id) ?? 0) + amt);
        }
      }
      for (const b of monthlySpendFromAppliedRows(applied, spendingIds)) {
        csvSpendByMonth.set(
          b.month,
          (csvSpendByMonth.get(b.month) ?? 0) + b.spentMagnitude,
        );
      }
    }

    const months = [
      ...new Set([...csvIncomeByMonth.keys(), ...csvSpendByMonth.keys()]),
    ].sort();

    console.log(
      `Budget: ${budget.name}  firstMonth=${budget.firstMonth}  DB=${dbPath}`,
    );
    console.log(`Comparing Plan UI vs CSV for ${months.length} months\n`);

    console.log("--- Income (Paycheck / Other income Activity) ---");
    console.log(
      `${"month".padEnd(10)}${"category".padEnd(14)}${"CSV".padStart(14)}${"Plan UI".padStart(14)}  ok`,
    );

    let fail = 0;
    for (const month of months) {
      const pack = await loadPlanMonth(budget.id, month);
      const plan = pack.plan;
      if (plan.month !== month) {
        console.error(`!! Plan returned month=${plan.month} for ${month}`);
        fail += 1;
      }

      for (const cat of [paycheck, other]) {
        const csvAmt = csvIncomeByMonth.get(month)?.get(cat.id) ?? 0;
        const uiAmt = plan.categories[cat.id]?.activity ?? 0;
        if (csvAmt === 0 && uiAmt === 0) continue;
        const ok = csvAmt === uiAmt;
        if (!ok) fail += 1;
        console.log(
          `${ok ? "  " : "!!"}${month.padEnd(8)}${cat.name.padEnd(14)}${planAmount(csvAmt).padStart(14)}${planAmount(uiAmt).padStart(14)}  ${ok ? "✓" : "MISMATCH"}`,
        );
      }
    }

    console.log("\n--- Spent (banner = −Σ spending-category Activity) ---");
    console.log(
      `${"month".padEnd(10)}${"CSV".padStart(14)}${"Plan UI".padStart(14)}${"delta".padStart(14)}  ok`,
    );

    for (const month of months) {
      const pack = await loadPlanMonth(budget.id, month);
      const plan = pack.plan;
      let signedSpend = 0;
      for (const cat of allCats) {
        if (cat.isIncome) continue;
        signedSpend += plan.categories[cat.id]?.activity ?? 0;
      }
      const uiSpent = -signedSpend;
      const csvSpent = csvSpendByMonth.get(month) ?? 0;
      if (csvSpent === 0 && uiSpent === 0) continue;
      const delta = uiSpent - csvSpent;
      const ok = delta === 0;
      if (!ok) fail += 1;
      console.log(
        `${ok ? "  " : "!!"}${month.padEnd(8)}${planAmount(csvSpent).padStart(14)}${planAmount(uiSpent).padStart(14)}${planAmount(delta).padStart(14)}  ${ok ? "✓" : "MISMATCH"}`,
      );

      if (!ok) {
        // Top category deltas for diagnosis
        const csvCats = new Map<string, number>();
        for (const c of CSVS) {
          const accountId = accountIdByName.get(c.account)!;
          const applied = applyRules(
            parseIngCsv(readFileSync(resolve(CSV_DIR, c.file), "utf8")),
            rules,
            accountId,
            nameById,
          );
          for (const b of monthlySpendFromAppliedRows(applied, spendingIds)) {
            if (b.month !== month) continue;
            for (const [id, amt] of Object.entries(b.byCategoryId)) {
              csvCats.set(id, (csvCats.get(id) ?? 0) + amt);
            }
          }
        }
        const diffs: { name: string; csv: number; ui: number; d: number }[] =
          [];
        for (const cat of allCats) {
          if (cat.isIncome) continue;
          const csv = csvCats.get(cat.id) ?? 0;
          const ui = plan.categories[cat.id]?.activity ?? 0;
          if (csv === ui) continue;
          diffs.push({ name: cat.name, csv, ui, d: ui - csv });
        }
        diffs.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
        for (const d of diffs.slice(0, 8)) {
          console.log(
            `      ${d.name.padEnd(22)} csv=${planAmount(d.csv)} ui=${planAmount(d.ui)} Δ=${planAmount(d.d)}`,
          );
        }
      }
    }

    if (fail) {
      console.error(`\nFAIL: ${fail} Plan UI vs CSV mismatch(es)`);
      process.exit(2);
    }
    console.log(
      `\nPASS: Plan UI Income Activity + Spent match CSV for every month.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
