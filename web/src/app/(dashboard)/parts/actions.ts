"use server";

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { auth } from "@/auth";
import {
  expandVisibleCategoryIds,
  getVisibleCategoryIdsForUser,
  partVisibilityWhere,
  userCanEditPart,
} from "@/lib/authz";
import {
  ensurePartAssetsDir,
  extensionForMime,
  isAllowedImageMime,
  MAX_IMAGE_FILE_BYTES,
  MAX_PART_IMAGES,
  syncPartHeroFromGallery,
  unlinkPartImageFile,
} from "@/lib/part-image-files";
import { parsePurchaseLinksFromForm } from "@/lib/part-purchase-links";
import {
  logAudit,
  serializePart,
} from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  partCreateSchema,
  partDescriptionOnlySchema,
  partTableInlineUpdateSchema,
  partUpdateSchema,
  type PartFormState,
} from "@/lib/schemas";
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
    imageUrl: formData.get("imageUrl"),
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

  const purchaseLinks = parsePurchaseLinksFromForm(formData);

  let createdId: string;
  let partNumber: number;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const agg = await tx.part.aggregate({ _max: { partNumber: true } });
      const next = (agg._max.partNumber ?? 0) + 1;
      const row = await tx.part.create({
        data: { ...parsed.data, partNumber: next },
        select: { id: true, partNumber: true },
      });
      if (purchaseLinks.length > 0) {
        await tx.partPurchaseLink.createMany({
          data: purchaseLinks.map((l, i) => ({
            partId: row.id,
            label: l.label,
            url: l.url,
            sortOrder: i,
          })),
        });
      }
      return row;
    });
    createdId = created.id;
    partNumber = created.partNumber;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return { error: "Internal SKU must be unique." };
    }
    return { error: "Could not create part." };
  }
  const createdFull = await prisma.part.findUnique({
    where: { id: createdId },
    include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
  });
  if (createdFull) {
    await logAudit({
      userId: user.id,
      action: "CREATE",
      model: "Part",
      recordId: createdFull.id,
      recordName: createdFull.name,
      after: serializePart(createdFull),
    });
  }
  revalidatePath("/parts");
  revalidatePath(`/parts/${createdId}`);
  revalidatePath(`/p/${partNumber}`);
  revalidatePath("/admin/audit");
  redirect(`/parts/${createdId}`);
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
    imageUrl: formData.get("imageUrl"),
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

  const purchaseLinks = parsePurchaseLinksFromForm(formData);

  const beforeFull = await prisma.part.findUnique({
    where: { id },
    include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.part.update({
        where: { id },
        data,
      });
      await tx.partPurchaseLink.deleteMany({ where: { partId: id } });
      if (purchaseLinks.length > 0) {
        await tx.partPurchaseLink.createMany({
          data: purchaseLinks.map((l, i) => ({
            partId: id,
            label: l.label,
            url: l.url,
            sortOrder: i,
          })),
        });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return { error: "Internal SKU must be unique." };
    }
    return { error: "Could not update part." };
  }
  const afterFull = await prisma.part.findUnique({
    where: { id },
    include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
  });
  if (beforeFull && afterFull) {
    await logAudit({
      userId: user.id,
      action: "UPDATE",
      model: "Part",
      recordId: id,
      recordName: afterFull.name,
      before: serializePart(beforeFull),
      after: serializePart(afterFull),
    });
  }
  revalidatePath("/parts");
  revalidatePath(`/parts/${id}/edit`);
  revalidatePath(`/parts/${id}`);
  revalidatePath(`/p/${existing.partNumber}`);
  revalidatePath("/admin/audit");
  redirect("/parts");
}

export async function deletePart(formData: FormData) {
  const user = await sessionUser();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return;
  }

  const existing = await prisma.part.findUnique({
    where: { id },
    include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
  });
  if (existing && user.role === Role.USER) {
    const ok = await mayEditCategory(user.id, user.role, existing.categoryId);
    if (!ok) {
      redirect("/parts");
    }
  }

  const pn = existing?.partNumber;
  if (existing) {
    await logAudit({
      userId: user.id,
      action: "DELETE",
      model: "Part",
      recordId: existing.id,
      recordName: existing.name,
      before: serializePart(existing),
    });
  }
  await prisma.part.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/parts");
  if (pn != null) {
    revalidatePath(`/p/${pn}`);
  }
  revalidatePath("/admin/audit");
  redirect("/parts");
}

