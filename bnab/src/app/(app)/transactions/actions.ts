"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { parseMoneyInput, todayISO } from "@/lib/money";

async function upsertPayee(
  budgetId: string,
  name: string,
  categoryId: string | null,
) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return prisma.payee.upsert({
    where: { budgetId_name: { budgetId, name: trimmed } },
    create: {
      budgetId,
      name: trimmed,
      lastCategoryId: categoryId,
    },
    update: categoryId ? { lastCategoryId: categoryId } : {},
  });
}

const txnSchema = z.object({
  accountId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string().min(1),
  payee: z.string().optional(),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
  inflow: z.string().optional(),
  transferToId: z.string().optional(),
  cleared: z.string().optional(),
});

export async function createTransaction(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const parsed = txnSchema.safeParse({
    accountId: formData.get("accountId"),
    date: formData.get("date") || todayISO(),
    amount: formData.get("amount"),
    payee: formData.get("payee") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    notes: formData.get("notes") ?? "",
    inflow: formData.get("inflow") ?? "",
    transferToId: formData.get("transferToId") ?? "",
    cleared: formData.get("cleared") ?? "",
  });
  if (!parsed.success) return;

  const abs = parseMoneyInput(parsed.data.amount);
  if (abs === null || abs === 0) return;

  const account = await prisma.financeAccount.findFirst({
    where: { id: parsed.data.accountId, budgetId: budget.id },
  });
  if (!account) return;

  const isInflow = parsed.data.inflow === "1" || parsed.data.inflow === "on";
  const transferToId = parsed.data.transferToId || "";

  if (transferToId) {
    const to = await prisma.financeAccount.findFirst({
      where: { id: transferToId, budgetId: budget.id },
    });
    if (!to) return;

    const amount = -Math.abs(abs);
    const a = await prisma.transaction.create({
      data: {
        accountId: account.id,
        date: parsed.data.date,
        amount,
        notes: parsed.data.notes || null,
        cleared: parsed.data.cleared === "on" || parsed.data.cleared === "1",
      },
    });
    const b = await prisma.transaction.create({
      data: {
        accountId: to.id,
        date: parsed.data.date,
        amount: Math.abs(abs),
        notes: parsed.data.notes || null,
        cleared: parsed.data.cleared === "on" || parsed.data.cleared === "1",
        transferTwinId: a.id,
      },
    });
    await prisma.transaction.update({
      where: { id: a.id },
      data: { transferTwinId: b.id },
    });
  } else {
    const categoryId = parsed.data.categoryId || null;
    const payee = await upsertPayee(
      budget.id,
      parsed.data.payee ?? "",
      categoryId,
    );
    const signed = isInflow ? Math.abs(abs) : -Math.abs(abs);
    await prisma.transaction.create({
      data: {
        accountId: account.id,
        date: parsed.data.date,
        amount: signed,
        payeeId: payee?.id ?? null,
        categoryId,
        notes: parsed.data.notes || null,
        cleared: parsed.data.cleared === "on" || parsed.data.cleared === "1",
      },
    });
  }

  revalidatePath("/accounts");
  revalidatePath("/plan");
  revalidatePath("/transactions");
  redirect(`/accounts/${account.id}`);
}

export async function createSplitTransaction(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const accountId = String(formData.get("accountId") ?? "");
  const date = String(formData.get("date") || todayISO());
  const payeeName = String(formData.get("payee") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const inflow = formData.get("inflow") === "1";

  const categoryIds = formData.getAll("splitCategoryId").map(String);
  const amounts = formData.getAll("splitAmount").map(String);
  if (!accountId || categoryIds.length === 0) return;

  const account = await prisma.financeAccount.findFirst({
    where: { id: accountId, budgetId: budget.id },
  });
  if (!account) return;

  const parts: { categoryId: string; amount: number }[] = [];
  for (let i = 0; i < categoryIds.length; i++) {
    const a = parseMoneyInput(amounts[i] ?? "");
    if (a === null || a === 0 || !categoryIds[i]) continue;
    parts.push({
      categoryId: categoryIds[i],
      amount: inflow ? Math.abs(a) : -Math.abs(a),
    });
  }
  if (parts.length < 2) return;

  const total = parts.reduce((s, p) => s + p.amount, 0);
  const payee = await upsertPayee(budget.id, payeeName, parts[0].categoryId);

  await prisma.$transaction(async (tx) => {
    const parent = await tx.transaction.create({
      data: {
        accountId,
        date,
        amount: total,
        payeeId: payee?.id ?? null,
        notes: notes || null,
        isParent: true,
        cleared: true,
      },
    });
    for (const p of parts) {
      await tx.transaction.create({
        data: {
          accountId,
          date,
          amount: p.amount,
          categoryId: p.categoryId,
          payeeId: payee?.id ?? null,
          isChild: true,
          parentId: parent.id,
          cleared: true,
        },
      });
    }
  });

  revalidatePath("/accounts");
  revalidatePath("/plan");
  redirect(`/accounts/${accountId}`);
}

export async function toggleCleared(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "");
  const txn = await prisma.transaction.findFirst({
    where: { id, account: { budgetId: budget.id } },
  });
  if (!txn) return;
  await prisma.transaction.update({
    where: { id },
    data: { cleared: !txn.cleared },
  });
  revalidatePath(`/accounts/${txn.accountId}`);
  revalidatePath(`/transactions/${id}`);
  return;
}

