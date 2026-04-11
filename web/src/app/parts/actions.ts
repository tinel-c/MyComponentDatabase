"use server";

import { prisma } from "@/lib/prisma";
import { partCreateSchema, partUpdateSchema, type PartFormState } from "@/lib/schemas";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createPart(
  _prev: PartFormState,
  formData: FormData,
): Promise<PartFormState> {
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
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return;
  }
  await prisma.part.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/parts");
  redirect("/parts");
}
