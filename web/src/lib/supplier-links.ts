/** Build a search query for distributor sites (prefer MPN, then name + manufacturer). */
export function buildSupplierSearchQuery(part: {
  mpn: string | null;
  manufacturer: string | null;
  name: string;
}): string {
  const mpn = part.mpn?.trim();
  if (mpn) return mpn;
  const mfg = part.manufacturer?.trim();
  if (mfg) return `${part.name.trim()} ${mfg}`.trim();
  return part.name.trim();
}

/** TME catalog search (locale from env, default en). */
export function buildTmeSearchUrl(query: string): string {
  const q = query.trim();
  if (!q) return "https://www.tme.eu/";
  const locale = (process.env.NEXT_PUBLIC_TME_LOCALE ?? "en").replace(/[^a-z-]/gi, "") || "en";
  const url = new URL(`https://www.tme.eu/${locale}/katalog/`);
  url.searchParams.set("searchPhrase", q);
  return url.toString();
}

/** Farnell global product search — see [Farnell](https://www.farnell.com/). */
export function buildFarnellSearchUrl(query: string): string {
  const q = query.trim();
  if (!q) return "https://www.farnell.com/";
  const url = new URL("https://www.farnell.com/search");
  url.searchParams.set("st", q);
  return url.toString();
}
