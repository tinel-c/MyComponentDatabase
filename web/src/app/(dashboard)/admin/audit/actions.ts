"use server";

import type {
  PartAuditPayload,
  UserAuditPayload,
} from "@/lib/audit";
import {
  logAudit,
  serializeCategory,
  serializePart,
  serializeStorageLocation,
  serializeUserForAudit,
} from "@/lib/audit";
import { requireAdmin } from "@/lib/authz";
import { normalizeEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function revertAuditEntry(
  auditId: string,
): Promise<{ error?: string }> {
  const session = await requireAdmin();

  const entry = await prisma.auditLog.findUnique({ where: { id: auditId } });
  if (!entry) {
    return { error: "Log entry not found." };
  }
  if (entry.reverted) {
    return { error: "This change was already reverted." };
  }
  if (entry.action !== "UPDATE") {
    return { error: "Only updates can be reverted." };
  }
  if (entry.before == null) {
    return { error: "No prior state stored for this entry." };
  }

  const recordId = entry.recordId;
  const model = entry.model;

  try {
    if (model === "Part") {
      const payload = entry.before as unknown as PartAuditPayload;
      const current = await prisma.part.findUnique({
        where: { id: recordId },
        include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
      });
      if (!current) {
        return { error: "Part no longer exists; cannot revert." };
      }

      await prisma.$transaction(async (tx) => {
        await tx.part.update({
          where: { id: recordId },
          data: {
            partNumber: payload.part.partNumber,
            internalSku: payload.part.internalSku,
            name: payload.part.name,
            mpn: payload.part.mpn,
            manufacturer: payload.part.manufacturer,
            description: payload.part.description,
            imageUrl: payload.part.imageUrl,
            quantityOnHand: payload.part.quantityOnHand,
            reorderMin: payload.part.reorderMin,
            unit: payload.part.unit,
            categoryId: payload.part.categoryId,
            defaultLocationId: payload.part.defaultLocationId,
            createdAt: new Date(payload.part.createdAt),
            updatedAt: new Date(payload.part.updatedAt),
          },
        });
        await tx.partPurchaseLink.deleteMany({ where: { partId: recordId } });
        if (payload.purchaseLinks.length > 0) {
          await tx.partPurchaseLink.createMany({
            data: payload.purchaseLinks.map((l) => ({
              partId: recordId,
              label: l.label,
              url: l.url,
              sortOrder: l.sortOrder,
            })),
          });
        }
      });

      const restored = await prisma.part.findUnique({
        where: { id: recordId },
        include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
      });
      if (!restored) {
        return { error: "Revert failed." };
      }

      await prisma.auditLog.update({
        where: { id: auditId },
        data: { reverted: true },
      });

      await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        model: "Part",
        recordId,
        recordName: restored.name,
        before: serializePart(current),
        after: serializePart(restored),
      });

      revalidatePath("/parts");
      revalidatePath(`/parts/${recordId}`);
      revalidatePath(`/p/${restored.partNumber}`);
      revalidatePath("/admin/audit");
      return {};
    }

    if (model === "Category") {
      const b = entry.before as Record<string, unknown>;
      const current = await prisma.category.findUnique({ where: { id: recordId } });
      if (!current) {
        return { error: "Category no longer exists; cannot revert." };
      }
      await prisma.category.update({
        where: { id: recordId },
        data: {
          name: b.name as string,
          parentId: (b.parentId as string | null) ?? null,
          createdAt: new Date(b.createdAt as string),
          updatedAt: new Date(b.updatedAt as string),
        },
      });
      const restored = await prisma.category.findUnique({ where: { id: recordId } });
      if (!restored) {
        return { error: "Revert failed." };
      }
      await prisma.auditLog.update({ where: { id: auditId }, data: { reverted: true } });
      await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        model: "Category",
        recordId,
        recordName: restored.name,
        before: serializeCategory(current),
        after: serializeCategory(restored),
      });
      revalidatePath("/categories");
      revalidatePath("/admin/audit");
      return {};
    }

    if (model === "StorageLocation") {
      const b = entry.before as Record<string, unknown>;
      const current = await prisma.storageLocation.findUnique({
        where: { id: recordId },
      });
      if (!current) {
        return { error: "Location no longer exists; cannot revert." };
      }
      await prisma.storageLocation.update({
        where: { id: recordId },
        data: {
          name: b.name as string,
          parentId: (b.parentId as string | null) ?? null,
          createdAt: new Date(b.createdAt as string),
          updatedAt: new Date(b.updatedAt as string),
        },
      });
      const restored = await prisma.storageLocation.findUnique({
        where: { id: recordId },
      });
      if (!restored) {
        return { error: "Revert failed." };
      }
      await prisma.auditLog.update({ where: { id: auditId }, data: { reverted: true } });
      await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        model: "StorageLocation",
        recordId,
        recordName: restored.name,
        before: serializeStorageLocation(current),
        after: serializeStorageLocation(restored),
      });
      revalidatePath("/locations");
      revalidatePath("/admin/audit");
      return {};
    }

    if (model === "User") {
      const payload = entry.before as unknown as UserAuditPayload;
      const current = await prisma.user.findUnique({
        where: { id: recordId },
        include: { categoryAccess: true },
      });
      if (!current) {
        return { error: "User no longer exists; cannot revert." };
      }
      if (session.user.id === recordId) {
        return { error: "You cannot revert changes to your own account here." };
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: recordId },
          data: {
            email: normalizeEmail(payload.user.email ?? ""),
            name: payload.user.name,
            role: payload.user.role as Role,
            image: payload.user.image,
            emailVerified: payload.user.emailVerified
              ? new Date(payload.user.emailVerified)
              : null,
          },
        });
        await tx.userCategoryAccess.deleteMany({ where: { userId: recordId } });
        if (
          payload.user.role === Role.USER &&
          payload.categoryIds.length > 0
        ) {
          await tx.userCategoryAccess.createMany({
            data: payload.categoryIds.map((categoryId) => ({
              userId: recordId,
              categoryId,
            })),
          });
        }
      });

      const restored = await prisma.user.findUnique({
        where: { id: recordId },
        include: { categoryAccess: true },
      });
      if (!restored) {
        return { error: "Revert failed." };
      }

      await prisma.auditLog.update({ where: { id: auditId }, data: { reverted: true } });
      await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        model: "User",
        recordId,
        recordName: restored.email ?? restored.name ?? recordId,
        before: serializeUserForAudit(current),
        after: serializeUserForAudit(restored),
      });
      revalidatePath("/admin/users");
      revalidatePath(`/admin/users/${recordId}/edit`);
      revalidatePath("/admin/audit");
      return {};
    }

    return { error: `Revert not implemented for model: ${model}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Revert failed.";
    return { error: msg };
  }
}

/**
 * Undo a CREATE audit entry by deleting the row that was inserted.
 * Marks the audit row as reverted. Foreign-key errors surface as the message.
 */
export async function undoCreateAuditEntry(
  auditId: string,
): Promise<{ error?: string }> {
  const session = await requireAdmin();
  const entry = await prisma.auditLog.findUnique({ where: { id: auditId } });
  if (!entry) {
    return { error: "Log entry not found." };
  }
  if (entry.reverted) {
    return { error: "This entry was already undone." };
  }
  if (entry.action !== "CREATE") {
    return { error: "Only create operations can be undone this way." };
  }

  const { recordId, model } = entry;

  try {
    if (model === "Part") {
      const p = await prisma.part.findUnique({ where: { id: recordId } });
      if (!p) {
        return { error: "That part no longer exists." };
      }
      const pn = p.partNumber;
      await prisma.part.delete({ where: { id: recordId } });
      await prisma.auditLog.update({
        where: { id: auditId },
        data: { reverted: true },
      });
      revalidatePath("/parts");
      revalidatePath(`/p/${pn}`);
      revalidatePath("/admin/audit");
      return {};
    }

    if (model === "Category") {
      await prisma.category.delete({ where: { id: recordId } });
      await prisma.auditLog.update({
        where: { id: auditId },
        data: { reverted: true },
      });
      revalidatePath("/categories");
      revalidatePath("/admin/audit");
      return {};
    }

    if (model === "StorageLocation") {
      await prisma.storageLocation.delete({ where: { id: recordId } });
      await prisma.auditLog.update({
        where: { id: auditId },
        data: { reverted: true },
      });
      revalidatePath("/locations");
      revalidatePath("/admin/audit");
      return {};
    }

    if (model === "User") {
      if (session.user.id === recordId) {
        return { error: "You cannot remove your own account here." };
      }
      await prisma.user.delete({ where: { id: recordId } });
      await prisma.auditLog.update({
        where: { id: auditId },
        data: { reverted: true },
      });
      revalidatePath("/admin/users");
      revalidatePath("/admin/audit");
      return {};
    }

    return { error: `Undo create is not implemented for ${model}.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Undo failed.";
    return { error: msg };
  }
}
