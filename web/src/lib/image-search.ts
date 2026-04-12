export type ImageCandidate = {
  url: string;
  thumbUrl: string;
  title: string;
  source: "commons" | "google";
};

function isHttpsUrl(u: string): boolean {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

/** Wikimedia Commons — no API key; good generic “internet” thumbnails. */
async function searchCommons(query: string, limit: number): Promise<ImageCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", q);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", String(Math.min(limit, 25)));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|thumburl");
  url.searchParams.set("iiurlwidth", "240");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "MyComponentDatabase/1.0 (inventory app; image search)",
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          imageinfo?: Array<{ url?: string; thumburl?: string; mime?: string }>;
        }
      >;
    };
  };

  const pages = data.query?.pages;
  if (!pages) return [];

  const out: ImageCandidate[] = [];
  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    const mime = info?.mime ?? "";
    if (!mime.startsWith("image/") || mime.includes("svg")) continue;
    const full = info?.url;
    const thumb = info?.thumburl ?? full;
    if (!full || !thumb || !isHttpsUrl(full)) continue;
    out.push({
      url: full,
      thumbUrl: thumb,
      title: page.title?.replace(/^File:/, "") ?? "Image",
      source: "commons",
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Optional: Google Programmable Search Engine (image search). Set GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID. */
async function searchGoogleCse(query: string, limit: number): Promise<ImageCandidate[]> {
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", q);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", String(Math.min(limit, 10)));
  url.searchParams.set("safe", "active");

  const res = await fetch(url.toString(), { next: { revalidate: 600 } });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    items?: Array<{ title?: string; link?: string; image?: { thumbnailLink?: string } }>;
  };

  const out: ImageCandidate[] = [];
  for (const item of data.items ?? []) {
    const full = item.link;
    if (!full || !isHttpsUrl(full)) continue;
    out.push({
      url: full,
      thumbUrl: item.image?.thumbnailLink ?? full,
      title: item.title ?? "Image",
      source: "google",
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Returns image URL candidates from the open web (Commons) and optionally Google CSE.
 * Does not scrape TME/Farnell HTML (fragile / ToS); use supplier links for those catalogs.
 */
export async function searchPartImageCandidates(
  query: string,
  maxTotal = 12,
): Promise<ImageCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const half = Math.ceil(maxTotal / 2);
  const [commons, google] = await Promise.all([
    searchCommons(q, maxTotal),
    searchGoogleCse(q, half),
  ]);

  const seen = new Set<string>();
  const merged: ImageCandidate[] = [];
  for (const c of [...google, ...commons]) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    merged.push(c);
    if (merged.length >= maxTotal) break;
  }
  return merged;
}
