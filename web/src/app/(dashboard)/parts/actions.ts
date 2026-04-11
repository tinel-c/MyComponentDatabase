"use server";

import { auth } from "@/auth";
import {
  expandVisibleCategoryIds,
  getVisibleCategoryIdsForUser,
  partVisibilityWhere,
} from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { partCreateSchema, partUpdateSchema, type PartFormState } from "@/lib/schemas";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function sessionUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}

async function mayEditCategory(
  userId: string,
  role: Role,
  categoryId: string | null | undefined,
): Promise<boolean> {
  if (role === Role.ADMIN) return true;
  if (!categoryId) return false;
  const assigned = await getVisibleCategoryIdsForUser(userId);
  const expanded = await expandVisibleCategoryIds(assigned);
  return expanded.includes(categoryId);
}

export async function createPart(
  _prev: PartFormState,
  formData: FormData,
): Promise<PartFormState> {
  const user = await sessionUser();
  const parsed = partCreateSchema.safeParse({
    internalSku: formData.get("internalSku"),
    name: formData.get("name"),
    mpn: formData.get("mpn"),
    manufacturer: formData.get("manufacturer"),
    description: formData.get("description"),
    quantityOnHand: formData.get("quantityOnHand"),
    reorderMin: formData.get("reorderMin"),
    unit: formData.get("unit"),
    categoryId: formData.get("categoryId"),
    defaultLocationId: formData.get("defaultLocationId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  if (user.role === Role.USER) {
    if (!parsed.data.categoryId) {
      return { error: "Choose a category you are allowed to access." };
    }
    const ok = await mayEditCategory(user.id, user.role, parsed.data.categoryId);
    if (!ok) {
      return { error: "You cannot add parts to this category." };
    }
  }

  try {
    await prisma.part.create({ data: parsed.data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return { error: "Internal SKU must be unique." };
    }
    return { error: "Could not create part." };
  }
  revalidatePath("/parts");
  redirect("/parts");
}

export async function updatePart(
  _prev: PartFormState,
  formData: FormData,
): Promise<PartFormState> {
  const user = await sessionUser();
  const parsed = partUpdateSchema.safeParse({
    id: formData.get("id"),
    internalSku: formData.get("internalSku"),
    name: formData.get("name"),
    mpn: formData.get("mpn"),
    manufacturer: formData.get("manufacturer"),
    description: formData.get("description"),
    quantityOnHand: formData.get("quantityOnHand"),
    reorderMin: formData.get("reorderMin"),
    unit: formData.get("unit"),
    categoryId: formData.get("categoryId"),
    defaultLocationId: formData.get("defaultLocationId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  const { id, ...data } = parsed.data;

  const existing = await prisma.part.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Part not found." };
  }

  if (user.role === Role.USER) {
    const oldOk = await mayEditCategory(user.id, user.role, existing.categoryId);
    if (!oldOk) {
      return { error: "You cannot edit this part." };
    }
    if (!data.categoryId) {
      return { error: "Category is required." };
    }
    const newOk = await mayEditCategory(user.id, user.role, data.categoryId);
    if (!newOk) {
      return { error: "You cannot move this part to that category." };
    }
  }

  try {
    await prisma.part.update({
      where: { id },
      data,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return { error: "Internal SKU must be unique." };
    }
    return { error: "Could not update part." };
  }
  revalidatePath("/parts");
  revalidatePath(`/parts/${id}/edit`);
  redirect("/parts");
}

export async function deletePart(formData: FormData) {
  const user = await sessionUser();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return;
  }

  const existing = await prisma.part.findUnique({ where: { id } });
  if (existing && user.role === Role.USER) {
    const ok = await mayEditCategory(user.id, user.role, existing.categoryId);
    if (!ok) {
      redirect("/parts");
    }
  }

  await prisma.part.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/parts");
  redirect("/parts");
}

/** Used by edit page to block direct URL access */
export async function assertPartVisibleToUser(partId: string) {
  const user = await sessionUser();
  if (user.role === Role.ADMIN) return;
  const vis = await partVisibilityWhere(user.id, user.role);
  const part = await prisma.part.findFirst({
    where: vis ? { AND: [{ id: partId }, vis] } : { id: partId },
  });
  if (!part) {
    redirect("/parts");
  }
}
