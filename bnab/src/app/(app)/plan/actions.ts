"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { parseMoneyInput } from "@/lib/money";

export async function assignToCategory(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const categoryId = String(formData.get("categoryId") ?? "");
  const month = String(formData.get("month") ?? "");
  const raw = String(formData.get("amount") ?? "");
  const amount = parseMoneyInput(raw);
  if (!categoryId || !/^\d{4}-\d{2}$/.test(month) || amount === null) {
    return;
  }

  const cat = await prisma.category.findFirst({
    where: { id: categoryId, group: { budgetId: budget.id } },
  });
  if (!cat || cat.isIncome) return;

  await prisma.monthlyCategoryBudget.upsert({
    where: { categoryId_month: { categoryId, month } },
    create: { categoryId, month, assigned: amount },
    update: { assigned: amount },
  });

  revalidatePath("/plan");
  return;
}

export async function moveMoney(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const fromId = String(formData.get("fromId") ?? "");
  const toId = String(formData.get("toId") ?? "");
  const month = String(formData.get("month") ?? "");
  const amount = parseMoneyInput(String(formData.get("amount") ?? ""));
  if (!fromId || !toId || fromId === toId || amount === null || amount <= 0) {
    return;
  }

  const cats = await prisma.category.findMany({
    where: {
      id: { in: [fromId, toId] },
      group: { budgetId: budget.id },
      isIncome: false,
    },
  });
  if (cats.length !== 2) return;

  await prisma.$transaction(async (tx) => {
    const from = await tx.monthlyCategoryBudget.findUnique({
      where: { categoryId_month: { categoryId: fromId, month } },
    });
    const to = await tx.monthlyCategoryBudget.findUnique({
      where: { categoryId_month: { categoryId: toId, month } },
    });
    const fromAssigned = (from?.assigned ?? 0) - amount;
    const toAssigned = (to?.assigned ?? 0) + amount;
    await tx.monthlyCategoryBudget.upsert({
      where: { categoryId_month: { categoryId: fromId, month } },
      create: { categoryId: fromId, month, assigned: fromAssigned },
      update: { assigned: fromAssigned },
    });
    await tx.monthlyCategoryBudget.upsert({
      where: { categoryId_month: { categoryId: toId, month } },
      create: { categoryId: toId, month, assigned: toAssigned },
      update: { assigned: toAssigned },
    });
  });

  revalidatePath("/plan");
  return;
}

export async function coverOverspend(formData: FormData) {
  const overspentId = String(formData.get("categoryId") ?? "");
  const fromId = String(formData.get("fromId") ?? "");
  const month = String(formData.get("month") ?? "");
  const amount = parseMoneyInput(String(formData.get("amount") ?? ""));
  if (!overspentId || !fromId || amount === null || amount <= 0) {
    return;
  }
  const fd = new FormData();
  fd.set("fromId", fromId);
  fd.set("toId", overspentId);
  fd.set("month", month);
  fd.set("amount", String(amount / 100));
  return moveMoney(fd);
}

const accountSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum([
    "CHECKING",
    "SAVINGS",
    "CASH",
    "CREDIT_CARD",
    "TRACKING_ASSET",
    "TRACKING_LIABILITY",
  ]),
  startingBalance: z.string().optional(),
});

export async function createAccount(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    startingBalance: formData.get("startingBalance") ?? "",
  });
  if (!parsed.success) return;

  const onBudget = ![
    "TRACKING_ASSET",
    "TRACKING_LIABILITY",
  ].includes(parsed.data.type);

  const account = await prisma.$transaction(async (tx) => {
    let creditCategoryId: string | undefined;

    if (parsed.data.type === "CREDIT_CARD") {
      let group = await tx.categoryGroup.findFirst({
        where: { budgetId: budget.id, name: "Credit Card Payments" },
      });
      if (!group) {
        group = await tx.categoryGroup.create({
          data: {
            budgetId: budget.id,
            name: "Credit Card Payments",
            sortOrder: 100,
          },
        });
      }
      const cat = await tx.category.create({
        data: {
          groupId: group.id,
          name: `Payment: ${parsed.data.name}`,
          isSystem: true,
          systemKey: "cc-payment",
          sortOrder: Date.now(),
        },
      });
      creditCategoryId = cat.id;
    }

    const acct = await tx.financeAccount.create({
      data: {
        budgetId: budget.id,
        name: parsed.data.name,
        type: parsed.data.type,
        onBudget,
        creditCategoryId: creditCategoryId ?? null,
        sortOrder: Date.now(),
      },
    });

    const start = parseMoneyInput(parsed.data.startingBalance ?? "");
    if (start !== null && start !== 0) {
      const today = new Date().toISOString().slice(0, 10);
      let amount = start;
      if (
        parsed.data.type === "CREDIT_CARD" ||
        parsed.data.type === "TRACKING_LIABILITY"
      ) {
        // liability: positive starting balance means money owed → negative account balance convention
        // We store starting as negative outflow-like for liability so balance = sum(amounts) works
        // For credit cards: positive debt entered by user → store as negative amount on account
        if (start > 0) amount = -Math.abs(start);
      }
      await tx.transaction.create({
        data: {
          accountId: acct.id,
          date: today,
          amount,
          cleared: true,
          isStartingBalance: true,
          notes: "Starting balance",
        },
      });
    }

    return acct;
  });

  revalidatePath("/accounts");
  revalidatePath("/plan");
  return;
}

export async function toggleAccountClosed(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "");
  const acct = await prisma.financeAccount.findFirst({
    where: { id, budgetId: budget.id },
  });
  if (!acct) return;
  await prisma.financeAccount.update({
    where: { id },
    data: { closed: !acct.closed },
  });
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  return;
}

export async function renameAccount(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name || name.length > 80) return;

  const acct = await prisma.financeAccount.findFirst({
    where: { id, budgetId: budget.id },
  });
  if (!acct) return;

  await prisma.$transaction(async (tx) => {
    await tx.financeAccount.update({
      where: { id },
      data: { name },
    });
    if (acct.creditCategoryId) {
      await tx.category.update({
        where: { id: acct.creditCategoryId },
        data: { name: `Payment: ${name}` },
      });
    }
  });

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  revalidatePath("/plan");
  revalidatePath("/more/categories");
  return;
}
