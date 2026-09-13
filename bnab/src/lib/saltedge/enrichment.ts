/**
 * Optional AIS enrichment → Import rule *suggestions* only.
 * Never auto-create or bypass ImportCategoryRule (ADR 0003 / 0011).
 */

export type EnrichmentSuggestion = {
  matchText: string;
  reason: string;
  source: "merchant_id" | "saltedge_category" | "description";
  confidence: "low" | "medium" | "high";
};

export function suggestImportRuleFromEnrichment(params: {
  description: string;
  saltEdgeCategory?: string | null;
  extra?: Record<string, unknown> | null;
}): EnrichmentSuggestion | null {
  const extra = params.extra ?? null;
  const merchant =
    typeof extra?.merchant_id === "string" ? extra.merchant_id.trim() : "";
  if (merchant.length >= 3) {
    return {
      matchText: merchant.slice(0, 80),
      reason: "Salt Edge merchant_id",
      source: "merchant_id",
      confidence: "high",
    };
  }

  const cat = params.saltEdgeCategory?.trim();
  if (cat && cat.length >= 3 && !/^uncategorised$/i.test(cat)) {
    return {
      matchText: cat.slice(0, 80),
      reason: "Salt Edge category label (review before saving as Import rule)",
      source: "saltedge_category",
      confidence: "low",
    };
  }

  const desc = params.description.trim();
  const token = desc.split(/[\s|;]+/).find((t) => t.length >= 4);
  if (token) {
    return {
      matchText: token.slice(0, 80),
      reason: "First distinctive token from description",
      source: "description",
      confidence: "low",
    };
  }
  return null;
}
