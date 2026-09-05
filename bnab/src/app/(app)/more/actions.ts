"use server";

import { signOut } from "@/auth";
import { revalidatePath } from "next/cache";
import { MemberRole, Role } from "@prisma/client";
import { requireBudgetAccess, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/email";
import { parseMoneyInput, todayISO } from "@/lib/money";
import { Recurrence } from "@prisma/client";

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function inviteMember(formData: FormData) {
  await requireAdmin();
  const { budget } = await requireBudgetAccess();

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return;

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, role: Role.USER },
    update: {},
  });

  await prisma.budgetMember.upsert({
    where: {
      budgetId_userId: { budgetId: budget.id, userId: user.id },
    },
    create: {
      budgetId: budget.id,
      userId: user.id,
      role: MemberRole.EDITOR,
    },
    update: {},
  });

  revalidatePath("/more/team");
  return;
}

export async function importCsv(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const accountId = String(formData.get("accountId") ?? "");
  const csv = String(formData.get("csv") ?? "");
  const account = await prisma.financeAccount.findFirst({
    where: { id: accountId, budgetId: budget.id },
  });
  if (!account) return;
  if (!csv.trim()) return;

  const lines = csv.trim().split(/\r?\n/);
  let imported = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && /date/i.test(line) && /amount/i.test(line)) continue;
    // date,amount,payee,memo
    const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    const [dateRaw, amountRaw, payeeName, memo] = parts;
    if (!dateRaw || !amountRaw) continue;
    let date = dateRaw;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      const [d, m, y] = date.split("/");
      date = `${y}-${m}-${d}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const amount = parseMoneyInput(amountRaw);
    if (amount === null || amount === 0) continue;

    let payeeId: string | null = null;
    if (payeeName) {
      const payee = await prisma.payee.upsert({
        where: { budgetId_name: { budgetId: budget.id, name: payeeName } },
        create: { budgetId: budget.id, name: payeeName },
        update: {},
      });
      payeeId = payee.id;
    }

    await prisma.transaction.create({
      data: {
        accountId,
        date,
        amount,
        payeeId,
        notes: memo || null,
        cleared: true,
      },
    });
    imported++;
  }

  revalidatePath("/accounts");
  revalidatePath("/plan");
  revalidatePath("/reflect");
  return;
}

export async function createSchedule(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const accountId = String(formData.get("accountId") ?? "");
  const amount = parseMoneyInput(String(formData.get("amount") ?? ""));
  const nextDate = String(formData.get("nextDate") || todayISO());
  const recurrence = String(formData.get("recurrence") ?? "MONTHLY") as Recurrence;
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const payeeName = String(formData.get("payee") ?? "").trim();
  const notes = String(formData.get("notes") ?? "") || null;
  const inflow = formData.get("inflow") === "1";

  if (!accountId || amount === null || amount === 0) {
    return;
  }

  let payeeId: string | null = null;
  if (payeeName) {
    const p = await prisma.payee.upsert({
      where: { budgetId_name: { budgetId: budget.id, name: payeeName } },
      create: { budgetId: budget.id, name: payeeName, lastCategoryId: categoryId },
      update: categoryId ? { lastCategoryId: categoryId } : {},
    });
    payeeId = p.id;
  }

  await prisma.scheduledTransaction.create({
    data: {
      budgetId: budget.id,
      accountId,
      payeeId,
      categoryId,
      amount: inflow ? Math.abs(amount) : -Math.abs(amount),
      notes,
      nextDate,
      recurrence,
    },
  });

  revalidatePath("/more/schedules");
  return;
}

export async function enterScheduled(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "");
  const sched = await prisma.scheduledTransaction.findFirst({
    where: { id, budgetId: budget.id, active: true },
  });
  if (!sched) return;

  await prisma.transaction.create({
    data: {
      accountId: sched.accountId,
      date: sched.nextDate,
      amount: sched.amount,
      payeeId: sched.payeeId,
      categoryId: sched.categoryId,
      notes: sched.notes,
      cleared: true,
    },
  });

  const next = advanceDate(sched.nextDate, sched.recurrence);
  await prisma.scheduledTransaction.update({
    where: { id },
    data: {
      nextDate: next,
      active: sched.recurrence === "ONCE" ? false : true,
    },
  });

  revalidatePath("/more/schedules");
  revalidatePath("/plan");
  revalidatePath("/accounts");
  return;
}

function advanceDate(date: string, recurrence: Recurrence): string {
  const d = new Date(date + "T12:00:00");
  switch (recurrence) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "BIWEEKLY":
      d.setDate(d.getDate() + 14);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      break;
  }
  return d.toISOString().slice(0, 10);
}

export async function setCategoryTarget(formData: FormData) {
  const { budget } = await requireBudgetAccess();
  const categoryId = String(formData.get("categoryId") ?? "");
  const type = String(formData.get("type") ?? "MONTHLY_SPENDING");
  const amount = parseMoneyInput(String(formData.get("amount") ?? ""));
  const dueDay = Number(formData.get("dueDay") ?? 0) || null;
  const dueDate = String(formData.get("dueDate") ?? "") || null;

  const cat = await prisma.category.findFirst({
    where: { id: categoryId, group: { budgetId: budget.id } },
  });
  if (!cat || amount === null) return;

  await prisma.categoryTarget.deleteMany({ where: { categoryId } });
  await prisma.categoryTarget.create({
    data: {
      categoryId,
      type: type as "MONTHLY_SPENDING" | "NEEDED_BY_DATE" | "WEEKLY" | "SAVINGS_BALANCE",
      amount,
      dueDay,
      dueDate,
    },
  });

  revalidatePath("/more/categories");
  revalidatePath("/plan");
  return;
}
