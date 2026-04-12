import { PartsReadOnlyTable } from "@/components/parts/PartsReadOnlyTable";
import { PartsFiltersSidebar } from "@/components/parts/PartsFiltersSidebar";
import { PartsPokemonGrid } from "@/components/parts/PartsPokemonGrid";
import type { PartCardModel } from "@/components/parts/PartPokemonCard";
import { partDescriptionForCard } from "@/components/parts/part-card-preview";
import { auth } from "@/auth";
import { expandVisibleCategoryIds, getVisibleCategoryIdsForUser, partVisibilityWhere } from "@/lib/authz";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  applyLowStockFilter,
  buildPartsCharacteristicWhere,
  fetchPartIdsWithImage,
  filterPartsByIdSet,
  hasActiveFilters,
  parsePartsFiltersFromSearchParams,
  partsFiltersHiddenFields,
  partsFiltersToSearchParams,
} from "@/lib/parts-filters";
import { prisma } from "@/lib/prisma";
import { flatTreeForSelect } from "@/lib/tree";
import type { Prisma } from "@/generated/prisma-client";
import { Role } from "@/generated/prisma-client";
import Link from "next/link";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PartsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isAdmin = session.user.role === Role.ADMIN;

  const raw = await searchParams;
  const f = parsePartsFiltersFromSearchParams(raw);

  const vis = await partVisibilityWhere(session.user.id, session.user.role);
  const numericQuery =
    f.q && /^\d+$/.test(f.q) ? Number.parseInt(f.q, 10) : Number.NaN;
  const searchWhere = f.q
    ? {
        OR: [
          { name: { contains: f.q } },
          { mpn: { contains: f.q } },
          { internalSku: { contains: f.q } },
          { manufacturer: { contains: f.q } },
          ...(Number.isFinite(numericQuery) ? [{ partNumber: numericQuery }] : []),
        ],
      }
    : undefined;

  const charWhere = buildPartsCharacteristicWhere(f);

  const pieces: Prisma.PartWhereInput[] = [];
  if (vis) pieces.push(vis);
  if (searchWhere) pieces.push(searchWhere);
  if (charWhere) pieces.push(charWhere);

  const where: Prisma.PartWhereInput | undefined =
    pieces.length === 0 ? undefined : pieces.length === 1 ? pieces[0] : { AND: pieces };

  /** Low-stock is applied in memory (two-field compare); fetch extra rows so filtering still fills the screen. */
  const take = f.lowOnly ? 1500 : 500;

  let parts = await prisma.part.findMany({
    where,
    include: {
      category: true,
      defaultLocation: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: { name: "asc" },
    take,
  });

  if (f.hasImage) {
    try {
      const withImg = await fetchPartIdsWithImage(prisma);
      parts = filterPartsByIdSet(parts, withImg);
    } catch {
      parts = [];
    }
  }

  parts = applyLowStockFilter(parts, f.lowOnly).slice(0, 500);

  const baseWhereDistinct: Prisma.PartWhereInput | undefined = vis ?? undefined;

  const [mfgGroups, unitGroups, allLocs] = await Promise.all([
    prisma.part.groupBy({
      by: ["manufacturer"],
      where: baseWhereDistinct
        ? { AND: [baseWhereDistinct, { manufacturer: { not: null } }] }
        : { manufacturer: { not: null } },
    }),
    prisma.part.groupBy({
      by: ["unit"],
      where: baseWhereDistinct ?? {},
    }),
    prisma.storageLocation.findMany({ orderBy: { name: "asc" } }),
  ]);

  const manufacturers = mfgGroups
    .map((g) => g.manufacturer)
    .filter((m): m is string => m != null)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const units = unitGroups
    .map((g) => g.unit)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const locationOptions = flatTreeForSelect(
    allLocs.map((l) => ({
      id: l.id,
      name: l.name,
      parentId: l.parentId,
    })),
  );
  const filterLocations = locationOptions.map((o) => ({ id: o.id, name: o.label }));

  let filterCategories: { id: string; name: string }[];

  if (isAdmin) {
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    filterCategories = flatTreeForSelect(
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId,
      })),
    ).map((o) => ({ id: o.id, name: o.label }));
  } else {
    const assigned = await getVisibleCategoryIdsForUser(session.user.id);
    const expanded = await expandVisibleCategoryIds(assigned);
    filterCategories =
      expanded.length === 0
        ? []
        : (
            await prisma.category.findMany({
              where: { id: { in: expanded } },
              orderBy: { name: "asc" },
            })
          ).map((c) => ({ id: c.id, name: c.name }));
  }

  const baseUrl = await getAppBaseUrl();

  const cardModels: PartCardModel[] = parts.map((p) => {
    const thumb = p.imageUrl ?? p.images[0]?.url ?? null;
    return {
      id: p.id,
      partNumber: p.partNumber,
      name: p.name,
      quantityOnHand: p.quantityOnHand,
      unit: p.unit,
      reorderMin: p.reorderMin,
      locationLabel: p.defaultLocation?.name ?? null,
      imageUrl: thumb,
      lowStock: p.reorderMin != null && p.quantityOnHand <= p.reorderMin,
      categoryName: p.category?.name ?? null,
      descriptionPreview: partDescriptionForCard(p.description, 8000),
      mpn: p.mpn,
      manufacturer: p.manufacturer,
      internalSku: p.internalSku,
    };
  });

  const tabBase = (v: "table" | "cards") => {
    const next = { ...f, view: v };
    const qs = partsFiltersToSearchParams(next).toString();
    return qs ? `/parts?${qs}` : "/parts";
  };

  const hiddenForSearch = partsFiltersHiddenFields(f);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Parts</h1>
          <p className="mt-1 text-sm text-zinc-400/90">
            {isAdmin
              ? "Search and filter by category, location, manufacturer, stock, and more."
              : "Only parts in categories assigned to you are listed."}
          </p>
        </div>
        <Link
          href="/parts/new"
          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          Add part
        </Link>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800/80 pb-4">
        <Link
          href={tabBase("table")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            f.view !== "cards"
              ? "bg-emerald-600 text-white shadow-sm shadow-black/30"
              : "text-zinc-400 hover:bg-zinc-900/50"
          }`}
        >
          Table
        </Link>
        <Link
          href={tabBase("cards")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            f.view === "cards"
              ? "bg-emerald-600 text-white shadow-sm shadow-black/30"
              : "text-zinc-400 hover:bg-zinc-900/50"
          }`}
        >
          Cards
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_minmax(240px,min(100%,300px))] lg:items-start lg:gap-6 xl:gap-8">
        <div className="min-w-0 space-y-6">
          <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {f.view === "cards" ? <input type="hidden" name="view" value="cards" /> : null}
            {hiddenForSearch.map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <label htmlFor="q" className="sr-only">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={f.q}
              placeholder="Search…"
              className="w-full max-w-md rounded-xl border border-zinc-700/80 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-50 shadow-sm outline-none placeholder:text-zinc-500/60 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30 sm:flex-1"
            />
            <button
              type="submit"
              className="rounded-full border border-zinc-700/80 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800/60"
            >
              Search
            </button>
          </form>

          {f.view === "cards" ? (
            <PartsPokemonGrid
              parts={cardModels}
              baseUrl={baseUrl}
              emptyMessage={
                cardModels.length === 0
                  ? f.q || hasActiveFilters(f)
                    ? "No matches."
                    : "No parts yet — add your first part."
                  : ""
              }
            />
          ) : (
            <PartsReadOnlyTable
              parts={cardModels}
              emptyMessage={
                f.q || hasActiveFilters(f)
                  ? "No matches."
                  : "No parts yet — add your first part."
              }
            />
          )}
        </div>

        <PartsFiltersSidebar
          categories={filterCategories}
          locations={filterLocations}
          manufacturers={manufacturers}
          units={units}
        />
      </div>
    </div>
  );
}
