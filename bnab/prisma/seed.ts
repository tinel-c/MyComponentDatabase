import { MemberRole, PrismaClient, Role } from "@prisma/client";
import { normalizeEmail } from "../src/lib/email";
import { seedStarterCategories } from "../src/lib/starter-categories";
import { currentMonth } from "../src/lib/money";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = normalizeEmail(
    process.env.ADMIN_EMAIL ?? "tinel.c@gmail.com",
  );

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
  }

  console.log(`Seeded admin ${adminEmail} and budget ${budget.name} (${budget.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
