import type { PrismaClient } from "@prisma/client";
import { DEFAULT_IMPORT_RULES } from "@/lib/ing-import/default-rules";
import { DEFAULT_RECEIPT_RULES } from "@/lib/receipt-ai/default-rules";

/** YNGSB groups (= Code.gs defaultMainCategories) + Income for BNAB RTA. */
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
    name: "Monthly Bills",
    categories: [
      "Rent/Mortgage",
      "Phone",
      "Internet",
      "Cable TV",
      "Electricity",
      "Water",
      "Hidroelectrica",
      "Streaming",
      "Bani buni",
      "Transport",
      "Software",
      "EON",
      "Asociatie",
      "Bona",
      "RCS/RDS",
      "Kindergarden&School",
      "Impozite",
      "Asigurari",
      "Health Insurance",
    ],
  },
  {
    name: "Everyday Expenses",
    categories: [
      "Groceries",
      "Fuel",
      "Medical",
      "Clothing",
      "Household Goods",
      "Pets",
      "Tools",
      "Pocket Money Tinel",
      "Pocket Money Monica",
      "Atelier",
      "Transactions",
      "Education",
      "Parcare",
      "Restaurante",
      "Round-up",
      "Office food",
      "Library",
      "Unknown",
      "Washing",
      "Taxi",
      "Presents",
      "Hotels",
      "Curatenie & Ironing",
      "Look&Feel",
      "Carti",
      "Toys",
      "Cinema",
      "Google Play",
      "Games",
      "Site-uri",
      "Retragere",
    ],
  },
  {
    name: "Rainy Day Funds",
    categories: [
      "Emergency Fund",
      "Car Repairs",
      "Home Maintanance",
      "Car Insurance",
      "Life Insurance",
      "Birthdays",
      "Christmas",
    ],
  },
  {
    name: "Savings Goals",
    categories: [
      "Car Replacement",
      "Vacation",
      "Domains",
      "Car replacement",
    ],
  },
  {
    name: "Debt",
    categories: ["Car Payment", "Personal Loan Payment"],
  },
];

export async function seedStarterCategories(
  prisma: PrismaClient,
  budgetId: string,
) {
  await ensureYngsbCategories(prisma, budgetId);
  await seedDefaultImportRules(prisma, budgetId);
  await seedDefaultReceiptRules(prisma, budgetId);
}

/** Ensure YNGSB tree exists (idempotent by group/category name). */
export async function ensureYngsbCategories(
  prisma: PrismaClient,
  budgetId: string,
) {
  let gOrder = 0;
  for (const g of STARTER_GROUPS) {
    let group = await prisma.categoryGroup.findFirst({
      where: { budgetId, name: g.name },
    });
    if (!group) {
      group = await prisma.categoryGroup.create({
        data: {
          budgetId,
          name: g.name,
          isIncome: !!g.isIncome,
          sortOrder: gOrder,
        },
      });
    } else if (group.isIncome !== !!g.isIncome) {
      await prisma.categoryGroup.update({
        where: { id: group.id },
        data: { isIncome: !!g.isIncome },
      });
    }
    gOrder++;

    let cOrder = 0;
    for (const name of g.categories) {
      const existing = await prisma.category.findFirst({
        where: { groupId: group.id, name },
      });
      if (!existing) {
        await prisma.category.create({
          data: {
            groupId: group.id,
            name,
            isIncome: !!g.isIncome,
            sortOrder: cOrder,
          },
        });
      }
      cOrder++;
    }
  }

  const cc = await prisma.categoryGroup.findFirst({
    where: { budgetId, name: "Credit Card Payments" },
  });
  if (!cc) {
    await prisma.categoryGroup.create({
      data: {
        budgetId,
        name: "Credit Card Payments",
        sortOrder: 100,
      },
    });
  }
}

/** Seed default substring→category rules once (skip if any rules exist). */
export async function seedDefaultImportRules(
  prisma: PrismaClient,
  budgetId: string,
) {
  const count = await prisma.importCategoryRule.count({ where: { budgetId } });
  if (count > 0) return;

  const categories = await prisma.category.findMany({
    where: { group: { budgetId } },
    select: { id: true, name: true },
  });
  const byName = new Map(categories.map((c) => [c.name, c.id]));

  let sortOrder = 0;
  for (const rule of DEFAULT_IMPORT_RULES) {
    if (rule.ignore) {
      await prisma.importCategoryRule.create({
        data: {
          budgetId,
          matchText: rule.matchText,
          ignore: true,
          categoryId: null,
          sortOrder: sortOrder++,
        },
      });
      continue;
    }
    const categoryId = byName.get(rule.categoryName);
    if (!categoryId) continue;
    await prisma.importCategoryRule.create({
      data: {
        budgetId,
        matchText: rule.matchText,
        ignore: false,
        categoryId,
        sortOrder: sortOrder++,
      },
    });
  }
}

/** Seed default receipt line→category rules once (skip if any rules exist). */
export async function seedDefaultReceiptRules(
  prisma: PrismaClient,
  budgetId: string,
) {
  const count = await prisma.receiptCategoryRule.count({ where: { budgetId } });
  if (count > 0) return;

  const categories = await prisma.category.findMany({
    where: { group: { budgetId } },
    select: { id: true, name: true },
  });
  const byName = new Map(categories.map((c) => [c.name, c.id]));

  let sortOrder = 0;
  for (const rule of DEFAULT_RECEIPT_RULES) {
    if (rule.ignore) {
      await prisma.receiptCategoryRule.create({
        data: {
          budgetId,
          matchText: rule.matchText,
          ignore: true,
          categoryId: null,
          sortOrder: sortOrder++,
        },
      });
      continue;
    }
    const categoryId = byName.get(rule.categoryName);
    if (!categoryId) continue;
    await prisma.receiptCategoryRule.create({
      data: {
        budgetId,
        matchText: rule.matchText,
        ignore: false,
        categoryId,
        sortOrder: sortOrder++,
      },
    });
  }
}
