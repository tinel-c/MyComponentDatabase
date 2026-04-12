import {
  buildFarnellSearchUrl,
  buildSupplierSearchQuery,
  buildTmeSearchUrl,
} from "@/lib/supplier-links";

type Props = {
  mpn: string | null;
  manufacturer: string | null;
  name: string;
  className?: string;
};

const linkClass =
  "inline-flex items-center gap-1.5 rounded-full border border-zinc-600/80 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:border-zinc-400 hover:bg-zinc-800/50";

export function PartSupplierLinks({ mpn, manufacturer, name, className }: Props) {
  const q = buildSupplierSearchQuery({ mpn, manufacturer, name });
  if (!q) return null;

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400/90">
        Distributor search
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={buildTmeSearchUrl(q)}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          TME
        </a>
        <a
          href={buildFarnellSearchUrl(q)}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          Farnell
        </a>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
        Opens catalog search for “{q}”. Product photos belong to suppliers; use image suggestions below
        for a generic picture, or paste a direct image URL.
      </p>
    </div>
  );
}
