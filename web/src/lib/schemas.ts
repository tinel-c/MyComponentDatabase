import { z } from "zod";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  parentId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
});

export const categoryUpdateSchema = categoryCreateSchema.extend({
  id: z.string().cuid(),
});

export const storageLocationCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  parentId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
});

export const storageLocationUpdateSchema = storageLocationCreateSchema.extend({
  id: z.string().cuid(),
});

export const partCreateSchema = z.object({
  internalSku: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  name: z.string().trim().min(1, "Name is required").max(300),
  mpn: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  manufacturer: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
  quantityOnHand: z.coerce.number().int().min(0),
  reorderMin: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().int().min(0).optional(),
  ),
  unit: z.preprocess(
    (v) => (v === undefined || v === "" ? "pcs" : v),
    z.string().trim().min(1).max(32),
  ),
  categoryId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  defaultLocationId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
});

export const partUpdateSchema = partCreateSchema.extend({
  id: z.string().cuid(),
});

export type CategoryFormState = { error?: string; success?: boolean };
export type LocationFormState = CategoryFormState;
export type PartFormState = CategoryFormState;
