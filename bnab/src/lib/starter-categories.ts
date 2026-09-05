import type { PrismaClient } from "@prisma/client";

export const STARTER_GROUPS: {
  name: string;
  isIncome?: boolean;
  categories: string[];
}[] = [
  {
    name: "Income",
    isIncome: true,
    categories: ["Paycheck", "Other income"],
  },
  {
    name: "Bills",
    categories: ["Rent / Mortgage", "Utilities", "Internet", "Phone", "Insurance"],
  },
  {
    name: "Frequent",
    categories: ["Groceries", "Transport", "Eating out", "Household"],
  },
  {
    name: "Non-Monthly",
    categories: ["Car maintenance", "Medical", "Gifts", "Clothing", "Subscriptions"],
  },
  {
    name: "Goals",
    categories: ["Emergency fund", "Vacation", "Home projects"],
  },
  {
    name: "Quality of Life",
    categories: ["Fun money", "Hobbies", "Personal care"],
  },
];

export async function seedStarterCategories(
  prisma: PrismaClient,
  budgetId: string,
) {
  let gOrder = 0;
  for (const g of STARTER_GROUPS) {
    const group = await prisma.categoryGroup.create({
      data: {
        budgetId,
        name: g.name,
        isIncome: !!g.isIncome,
        sortOrder: gOrder++,
        categories: {
          create: g.categories.map((name, i) => ({
            name,
            isIncome: !!g.isIncome,
            sortOrder: i,
          })),
        },
      },
    });
    void group;
  }

  await prisma.categoryGroup.create({
    data: {
      budgetId,
      name: "Credit Card Payments",
      sortOrder: 100,
    },
  });
}
