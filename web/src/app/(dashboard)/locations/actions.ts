"use server";

import { logAudit, serializeStorageLocation } from "@/lib/audit";
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
  const session = await requireAdmin();
  const parsed = storageLocationCreateSchema.safeParse({
    name: formData.get("name"),
    parentId: formData.get("parentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  try {
    const created = await prisma.storageLocation.create({ data: parsed.data });
    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      model: "StorageLocation",
      recordId: created.id,
      recordName: created.name,
      after: serializeStorageLocation(created),
    });
  } catch {
    return { error: "Could not create location." };
  }
  revalidatePath("/locations");
  revalidatePath("/admin/audit");
  redirect("/locations");
}

export async function updateLocation(
  _prev: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const session = await requireAdmin();
  const parsed = storageLocationUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    parentId: formData.get("parentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  const { id, ...data } = parsed.data;
  const before = await prisma.storageLocation.findUnique({ where: { id } });
  if (!before) {
    return { error: "Location not found." };
  }
  try {
    await prisma.storageLocation.update({
      where: { id },
      data,
    });
  } catch {
    return { error: "Could not update location." };
  }
  const after = await prisma.storageLocation.findUnique({ where: { id } });
  if (after) {
    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      model: "StorageLocation",
      recordId: id,
      recordName: after.name,
      before: serializeStorageLocation(before),
      after: serializeStorageLocation(after),
    });
  }
  revalidatePath("/locations");
  revalidatePath(`/locations/${id}/edit`);
  revalidatePath("/admin/audit");
  redirect("/locations");
}

export async function deleteLocation(formData: FormData) {
  const session = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return;
  }
  const before = await prisma.storageLocation.findUnique({ where: { id } });
  if (before) {
    await logAudit({
      userId: session.user.id,
      action: "DELETE",
      model: "StorageLocation",
      recordId: before.id,
      recordName: before.name,
      before: serializeStorageLocation(before),
    });
  }
  await prisma.storageLocation.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/locations");
  revalidatePath("/admin/audit");
  redirect("/locations");
}