function resolveReturnTo(
  formData: FormData,
  fallback: string,
): "stay" | string {
  const raw = String(formData.get("returnTo") ?? "").trim();
  if (raw === "stay") return "stay";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}

function finishMutation(returnTo: "stay" | string, fallback: string): void {
  if (returnTo === "stay") return;
  redirect(returnTo || fallback);
}

export async function updateTransaction(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "");
  const parsed = txnSchema.omit({ accountId: true }).extend({
    accountId: z.string().min(1).optional(),
  }).safeParse({
    accountId: formData.get("accountId") || undefined,
    date: formData.get("date") || todayISO(),
    amount: formData.get("amount"),
    payee: formData.get("payee") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    notes: formData.get("notes") ?? "",
    inflow: formData.get("inflow") ?? "",
    transferToId: formData.get("transferToId") ?? "",
    cleared: formData.get("cleared") ?? "",
  });
  if (!parsed.success || !id) return;

  const txn = await prisma.transaction.findFirst({
    where: { id, account: { budgetId: budget.id }, isChild: false },
    include: { account: true },
  });
  if (!txn) return;

  const returnTo = resolveReturnTo(
    formData,
    `/accounts/${txn.accountId}`,
  );

  // Split parents: only memo/date/cleared for v1
  if (txn.isParent) {
    await prisma.transaction.update({
      where: { id },
      data: {
        date: parsed.data.date,
        notes: parsed.data.notes || null,
        cleared: parsed.data.cleared === "on" || parsed.data.cleared === "1",
      },
    });
    revalidatePath(`/accounts/${txn.accountId}`);
    revalidatePath(`/transactions/${id}`);
    revalidatePath("/transactions");
    revalidatePath("/plan");
    finishMutation(returnTo, `/accounts/${txn.accountId}`);
    return;
  }

  const abs = parseMoneyInput(parsed.data.amount);
  if (abs === null || abs === 0) return;

  const isInflow = parsed.data.inflow === "1" || parsed.data.inflow === "on";
  const cleared = parsed.data.cleared === "on" || parsed.data.cleared === "1";

  if (txn.transferTwinId) {
    const twin = await prisma.transaction.findFirst({
      where: { id: txn.transferTwinId, account: { budgetId: budget.id } },
    });
    if (!twin) return;
    const outAmount = -Math.abs(abs);
    const inAmount = Math.abs(abs);
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: txn.id },
        data: {
          date: parsed.data.date,
          amount: outAmount,
          notes: parsed.data.notes || null,
          cleared,
          payeeId: null,
          categoryId: null,
        },
      }),
      prisma.transaction.update({
        where: { id: twin.id },
        data: {
          date: parsed.data.date,
          amount: inAmount,
          notes: parsed.data.notes || null,
          cleared,
        },
      }),
    ]);
    revalidatePath(`/accounts/${txn.accountId}`);
    revalidatePath(`/accounts/${twin.accountId}`);
    revalidatePath(`/transactions/${id}`);
    revalidatePath("/transactions");
    revalidatePath("/plan");
    finishMutation(returnTo, `/accounts/${txn.accountId}`);
    return;
  }

  const categoryId = parsed.data.categoryId || null;
  const payee = await upsertPayee(budget.id, parsed.data.payee ?? "", categoryId);
  const signed = isInflow ? Math.abs(abs) : -Math.abs(abs);

  await prisma.transaction.update({
    where: { id },
    data: {
      date: parsed.data.date,
      amount: signed,
      payeeId: payee?.id ?? null,
      categoryId,
      notes: parsed.data.notes || null,
      cleared,
    },
  });

  revalidatePath(`/accounts/${txn.accountId}`);
  revalidatePath(`/transactions/${id}`);
  revalidatePath("/transactions");
  revalidatePath("/plan");
  finishMutation(returnTo, `/accounts/${txn.accountId}`);
}

export async function deleteTransaction(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "");
  const txn = await prisma.transaction.findFirst({
    where: { id, account: { budgetId: budget.id }, isChild: false },
  });
  if (!txn) return;

  const accountId = txn.accountId;
  const returnTo = resolveReturnTo(formData, `/accounts/${accountId}`);

  await prisma.$transaction(async (tx) => {
    if (txn.isParent) {
      await tx.transaction.deleteMany({ where: { parentId: id } });
    }
    if (txn.transferTwinId) {
      await tx.transaction.updateMany({
        where: { id: { in: [id, txn.transferTwinId] } },
        data: { transferTwinId: null },
      });
      await tx.transaction.deleteMany({
        where: { id: { in: [id, txn.transferTwinId] } },
      });
      return;
    }
    await tx.transaction.delete({ where: { id } });
  });

  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/transactions");
  revalidatePath("/plan");
  if (returnTo === "stay") {
    redirect("/transactions");
    return;
  }
  redirect(returnTo || `/accounts/${accountId}`);
}

export async function reconcileAccount(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const accountId = String(formData.get("accountId") ?? "");
  const acct = await prisma.financeAccount.findFirst({
    where: { id: accountId, budgetId: budget.id },
  });
  if (!acct) return;
  await prisma.transaction.updateMany({
    where: { accountId, cleared: true, reconciled: false },
    data: { reconciled: true },
  });
  revalidatePath(`/accounts/${accountId}`);
  return;
}
