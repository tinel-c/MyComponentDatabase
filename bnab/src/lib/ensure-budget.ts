import { MemberRole, Role, type PrismaClient } from "@prisma/client";
import { currentMonth } from "@/lib/money";
import { seedStarterCategories } from "@/lib/starter-categories";

type MembershipWithBudget = {
  id: string;
  userId: string;
  budgetId: string;
  role: MemberRole;
  budget: {
    id: string;
    name: string;
    currency: string;
    firstMonth: string;
    createdAt: Date;
    updatedAt: Date;
  };
};

/** Create the default household budget for an admin who has none yet. */
export async function ensureAdminHouseholdBudget(
  prisma: PrismaClient,
  userId: string,
  role: string | undefined,
): Promise<MembershipWithBudget | null> {
  if (role !== Role.ADMIN && role !== "ADMIN") return null;

  const existing = await prisma.budgetMember.findFirst({
    where: { userId },
    include: { budget: true },
    orderBy: { budget: { createdAt: "asc" } },
  });
  if (existing) return existing;

  const budget = await prisma.budget.create({
    data: {
      name: "Household",
      currency: "RON",
      firstMonth: currentMonth(),
      members: {
        create: { userId, role: MemberRole.ADMIN },
      },
    },
  });
  await seedStarterCategories(prisma, budget.id);
  await prisma.financeAccount.createMany({
    data: [
      {
        budgetId: budget.id,
        name: "Checking",
        type: "CHECKING",
        onBudget: true,
        sortOrder: 0,
      },
      {
        budgetId: budget.id,
        name: "Cash",
        type: "CASH",
        onBudget: true,
        sortOrder: 1,
      },
    ],
  });

  const membership = await prisma.budgetMember.findFirst({
    where: { userId, budgetId: budget.id },
    include: { budget: true },
  });
  if (!membership) {
    throw new Error("Failed to load membership after creating household budget");
  }
  return membership;
}
