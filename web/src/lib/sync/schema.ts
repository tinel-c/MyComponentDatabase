import { z } from "zod";

export const SYNC_PAYLOAD_VERSION = 1 as const;

/** ISO-8601 strings in JSON; import converts with `new Date(...)`. */
const isoDate = z.string().min(1);

export const categoryRowSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  parentId: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const storageLocationRowSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  parentId: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const partRowSchema = z.object({
  id: z.string().min(1),
  partNumber: z.number().int(),
  internalSku: z.string().nullable(),
  name: z.string(),
  mpn: z.string().nullable(),
  manufacturer: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  quantityOnHand: z.number().int(),
  reorderMin: z.number().int().nullable(),
  unit: z.string(),
  categoryId: z.string().nullable(),
  defaultLocationId: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const partPurchaseLinkRowSchema = z.object({
  id: z.string().min(1),
  partId: z.string().min(1),
  label: z.string(),
  url: z.string(),
  sortOrder: z.number().int(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const partImageRowSchema = z.object({
  id: z.string().min(1),
  partId: z.string().min(1),
  url: z.string(),
  sortOrder: z.number().int(),
  caption: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const inventoryPayloadSchema = z.object({
  version: z.literal(SYNC_PAYLOAD_VERSION),
  exportedAt: isoDate,
  mode: z.literal("inventory"),
  categories: z.array(categoryRowSchema),
  storageLocations: z.array(storageLocationRowSchema),
  parts: z.array(partRowSchema),
  partPurchaseLinks: z.array(partPurchaseLinkRowSchema),
  partImages: z.array(partImageRowSchema),
});

export type InventoryPayload = z.infer<typeof inventoryPayloadSchema>;
