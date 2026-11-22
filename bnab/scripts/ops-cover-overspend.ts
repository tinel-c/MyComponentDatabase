/**
 * Ops: cover all overspent spending categories for a month (Available ≥ 0).
 *   npx tsx scripts/ops-cover-overspend.ts --month 2026-11
 */
import { PrismaClient } from "@prisma/client";
import { loadPlanMonth } from "../src/lib/plan-data";
import { clearEngineMonthTips } from "../src/lib/engine-month-tip";

const prisma = new PrismaClient();

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

async function main() {
  const month = arg("--month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    console.error("Usage: npx tsx scripts/ops-cover-overspend.ts --month YYYY-MM");
    process.exit(1);
  }
  const budget = await prisma.budget.findFirst();
  if (!budget) throw new Error("no budget");

  const { plan } = await loadPlanMonth(budget.id, month);
  const spending = await prisma.category.findMany({
    where: { group: { budgetId: budget.id }, isIncome: false },
    select: { id: true },
  });
  const ids = new Set(spending.map((c) => c.id));

  let count = 0;
  let totalCovered = 0;
  for (const [categoryId, row] of Object.entries(plan.categories)) {
    if (!ids.has(categoryId) || row.available >= 0) continue;
    const next = row.assigned - row.available;
    const delta = next - row.assigned;
    await prisma.monthlyCategoryBudget.upsert({
      where: { categoryId_month: { categoryId, month } },
      create: { categoryId, month, assigned: next },
      update: { assigned: next },
    });
    count += 1;
    totalCovered += delta;
  }

  await clearEngineMonthTips(budget.id);
  const after = await loadPlanMonth(budget.id, month);
  console.log(
    JSON.stringify(
      {
        month,
        coveredCategories: count,
        totalCovered,
        rtaBefore: plan.rta,
        rtaAfter: after.plan.rta,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