/** Update Markdown description from the part detail page (no full-form redirect). */
export async function updatePartDescription(formData: FormData): Promise<{ error?: string }> {
  const user = await sessionUser();
  const parsed = partDescriptionOnlySchema.safeParse({
    partId: formData.get("partId"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const beforeFull = await prisma.part.findUnique({
    where: { id: parsed.data.partId },
    include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!beforeFull) {
    return { error: "Part not found." };
  }

  const allowed = await userCanEditPart(user.id, user.role, beforeFull.categoryId);
  if (!allowed) {
    return { error: "You cannot edit this part." };
  }

  const description =
    parsed.data.description.trim() === "" ? null : parsed.data.description;

  try {
    await prisma.part.update({
      where: { id: parsed.data.partId },
      data: { description },
    });
  } catch {
    return { error: "Could not save description." };
  }

  const afterFull = await prisma.part.findUnique({
    where: { id: parsed.data.partId },
    include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
  });
  if (afterFull) {
    await logAudit({
      userId: user.id,
      action: "UPDATE",
      model: "Part",
      recordId: afterFull.id,
      recordName: afterFull.name,
      before: serializePart(beforeFull),
      after: serializePart(afterFull),
    });
  }

  revalidatePath("/parts");
  revalidatePath(`/parts/${parsed.data.partId}`);
  revalidatePath(`/p/${beforeFull.partNumber}`);
  revalidatePath("/admin/audit");
  return {};
}

/** Update core fields from the parts list table (no purchase-link changes). */
export async function updatePartFromTable(
  input: Record<string, unknown>,
): Promise<{ error?: string }> {
  const user = await sessionUser();
  const parsed = partTableInlineUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  const { partId, ...data } = parsed.data;

  const beforeFull = await prisma.part.findUnique({
    where: { id: partId },
    include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!beforeFull) {
    return { error: "Part not found." };
  }

  const allowed = await userCanEditPart(user.id, user.role, beforeFull.categoryId);
  if (!allowed) {
    return { error: "You cannot edit this part." };
  }

  if (user.role === Role.USER) {
    if (!data.categoryId) {
      return { error: "Category is required." };
    }
    const oldOk = await mayEditCategory(user.id, user.role, beforeFull.categoryId);
    if (!oldOk) {
      return { error: "You cannot edit this part." };
    }
    const newOk = await mayEditCategory(user.id, user.role, data.categoryId);
    if (!newOk) {
      return { error: "You cannot move this part to that category." };
    }
  }

  try {
    await prisma.part.update({
      where: { id: partId },
      data: {
        name: data.name,
        internalSku: data.internalSku ?? null,
        quantityOnHand: data.quantityOnHand,
        unit: data.unit,
        categoryId: data.categoryId ?? null,
        defaultLocationId: data.defaultLocationId ?? null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return { error: "Internal SKU must be unique." };
    }
    return { error: "Could not update part." };
  }

  const afterFull = await prisma.part.findUnique({
    where: { id: partId },
    include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
  });
  if (afterFull) {
    await logAudit({
      userId: user.id,
      action: "UPDATE",
      model: "Part",
      recordId: partId,
      recordName: afterFull.name,
      before: serializePart(beforeFull),
      after: serializePart(afterFull),
    });
  }

  revalidatePath("/parts");
  revalidatePath(`/parts/${partId}`);
  revalidatePath(`/parts/${partId}/edit`);
  revalidatePath(`/p/${beforeFull.partNumber}`);
  revalidatePath("/admin/audit");
  return {};
}

export async function addPartImages(formData: FormData): Promise<{ error?: string }> {
  const user = await sessionUser();
  const partIdRaw = formData.get("partId");
  const partId = typeof partIdRaw === "string" ? partIdRaw.trim() : "";
  if (!partId) {
    return { error: "Missing part." };
  }

  const existing = await prisma.part.findUnique({ where: { id: partId } });
  if (!existing) {
    return { error: "Part not found." };
  }
  const allowed = await userCanEditPart(user.id, user.role, existing.categoryId);
  if (!allowed) {
    return { error: "You cannot edit this part." };
  }

  const rawFiles = formData.getAll("files");
  const files = rawFiles.filter(
    (f): f is File =>
      typeof f === "object" &&
      f !== null &&
      "arrayBuffer" in f &&
      "size" in f &&
      (f as File).size > 0,
  );

  if (files.length === 0) {
    return { error: "Choose one or more image files." };
  }

  const currentCount = await prisma.partImage.count({ where: { partId } });
  if (currentCount + files.length > MAX_PART_IMAGES) {
    return { error: `At most ${MAX_PART_IMAGES} images per part.` };
  }

  const dir = ensurePartAssetsDir(partId);
  const maxOrder = (
    await prisma.partImage.aggregate({
      where: { partId },
      _max: { sortOrder: true },
    })
  )._max.sortOrder;

  const baseOrder = maxOrder ?? -1;

  const rows: { partId: string; url: string; sortOrder: number }[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mime = file.type || "application/octet-stream";
      if (!isAllowedImageMime(mime)) {
        return {
          error: `Unsupported type: ${mime}. Use JPEG, PNG, GIF, or WebP.`,
        };
      }
      if (file.size > MAX_IMAGE_FILE_BYTES) {
        return { error: `Each file must be at most ${MAX_IMAGE_FILE_BYTES / (1024 * 1024)} MB.` };
      }
      const ext = extensionForMime(mime);
      if (!ext) {
        return { error: "Could not determine file extension." };
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
      const dest = path.join(dir, name);
      fs.writeFileSync(dest, buf);
      const url = `/part-assets/${partId}/${name}`;
      rows.push({ partId, url, sortOrder: baseOrder + 1 + i });
    }

    await prisma.partImage.createMany({ data: rows });
    await syncPartHeroFromGallery(prisma, partId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return { error: msg };
  }

  revalidatePath("/parts");
  revalidatePath(`/parts/${partId}/edit`);
  revalidatePath(`/parts/${partId}`);
  revalidatePath(`/p/${existing.partNumber}`);
  return {};
}

export async function deletePartImage(imageId: string): Promise<{ error?: string }> {
  const user = await sessionUser();
  const img = await prisma.partImage.findUnique({
    where: { id: imageId },
    include: { part: true },
  });
  if (!img) {
    return { error: "Image not found." };
  }
  const allowed = await userCanEditPart(user.id, user.role, img.part.categoryId);
  if (!allowed) {
    return { error: "You cannot edit this part." };
  }

  unlinkPartImageFile(img.url, img.partId);
  await prisma.partImage.delete({ where: { id: imageId } });
  await syncPartHeroFromGallery(prisma, img.partId);

  revalidatePath("/parts");
  revalidatePath(`/parts/${img.partId}/edit`);
  revalidatePath(`/parts/${img.partId}`);
  revalidatePath(`/p/${img.part.partNumber}`);
  return {};
}

export async function setPartCardImage(partId: string, imageId: string): Promise<{ error?: string }> {
  const user = await sessionUser();
  const existing = await prisma.part.findUnique({ where: { id: partId } });
  if (!existing) {
    return { error: "Part not found." };
  }
  const allowed = await userCanEditPart(user.id, user.role, existing.categoryId);
  if (!allowed) {
    return { error: "You cannot edit this part." };
  }
  const img = await prisma.partImage.findFirst({
    where: { id: imageId, partId },
  });
  if (!img) {
    return { error: "Image not found." };
  }
  await prisma.part.update({
    where: { id: partId },
    data: { imageUrl: img.url },
  });

  revalidatePath("/parts");
  revalidatePath(`/parts/${partId}/edit`);
  revalidatePath(`/parts/${partId}`);
  revalidatePath(`/p/${existing.partNumber}`);
  return {};
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
