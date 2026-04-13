import { prisma } from "@/lib/prisma";
import { SYNC_PAYLOAD_VERSION, type InventoryPayload } from "./schema";

function iso(d: Date): string {
  return d.toISOString();
}

export async function exportInventory(): Promise<InventoryPayload> {
  const [categories, storageLocations, parts, partPurchaseLinks, partImages] = await Promise.all([
    prisma.category.findMany(),
    prisma.storageLocation.findMany(),
    prisma.part.findMany(),
    prisma.partPurchaseLink.findMany(),
    prisma.partImage.findMany(),
  ]);

  return {
    version: SYNC_PAYLOAD_VERSION,
    exportedAt: iso(new Date()),
    mode: "inventory",
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      createdAt: iso(c.createdAt),
      updatedAt: iso(c.updatedAt),
    })),
    storageLocations: storageLocations.map((s) => ({
      id: s.id,
      name: s.name,
      parentId: s.parentId,
      createdAt: iso(s.createdAt),
      updatedAt: iso(s.updatedAt),
    })),
    parts: parts.map((p) => ({
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
      createdAt: iso(p.createdAt),
      updatedAt: iso(p.updatedAt),
    })),
    partPurchaseLinks: partPurchaseLinks.map((l) => ({
      id: l.id,
      partId: l.partId,
      label: l.label,
      url: l.url,
      sortOrder: l.sortOrder,
      createdAt: iso(l.createdAt),
      updatedAt: iso(l.updatedAt),
    })),
    partImages: partImages.map((im) => ({
      id: im.id,
      partId: im.partId,
      url: im.url,
      sortOrder: im.sortOrder,
      caption: im.caption,
      createdAt: iso(im.createdAt),
      updatedAt: iso(im.updatedAt),
    })),
  };
}
