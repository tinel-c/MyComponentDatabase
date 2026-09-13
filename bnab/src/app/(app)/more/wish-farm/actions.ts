"use server";

import { revalidatePath } from "next/cache";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { parseMoneyInput } from "@/lib/money";

export type WishFarmResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function createWishItemAction(
  formData: FormData,
): Promise<WishFarmResult> {
  const { budget } = await requireBudgetAccess();
  const name = String(formData.get("name") ?? "").trim();
  const amountCents = parseMoneyInput(String(formData.get("amount") ?? ""));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Name is required." };
  if (amountCents == null || amountCents <= 0) {
    return { ok: false, error: "Enter a positive goal amount." };
  }

  const maxSort = await prisma.wishItem.aggregate({
    where: { budgetId: budget.id },
    _max: { sortOrder: true },
  });

  await prisma.wishItem.create({
    data: {
      budgetId: budget.id,
      name,
      amountCents,
      notes,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/more/wish-farm");
  return { ok: true, message: "Wish added." };
}

export async function harvestWishItemAction(
  formData: FormData,
): Promise<WishFarmResult> {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "").trim();
  const addCents = parseMoneyInput(String(formData.get("amount") ?? ""));

  if (!id) return { ok: false, error: "Missing wish." };
  if (addCents == null || addCents <= 0) {
    return { ok: false, error: "Enter a positive harvest amount." };
  }

  const item = await prisma.wishItem.findFirst({
    where: { id, budgetId: budget.id },
  });
  if (!item) return { ok: false, error: "Wish not found." };

  const remaining = Math.max(0, item.amountCents - item.fundedCents);
  const applied = Math.min(addCents, remaining || addCents);

  await prisma.wishItem.update({
    where: { id: item.id },
    data: { fundedCents: item.fundedCents + applied },
  });

  revalidatePath("/more/wish-farm");
  return {
    ok: true,
    message: `Harvested toward “${item.name}”. Optionally assign the same amount on Plan from Ready to Assign.`,
  };
}

export async function deleteWishItemAction(
  formData: FormData,
): Promise<WishFarmResult> {
  const { budget } = await requireBudgetAccess();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Missing wish." };

  await prisma.wishItem.deleteMany({ where: { id, budgetId: budget.id } });
  revalidatePath("/more/wish-farm");
  return { ok: true, message: "Wish removed." };
}
