import { z } from "zod";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const emptyToNull = (v: unknown) =>
  v === "" ||
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "")
    ? null
    : v;

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
  description: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(100000, "Description is too long").optional(),
  ),
  imageUrl: z.preprocess(
    emptyToNull,
    z
      .union([z.string().trim().url("Enter a valid image URL").max(2000), z.null()])
      .optional(),
  ),
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
  /** Matches DB: new parts use cuids; seeded rows may use fixed ids like `seed-tme-lm358`. */
  id: z.string().trim().min(1).max(200),
});

/** Inline description save on part detail page (Markdown). */
export const partDescriptionOnlySchema = z.object({
  /** Part primary keys may be cuids or fixed seed ids (e.g. `seed-tme-lm358`). */
  partId: z.string().trim().min(1, "Part id is required").max(200),
  description: z.string().max(100000, "Description is too long"),
});

/** Inline edits from the parts list table (does not touch purchase links). */
export const partTableInlineUpdateSchema = z.object({
  partId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1, "Name is required").max(300),
  internalSku: z.preprocess(
    emptyToNull,
    z.union([z.string().trim().max(120), z.null()]).optional(),
  ),
  quantityOnHand: z.coerce.number().int().min(0),
  unit: z.string().trim().min(1).max(32),
  categoryId: z.preprocess(
    emptyToNull,
    z.union([z.string().trim().min(1).max(200), z.null()]).optional(),
  ),
  defaultLocationId: z.preprocess(
    emptyToNull,
    z.union([z.string().trim().min(1).max(200), z.null()]).optional(),
  ),
});

export type CategoryFormState = { error?: string; success?: boolean };
export type LocationFormState = CategoryFormState;
export type PartFormState = CategoryFormState;
