"use server";

import { logAudit, serializeCategory } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { categoryCreateSchema, categoryUpdateSchema, type CategoryFormState } from "@/lib/schemas";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const session = await requireAdmin();
  const parsed = categoryCreateSchema.safeParse({
    name: formData.get("name"),
    parentId: formData.get("parentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  try {
    const created = await prisma.category.create({ data: parsed.data });
    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      model: "Category",
      recordId: created.id,
      recordName: created.name,
      after: serializeCategory(created),
    });
  } catch {
    return { error: "Could not create category." };
  }
  revalidatePath("/categories");
  revalidatePath("/admin/audit");
  redirect("/categories");
}

export async function updateCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const session = await requireAdmin();
  const parsed = categoryUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    parentId: formData.get("parentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  const { id, ...data } = parsed.data;
  const before = await prisma.category.findUnique({ where: { id } });
  if (!before) {
    return { error: "Category not found." };
  }
  try {
    await prisma.category.update({
      where: { id },
      data,
    });
  } catch {
    return { error: "Could not update category." };
  }
  const after = await prisma.category.findUnique({ where: { id } });
  if (after) {
    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      model: "Category",
      recordId: id,
      recordName: after.name,
      before: serializeCategory(before),
      after: serializeCategory(after),
    });
  }
  revalidatePath("/categories");
  revalidatePath(`/categories/${id}/edit`);
  revalidatePath("/admin/audit");
  redirect("/categories");
}

export async function deleteCategory(formData: FormData) {
  const session = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return;
  }
  const before = await prisma.category.findUnique({ where: { id } });
  if (before) {
    await logAudit({
      userId: session.user.id,
      action: "DELETE",
      model: "Category",
      recordId: before.id,
      recordName: before.name,
      before: serializeCategory(before),
    });
  }
  await prisma.category.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/categories");
  revalidatePath("/admin/audit");
  redirect("/categories");
}
