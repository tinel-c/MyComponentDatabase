/**
 * Extract a Romanian CUI/CIF from free text (ING memo, invoice notes).
 * ANAF lookups require a numeric CUI — name search is not available.
 */

const CUI_PATTERNS: RegExp[] = [
  /\b(?:CUI|CIF|Cod\s*fiscal)[:\s]*R?O?\s*(\d{2,10})\b/i,
  /\bRO\s*(\d{6,10})\b/i,
  /\b(?:CUI|CIF)\s+(\d{2,10})\b/i,
];

/** Digits-only CUI, stripping leading RO / country prefix. */
export function normalizeCui(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 2 || digits.length > 10) return null;
  // Reject obvious IBANs / card fragments that slipped through
  if (digits.length > 10) return null;
  return String(Number(digits)); // drop leading zeros for ANAF
}

/** First plausible CUI found in memo text. */
export function extractCuiFromMemo(memo: string): string | null {
  const text = memo.replace(/\s+/g, " ");
  for (const re of CUI_PATTERNS) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const cui = normalizeCui(m[1]);
    if (cui) return cui;
  }
  return null;
}
