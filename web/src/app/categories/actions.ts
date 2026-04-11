"use server";

import { prisma } from "@/lib/prisma";
import { categoryCreateSchema, categoryUpdateSchema, type CategoryFormState } from "@/lib/schemas";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const parsed = categoryCreateSchema.safeParse({
    name: formData.get("name"),
    parentId: formData.get("parentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  try {
    await prisma.category.create({ data: parsed.data });
  } catch {
    return { error: "Could not create category." };
  }
  revalidatePath("/categories");
  redirect("/categories");
}

export async function updateCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const parsed = categoryUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    parentId: formData.get("parentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  const { id, ...data } = parsed.data;
  try {
    await prisma.category.update({
      where: { id },
      data,
    });
  } catch {
    return { error: "Could not update category." };
  }
  revalidatePath("/categories");
  revalidatePath(`/categories/${id}/edit`);
  redirect("/categories");
}

export async function deleteCategory(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return;
  }
  await prisma.category.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/categories");
  redirect("/categories");
}
