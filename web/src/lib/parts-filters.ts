import { Prisma, type PrismaClient } from "@prisma/client";

export type PartsFilterState = {
  q: string;
  view: "table" | "cards";
  categoryIds: string[];
  locationIds: string[];
  /** Exact manufacturer match (from dropdown). */
  manufacturer: string | null;
  /** Exact unit match. */
  unit: string | null;
  hasImage: boolean;
  /** Low stock: qty at or below reorder threshold (applied after DB query). */
  lowOnly: boolean;
  qtyMin: number | null;
  qtyMax: number | null;
  pnMin: number | null;
  pnMax: number | null;
};

function parseCsv(s: string | undefined): string[] {
  if (!s?.trim()) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseIntOpt(s: string | undefined): number | null {
  if (s === undefined || s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function first(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (v === undefined) return "";
  if (Array.isArray(v)) return v[0] ?? "";
  return v;
}

export function parsePartsFiltersFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): PartsFilterState {
  const q = first(sp, "q").trim();
  const view = first(sp, "view") === "cards" ? "cards" : "table";
  const cat = first(sp, "cat");
  const loc = first(sp, "loc");
  const mfgRaw = first(sp, "mfg").trim();
  const unitRaw = first(sp, "unit").trim();
  const mfg = mfgRaw ? mfgRaw : null;
  const unit = unitRaw ? unitRaw : null;
  const hasImg = first(sp, "hasImg");
  const lowV = first(sp, "low");
  const hasImage = hasImg === "1" || hasImg === "true";
  const lowOnly = lowV === "1" || lowV === "true";

  return {
    q,
    view,
    categoryIds: parseCsv(cat),
    locationIds: parseCsv(loc),
    manufacturer: mfg,
    unit,
    hasImage,
    lowOnly,
    qtyMin: parseIntOpt(first(sp, "qtyMin") || undefined),
    qtyMax: parseIntOpt(first(sp, "qtyMax") || undefined),
    pnMin: parseIntOpt(first(sp, "pnMin") || undefined),
    pnMax: parseIntOpt(first(sp, "pnMax") || undefined),
  };
}

/** Build Prisma where fragments (without visibility / text search). Low-stock is handled separately. */
export function buildPartsCharacteristicWhere(
  f: PartsFilterState,
): Prisma.PartWhereInput | undefined {
  const parts: Prisma.PartWhereInput[] = [];

  if (f.categoryIds.length > 0) {
    parts.push({ categoryId: { in: f.categoryIds } });
  }
  if (f.locationIds.length > 0) {
    parts.push({ defaultLocationId: { in: f.locationIds } });
  }
  if (f.manufacturer) {
    parts.push({ manufacturer: f.manufacturer });
  }
  if (f.unit) {
    parts.push({ unit: f.unit });
  }
  /** `hasImage` is applied in page.tsx via raw SQL + id filter — avoids Prisma client/schema drift on `imageUrl`. */
  if (f.qtyMin != null) {
    parts.push({ quantityOnHand: { gte: f.qtyMin } });
  }
  if (f.qtyMax != null) {
    parts.push({ quantityOnHand: { lte: f.qtyMax } });
  }
  if (f.pnMin != null) {
    parts.push({ partNumber: { gte: f.pnMin } });
  }
  if (f.pnMax != null) {
    parts.push({ partNumber: { lte: f.pnMax } });
  }

  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : { AND: parts };
}

export function applyLowStockFilter<T extends { reorderMin: number | null; quantityOnHand: number }>(
  rows: T[],
  lowOnly: boolean,
): T[] {
  if (!lowOnly) return rows;
  return rows.filter(
    (p) => p.reorderMin != null && p.quantityOnHand <= p.reorderMin,
  );
}

/** Part ids that have a non-empty image URL (SQLite). */
export async function fetchPartIdsWithImage(prisma: PrismaClient): Promise<Set<string>> {
  const [urlRows, galleryGroups] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM Part WHERE "imageUrl" IS NOT NULL AND length(trim("imageUrl")) > 0`,
    ),
    prisma.partImage.groupBy({ by: ["partId"] }),
  ]);
  const set = new Set<string>();
  for (const r of urlRows) {
    set.add(r.id);
  }
  for (const g of galleryGroups) {
    set.add(g.partId);
  }
  return set;
}

export function filterPartsByIdSet<T extends { id: string }>(rows: T[], ids: Set<string>): T[] {
  return rows.filter((p) => ids.has(p.id));
}

export function hasActiveFilters(f: PartsFilterState): boolean {
  return (
    f.categoryIds.length > 0 ||
    f.locationIds.length > 0 ||
    f.manufacturer != null ||
    f.unit != null ||
    f.hasImage ||
    f.lowOnly ||
    f.qtyMin != null ||
    f.qtyMax != null ||
    f.pnMin != null ||
    f.pnMax != null
  );
}

/** Serialize filters for `/parts?…` (omits defaults). */
export function partsFiltersToSearchParams(f: PartsFilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.view === "cards") p.set("view", "cards");
  if (f.categoryIds.length) p.set("cat", f.categoryIds.join(","));
  if (f.locationIds.length) p.set("loc", f.locationIds.join(","));
  if (f.manufacturer) p.set("mfg", f.manufacturer);
  if (f.unit) p.set("unit", f.unit);
  if (f.hasImage) p.set("hasImg", "1");
  if (f.lowOnly) p.set("low", "1");
  if (f.qtyMin != null) p.set("qtyMin", String(f.qtyMin));
  if (f.qtyMax != null) p.set("qtyMax", String(f.qtyMax));
  if (f.pnMin != null) p.set("pnMin", String(f.pnMin));
  if (f.pnMax != null) p.set("pnMax", String(f.pnMax));
  return p;
}

/** Hidden fields for GET search form (preserves filters; `q` comes from the text input). */
export function partsFiltersHiddenFields(f: PartsFilterState): [string, string][] {
  const p = partsFiltersToSearchParams({ ...f, q: "" });
  p.delete("q");
  return Array.from(p.entries());
}
