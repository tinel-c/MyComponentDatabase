import { prisma } from "@/lib/prisma";
import { inventoryPayloadSchema, type InventoryPayload } from "./schema";
import { topologicalSortForest } from "./trees";

export class SyncImportError extends Error {
  constructor(
    message: string,
    public readonly code: "VALIDATION" | "CONFLICT" | "TREE",
  ) {
    super(message);
    this.name = "SyncImportError";
  }
}

function assertForestParentsInPayload<T extends { id: string; parentId: string | null }>(
  label: string,
  items: T[],
): void {
  const ids = new Set(items.map((x) => x.id));
  for (const item of items) {
    const p = item.parentId;
    if (p != null && !ids.has(p)) {
      throw new SyncImportError(
        `${label}: parentId "${p}" is not in the payload (record id "${item.id}").`,
        "TREE",
      );
    }
  }
}

/** Fail fast when `partNumber` or `internalSku` already maps to another row id. */
async function assertNoUniqueConflicts(payload: InventoryPayload): Promise<void> {
  const partNumbers = [...new Set(payload.parts.map((p) => p.partNumber))];
  if (partNumbers.length > 0) {
    const byPn = await prisma.part.findMany({
      where: { partNumber: { in: partNumbers } },
      select: { id: true, partNumber: true },
    });
    const map = new Map(byPn.map((r) => [r.partNumber, r.id]));
    for (const p of payload.parts) {
      const existing = map.get(p.partNumber);
      if (existing !== undefined && existing !== p.id) {
        throw new SyncImportError(
          `partNumber ${p.partNumber} already belongs to id "${existing}", cannot merge id "${p.id}".`,
          "CONFLICT",
        );
      }
    }
  }

  const skus = [
    ...new Set(
      payload.parts.map((p) => p.internalSku).filter((s): s is string => s != null && s !== ""),
    ),
  ];
  if (skus.length > 0) {
    const bySku = await prisma.part.findMany({
      where: { internalSku: { in: skus } },
      select: { id: true, internalSku: true },
    });
    const map = new Map(bySku.map((r) => [r.internalSku!, r.id]));
    for (const p of payload.parts) {
      if (p.internalSku == null || p.internalSku === "") continue;
      const existing = map.get(p.internalSku);
      if (existing !== undefined && existing !== p.id) {
        throw new SyncImportError(
          `internalSku "${p.internalSku}" already belongs to id "${existing}", cannot merge id "${p.id}".`,
          "CONFLICT",
        );
      }
    }
  }
}

export function parseInventoryPayload(body: unknown): InventoryPayload {
  const parsed = inventoryPayloadSchema.safeParse(body);
  if (!parsed.success) {
    throw new SyncImportError(parsed.error.message, "VALIDATION");
  }
  return parsed.data;
}

export async function importInventoryMerge(payload: InventoryPayload): Promise<{
  summary: Record<string, number>;
}> {
  assertForestParentsInPayload("categories", payload.categories);
  assertForestParentsInPayload("storageLocations", payload.storageLocations);

  let catOrder: typeof payload.categories;
  let locOrder: typeof payload.storageLocations;
  try {
    catOrder = topologicalSortForest(payload.categories);
    locOrder = topologicalSortForest(payload.storageLocations);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new SyncImportError(msg, "TREE");
  }

  await assertNoUniqueConflicts(payload);

  await prisma.$transaction(async (tx) => {
    for (const c of catOrder) {
      await tx.category.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          name: c.name,
          parentId: c.parentId,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        },
        update: {
          name: c.name,
          parentId: c.parentId,
          updatedAt: new Date(c.updatedAt),
        },
      });
    }

    for (const s of locOrder) {
      await tx.storageLocation.upsert({
        where: { id: s.id },
        create: {
          id: s.id,
          name: s.name,
          parentId: s.parentId,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        },
        update: {
          name: s.name,
          parentId: s.parentId,
          updatedAt: new Date(s.updatedAt),
        },
      });
    }

    for (const p of payload.parts) {
      await tx.part.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          partNumber: p.partNumber,
          internalSku: p.internalSku,
          name: p.name,
          mpn: p.mpn,
          manufacturer: p.manufacturer,
          description: p.description,
          imageUrl: p.imageUrl,
          quantityOnHand: p.quantityOnHand,
          reorderMin: p.reorderMin,
          unit: p.unit,
          categoryId: p.categoryId,
          defaultLocationId: p.defaultLocationId,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        },
        update: {
          partNumber: p.partNumber,
          internalSku: p.internalSku,
          name: p.name,
          mpn: p.mpn,
          manufacturer: p.manufacturer,
          description: p.description,
          imageUrl: p.imageUrl,
          quantityOnHand: p.quantityOnHand,
          reorderMin: p.reorderMin,
          unit: p.unit,
          categoryId: p.categoryId,
          defaultLocationId: p.defaultLocationId,
          updatedAt: new Date(p.updatedAt),
        },
      });
    }

    for (const l of payload.partPurchaseLinks) {
      await tx.partPurchaseLink.upsert({
        where: { id: l.id },
        create: {
          id: l.id,
          partId: l.partId,
          label: l.label,
          url: l.url,
          sortOrder: l.sortOrder,
          createdAt: new Date(l.createdAt),
          updatedAt: new Date(l.updatedAt),
        },
        update: {
          partId: l.partId,
          label: l.label,
          url: l.url,
          sortOrder: l.sortOrder,
          updatedAt: new Date(l.updatedAt),
        },
      });
    }

    for (const im of payload.partImages) {
      await tx.partImage.upsert({
        where: { id: im.id },
        create: {
          id: im.id,
          partId: im.partId,
          url: im.url,
          sortOrder: im.sortOrder,
          caption: im.caption,
          createdAt: new Date(im.createdAt),
          updatedAt: new Date(im.updatedAt),
        },
        update: {
          partId: im.partId,
          url: im.url,
          sortOrder: im.sortOrder,
          caption: im.caption,
          updatedAt: new Date(im.updatedAt),
        },
      });
    }
  });

  return {
    summary: {
      categories: payload.categories.length,
      storageLocations: payload.storageLocations.length,
      parts: payload.parts.length,
      partPurchaseLinks: payload.partPurchaseLinks.length,
      partImages: payload.partImages.length,
    },
  };
}
