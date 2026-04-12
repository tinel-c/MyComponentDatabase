import { PartDescriptionInline } from "@/components/parts/PartDescriptionInline";
import { PartImageGallery } from "@/components/parts/PartImageGallery";
import { PartSupplierLinks } from "@/components/parts/PartSupplierLinks";
import type { Category, Part, PartImage, PartPurchaseLink, StorageLocation } from "@prisma/client";
import Link from "next/link";

export type PartDetailModel = Part & {
  category: Category | null;
  defaultLocation: StorageLocation | null;
  purchaseLinks?: PartPurchaseLink[];
  images?: PartImage[];
};

type Props = {
  part: PartDetailModel;
  /** Absolute URL shown as the short / share link (e.g. …/p/42 or …/parts/{id} if no part number). */
  shortLinkUrl: string;
  /** When true, description can be edited inline on this page (Markdown). */
  canEditDescription?: boolean;
};

export function PartDetailView({ part, shortLinkUrl, canEditDescription = false }: Props) {
  const low = part.reorderMin != null && part.quantityOnHand <= part.reorderMin;
  const gallerySorted = part.images
    ? [...part.images].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];
  const heroImageSrc = part.imageUrl ?? gallerySorted[0]?.url ?? null;
  /**
   * Photos under Description: all album images when the header uses a different `imageUrl`;
   * otherwise skip the first file (already in the header). Single-file parts: gallery only in the header.
   */
  const descriptionGalleryImages =
    gallerySorted.length === 0
      ? []
      : gallerySorted.length === 1
        ? []
        : heroImageSrc && gallerySorted[0]?.url === heroImageSrc
          ? gallerySorted.slice(1)
          : gallerySorted;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 sm:space-y-8">
      <nav>
        <Link
          href="/parts"
          className="text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:underline"
        >
          ← Parts
        </Link>
      </nav>

      <header className="overflow-hidden rounded-2xl border border-zinc-600/40 bg-gradient-to-br from-zinc-950/95 via-zinc-900/80 to-zinc-950/70 p-4 shadow-lg shadow-black/30 sm:rounded-3xl sm:p-6 lg:p-8 xl:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6 lg:gap-8 xl:gap-10">
          <div className="mx-auto shrink-0 sm:mx-0">
            {heroImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImageSrc}
                alt=""
                className="h-28 w-28 rounded-2xl border-2 border-zinc-500/50 bg-zinc-950/50 object-contain p-1.5 shadow-md sm:h-36 sm:w-36 sm:p-2 lg:h-44 lg:w-44 xl:h-48 xl:w-48"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-600/40 bg-zinc-950/60 text-4xl text-zinc-600/80 sm:h-36 sm:w-36 sm:text-5xl lg:h-44 lg:w-44 xl:h-48 xl:w-48">
                ⚙
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
            <p className="font-mono text-xs text-zinc-400 sm:text-sm">
              {part.partNumber != null ? `Part #${part.partNumber}` : "Part (no public #)"}
            </p>
            <h1 className="text-balance text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl xl:text-4xl">
              {part.name}
            </h1>
            {low ? (
              <span className="inline-block rounded-full bg-amber-500/25 px-3 py-0.5 text-xs font-semibold text-amber-100 ring-1 ring-amber-500/35">
                Low stock
              </span>
            ) : null}
            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3 xl:gap-x-6">
              <div>
                <dt className="text-zinc-500/90">On hand</dt>
                <dd className="font-semibold text-zinc-50">
                  {part.quantityOnHand} {part.unit}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500/90">Location</dt>
                <dd className="font-semibold text-zinc-50">
                  {part.defaultLocation?.name ?? "—"}
                </dd>
              </div>
              {part.internalSku ? (
                <div>
                  <dt className="text-zinc-500/90">SKU</dt>
                  <dd className="font-mono text-zinc-50">{part.internalSku}</dd>
                </div>
              ) : null}
              {part.category ? (
                <div>
                  <dt className="text-zinc-500/90">Category</dt>
                  <dd className="text-zinc-50">{part.category.name}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </header>

      {part.purchaseLinks && part.purchaseLinks.length > 0 ? (
        <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400/90">
            Where to buy
          </h2>
          <ul className="mt-3 space-y-3">
            {[...part.purchaseLinks]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((link) => (
                <li key={link.id} className="min-w-0">
                  <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-medium text-zinc-400 hover:text-zinc-200 hover:underline"
                    >
                      {link.label}
                    </a>
                    <span className="break-all text-xs text-zinc-500/80">{link.url}</span>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <PartDescriptionInline
        partId={part.id}
        initialDescription={part.description}
        canEdit={canEditDescription}
        imageGallery={
          descriptionGalleryImages.length > 0 ? (
            <PartImageGallery images={descriptionGalleryImages} />
          ) : undefined
        }
      />

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 sm:p-6">
        <PartSupplierLinks mpn={part.mpn} manufacturer={part.manufacturer} name={part.name} />
      </section>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-200">Short link</h2>
        <p className="mt-1 break-all font-mono text-sm text-zinc-300/95">{shortLinkUrl}</p>
        <Link
          href={`/parts/${part.id}/edit`}
          className="mt-4 inline-flex text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:underline"
        >
          Edit this part →
        </Link>
      </section>
    </div>
  );
}
