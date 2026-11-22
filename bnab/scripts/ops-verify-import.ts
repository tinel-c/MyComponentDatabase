/**
 * Ops: print txn counts, recent import batches, on-budget account balances.
 *   npx tsx scripts/ops-verify-import.ts
 */
import { PrismaClient } from "@prisma/client";
import { loadPlanMonth } from "../src/lib/plan-data";

const prisma = new PrismaClient();

async function main() {
  const budget = await prisma.budget.findFirst();
  if (!budget) throw new Error("no budget");

  const txnCount = await prisma.transaction.count();
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, sourceLabel: true, statsJson: true, createdAt: true },
  });
  const accounts = await prisma.financeAccount.findMany({
    where: { closed: false, onBudget: true },
    select: { id: true, name: true, type: true },
  });
  const bals = [];
  for (const a of accounts) {
    const agg = await prisma.transaction.aggregate({
      where: {
        accountId: a.id,
        isChild: false,
      },
      _sum: { amount: true },
    });
    bals.push({
      name: a.name,
      type: a.type,
      balance: agg._sum.amount ?? 0,
    });
  }

  const plan = await loadPlanMonth(budget.id, "2026-11");
  let overspent = 0;
  for (const row of Object.values(plan.plan.categories)) {
    if (row.available < 0) overspent += 1;
  }

  console.log(
    JSON.stringify(
      {
        txnCount,
        recentBatches: batches,
        bals,
        plan2026_11: {
          rta: plan.plan.rta,
          totalAssigned: plan.plan.totalAssigned,
          overspentCategories: overspent,
        },
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
