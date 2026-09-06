import { MemberRole, PrismaClient, Role } from "@prisma/client";
import { normalizeEmail } from "../src/lib/email";
import { seedStarterCategories } from "../src/lib/starter-categories";
import { currentMonth } from "../src/lib/money";

const prisma = new PrismaClient();

async function wipeBudgetData() {
  // Order respects FKs for SQLite
  await prisma.importBatchItem.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.importCategoryRule.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.scheduledTransaction.deleteMany();
  await prisma.monthlyCategoryBudget.deleteMany();
  await prisma.categoryTarget.deleteMany();
  await prisma.monthMeta.deleteMany();
  await prisma.payee.deleteMany();
  // Clear credit-card category links before deleting categories
  await prisma.financeAccount.updateMany({
    data: { creditCategoryId: null },
  });
  await prisma.financeAccount.deleteMany();
  await prisma.category.deleteMany();
  await prisma.categoryGroup.deleteMany();
  await prisma.budgetMember.deleteMany();
  await prisma.budget.deleteMany();
}

async function main() {
  const adminEmail = normalizeEmail(
    process.env.ADMIN_EMAIL ?? "tinel.c@gmail.com",
  );
  const reset = process.env.BNAB_RESET === "1" || process.env.BNAB_RESET === "true";

  if (reset) {
    console.log("BNAB_RESET=1 — wiping budgets, accounts, categories, transactions…");
    await wipeBudgetData();
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "Admin",
      role: Role.ADMIN,
    },
    update: { role: Role.ADMIN },
  });

  let budget = await prisma.budget.findFirst({
    where: { members: { some: { userId: admin.id } } },
  });

  if (!budget) {
    budget = await prisma.budget.create({
      data: {
        name: "Household",
        currency: "RON",
        firstMonth: currentMonth(),
        members: {
          create: { userId: admin.id, role: MemberRole.ADMIN },
        },
      },
    });
    await seedStarterCategories(prisma, budget.id);

    await prisma.financeAccount.create({
      data: {
        budgetId: budget.id,
        name: "Checking",
        type: "CHECKING",
        onBudget: true,
        sortOrder: 0,
      },
    });
    await prisma.financeAccount.create({
      data: {
        budgetId: budget.id,
        name: "Cash",
        type: "CASH",
        onBudget: true,
        sortOrder: 1,
      },
    });
  } else if (reset) {
    // Should not happen after wipe, but keep safe
    await seedStarterCategories(prisma, budget.id);
  }

  const groups = await prisma.categoryGroup.count({
    where: { budgetId: budget.id },
  });
  const cats = await prisma.category.count({
    where: { group: { budgetId: budget.id } },
  });
  const rules = await prisma.importCategoryRule.count({
    where: { budgetId: budget.id },
  });

  console.log(
    `Seeded admin ${adminEmail} budget=${budget.name} (${budget.id}) groups=${groups} categories=${cats} importRules=${rules}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
