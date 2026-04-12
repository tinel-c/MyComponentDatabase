/** Small list thumbnail: card URL or first gallery image URL. */
export function PartRowThumbnail({ imageUrl }: { imageUrl: string | null }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary user / app URLs
      <img
        src={imageUrl}
        alt=""
        width={40}
        height={40}
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200 bg-white object-contain p-0.5 dark:border-zinc-600 dark:bg-zinc-900"
      />
    );
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-100 text-lg leading-none text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500"
      aria-hidden
    >
      ⚙
    </div>
  );
}
