import type { PartImage } from "@prisma/client";

type Img = Pick<PartImage, "id" | "url" | "caption" | "sortOrder">;

export function PartImageGallery({ images }: { images: Img[] }) {
  if (!images.length) {
    return null;
  }
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {sorted.map((img) => (
        <figure
          key={img.id}
          className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-950/50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local /public assets */}
          <img
            src={img.url}
            alt={img.caption ?? ""}
            className="mx-auto max-h-48 w-full object-contain p-2 sm:max-h-64 lg:max-h-72"
            loading="lazy"
          />
          {img.caption ? (
            <figcaption className="border-t border-zinc-200 px-2 py-1.5 text-center text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              {img.caption}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
