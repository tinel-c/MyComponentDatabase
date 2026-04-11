"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import {
  storageLocationCreateSchema,
  storageLocationUpdateSchema,
  type LocationFormState,
} from "@/lib/schemas";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createLocation(
  _prev: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  await requireAdmin();
  const parsed = storageLocationCreateSchema.safeParse({
    name: formData.get("name"),
    parentId: formData.get("parentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  try {
    await prisma.storageLocation.create({ data: parsed.data });
  } catch {
    return { error: "Could not create location." };
  }
  revalidatePath("/locations");
  redirect("/locations");
}

export async function updateLocation(
  _prev: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  await requireAdmin();
  const parsed = storageLocationUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    parentId: formData.get("parentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  const { id, ...data } = parsed.data;
  try {
    await prisma.storageLocation.update({
      where: { id },
      data,
    });
  } catch {
    return { error: "Could not update location." };
  }
  revalidatePath("/locations");
  revalidatePath(`/locations/${id}/edit`);
  redirect("/locations");
}

export async function deleteLocation(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return;
  }
  await prisma.storageLocation.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/locations");
  redirect("/locations");
}
