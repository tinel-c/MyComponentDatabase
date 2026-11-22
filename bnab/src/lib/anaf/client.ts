/**
 * ANAF public PlatitorTvaRest v9 — taxpayer lookup by CUI.
 * Docs: https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva
 * Limits: ≤100 CUIs / request, ≤1 request / second.
 */

export const ANAF_TVA_URL =
  "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";

export type AnafTaxpayerGeneral = {
  cui: number | string;
  denumire?: string;
  adresa?: string;
  nrRegCom?: string;
  cod_CAEN?: string;
  iban?: string;
  statusRO_e_Factura?: boolean;
  stare_inregistrare?: string;
};

export type AnafTaxpayerRecord = {
  date_generale?: AnafTaxpayerGeneral;
};

export type AnafLookupResult = {
  found: AnafTaxpayerRecord[];
  notFound: Array<number | string | { cui?: number | string }>;
};

type CacheEntry = { at: number; record: AnafTaxpayerRecord | null };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = 1100 - (now - lastRequestAt);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

function cacheKey(cui: string, date: string) {
  return `${cui}|${date}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Lookup one or more CUIs. Batches of ≤100 with 1 req/s throttle.
 * `fetchImpl` injectable for tests.
 */
export async function lookupTaxpayers(
  cuis: string[],
  opts?: {
    date?: string;
    fetchImpl?: typeof fetch;
    skipThrottle?: boolean;
  },
): Promise<Map<string, AnafTaxpayerRecord | null>> {
  const date = opts?.date ?? todayIso();
  const fetchFn = opts?.fetchImpl ?? fetch;
  const out = new Map<string, AnafTaxpayerRecord | null>();
  const unique = [...new Set(cuis.map((c) => String(Number(c.replace(/\D/g, "")))))].filter(
    (c) => c && c !== "NaN" && c !== "0",
  );

  const missing: string[] = [];
  for (const cui of unique) {
    const hit = cache.get(cacheKey(cui, date));
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      out.set(cui, hit.record);
    } else {
      missing.push(cui);
    }
  }

  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100);
    if (!opts?.skipThrottle) await throttle();
    const body = batch.map((cui) => ({ cui: Number(cui), data: date }));
    let json: AnafLookupResult;
    try {
      const res = await fetchFn(ANAF_TVA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        for (const cui of batch) {
          out.set(cui, null);
          cache.set(cacheKey(cui, date), { at: Date.now(), record: null });
        }
        continue;
      }
      json = (await res.json()) as AnafLookupResult;
    } catch {
      for (const cui of batch) {
        out.set(cui, null);
        cache.set(cacheKey(cui, date), { at: Date.now(), record: null });
      }
      continue;
    }

    const foundByCui = new Map<string, AnafTaxpayerRecord>();
    for (const rec of json.found ?? []) {
      const g = rec.date_generale;
      if (!g) continue;
      const key = String(Number(String(g.cui).replace(/\D/g, "")));
      foundByCui.set(key, rec);
    }

    for (const cui of batch) {
      const rec = foundByCui.get(cui) ?? null;
      out.set(cui, rec);
      cache.set(cacheKey(cui, date), { at: Date.now(), record: rec });
    }
  }

  return out;
}

/** Clear in-memory cache (tests). */
export function clearAnafCache(): void {
  cache.clear();
  lastRequestAt = 0;
}
