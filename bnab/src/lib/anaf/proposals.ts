import { extractCuiFromMemo } from "./cui";
import { categoryNameForCaen } from "./caen-map";
import { lookupTaxpayers, type AnafTaxpayerRecord } from "./client";
import { suggestMatchSubstring, extractPayeeGuess } from "@/lib/ing-import/parse";

export type ImportCategoryProposal = {
  source: "anaf" | "heuristic";
  matchText: string;
  categoryId: string | null;
  categoryName: string | null;
  denumire: string | null;
  caen: string | null;
  cui: string | null;
  reason: string;
};

function resolveCategoryId(
  nameHint: string | null,
  categoriesByName: Map<string, { id: string; name: string }>,
): { id: string; name: string } | null {
  if (!nameHint) return null;
  const key = nameHint.trim().toLowerCase();
  return categoriesByName.get(key) ?? null;
}

function proposalFromAnaf(
  memo: string,
  cui: string,
  record: AnafTaxpayerRecord,
  categoriesByName: Map<string, { id: string; name: string }>,
): ImportCategoryProposal {
  const g = record.date_generale;
  const caen = g?.cod_CAEN?.trim() || null;
  const denumire = g?.denumire?.trim() || null;
  const nameHint = categoryNameForCaen(caen);
  const cat = resolveCategoryId(nameHint, categoriesByName);
  const matchFromName = denumire
    ? denumire.split(/\s+/).slice(0, 3).join(" ").slice(0, 60)
    : null;
  const matchText =
    (matchFromName && matchFromName.length >= 3
      ? matchFromName
      : suggestMatchSubstring(memo)) || suggestMatchSubstring(memo);

  return {
    source: "anaf",
    matchText,
    categoryId: cat?.id ?? null,
    categoryName: cat?.name ?? nameHint,
    denumire,
    caen,
    cui,
    reason: caen
      ? `ANAF CAEN ${caen}${denumire ? ` · ${denumire}` : ""}`
      : `ANAF taxpayer${denumire ? ` · ${denumire}` : ""}`,
  };
}

function heuristicProposal(
  memo: string,
  categoriesByName: Map<string, { id: string; name: string }>,
): ImportCategoryProposal {
  const matchText = suggestMatchSubstring(memo);
  const payee = extractPayeeGuess(memo);
  // Soft match: if payee token equals a known category name, use it
  const payeeKey = payee.trim().toLowerCase();
  const cat =
    categoriesByName.get(payeeKey) ??
    [...categoriesByName.values()].find((c) =>
      payeeKey.includes(c.name.toLowerCase()),
    ) ??
    null;

  return {
    source: "heuristic",
    matchText,
    categoryId: cat?.id ?? null,
    categoryName: cat?.name ?? null,
    denumire: null,
    caen: null,
    cui: null,
    reason: cat
      ? `Payee guess matches category ${cat.name}`
      : "Suggested match substring from memo (no CUI for ANAF)",
  };
}

/**
 * Build proposals for unmatched rows. Batches ANAF lookups for rows with CUI.
 */
export async function buildImportProposals(params: {
  rows: Array<{ fingerprint: string; memo: string; date: string }>;
  categories: Array<{ id: string; name: string }>;
  fetchImpl?: typeof fetch;
  skipThrottle?: boolean;
}): Promise<Map<string, ImportCategoryProposal>> {
  const categoriesByName = new Map(
    params.categories.map((c) => [c.name.trim().toLowerCase(), c]),
  );
  const out = new Map<string, ImportCategoryProposal>();

  const withCui: Array<{ fingerprint: string; memo: string; date: string; cui: string }> =
    [];
  for (const row of params.rows) {
    const cui = extractCuiFromMemo(row.memo);
    if (cui) withCui.push({ ...row, cui });
    else out.set(row.fingerprint, heuristicProposal(row.memo, categoriesByName));
  }

  if (withCui.length === 0) return out;

  // Group by date for ANAF date field (use txn date)
  const byDate = new Map<string, typeof withCui>();
  for (const row of withCui) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : new Date().toISOString().slice(0, 10);
    const list = byDate.get(d) ?? [];
    list.push(row);
    byDate.set(d, list);
  }

  for (const [date, group] of byDate) {
    const cuis = group.map((g) => g.cui);
    const found = await lookupTaxpayers(cuis, {
      date,
      fetchImpl: params.fetchImpl,
      skipThrottle: params.skipThrottle,
    });
    for (const row of group) {
      const rec = found.get(row.cui) ?? null;
      if (rec?.date_generale) {
        out.set(
          row.fingerprint,
          proposalFromAnaf(row.memo, row.cui, rec, categoriesByName),
        );
      } else {
        const h = heuristicProposal(row.memo, categoriesByName);
        out.set(row.fingerprint, {
          ...h,
          cui: row.cui,
          reason: `CUI ${row.cui} not found at ANAF — ${h.reason}`,
        });
      }
    }
  }

  return out;
}
