import type { MappedReceiptLine, ProposedSplit, ReceiptLineParsed } from "./types";

export type ReceiptRuleRow = {
  id: string;
  matchText: string;
  ignore: boolean;
  categoryId: string | null;
  categoryName: string | null;
  sortOrder: number;
};

/** Common Gemini invents / abbreviations → budget category names. */
const HINT_ALIASES: Record<string, string> = {
  food: "Groceries",
  grocery: "Groceries",
  groceries: "Groceries",
  alimente: "Groceries",
  snacks: "Groceries",
  pet: "Pets",
  pets: "Pets",
  clothes: "Clothing",
  clothing: "Clothing",
  apparel: "Clothing",
  household: "Household Goods",
  "household goods": "Household Goods",
  home: "Household Goods",
  cleaning: "Household Goods",
  tools: "Tools",
  education: "Education",
  school: "Education",
  presents: "Presents",
  gifts: "Presents",
  gift: "Presents",
  lookfeel: "Look&Feel",
  "look & feel": "Look&Feel",
  "look and feel": "Look&Feel",
  beauty: "Look&Feel",
  unknown: "Unknown",
  other: "Unknown",
  misc: "Unknown",
};

function matchRule(
  description: string,
  rules: ReceiptRuleRow[],
): ReceiptRuleRow | null {
  const hay = description.toLowerCase();
  const sorted = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const rule of sorted) {
    if (hay.includes(rule.matchText.toLowerCase())) return rule;
  }
  return null;
}

function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[&]/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Resolve a Gemini categoryHint (or alias) to an existing budget category.
 * Never invents categories — only matches against `categoriesByName`.
 */
export function resolveCategoryForHint(
  hint: string | undefined | null,
  categoriesByName: Map<string, { id: string; name: string }>,
): { id: string; name: string } | null {
  if (!hint?.trim()) return null;

  const exact = categoriesByName.get(hint.trim());
  if (exact) return exact;

  const lower = hint.trim().toLowerCase();
  for (const [name, cat] of categoriesByName) {
    if (name.toLowerCase() === lower) return cat;
  }

  const key = normalizeKey(hint);
  const aliased = HINT_ALIASES[key];
  if (aliased) {
    const hit = categoriesByName.get(aliased);
    if (hit) return hit;
    for (const [name, cat] of categoriesByName) {
      if (name.toLowerCase() === aliased.toLowerCase()) return cat;
    }
  }

  // Contains / substring against category names (longer names first).
  const names = [...categoriesByName.keys()].sort(
    (a, b) => b.length - a.length,
  );
  for (const name of names) {
    const nk = normalizeKey(name);
    if (!nk) continue;
    if (key === nk || key.includes(nk) || nk.includes(key)) {
      return categoriesByName.get(name) ?? null;
    }
  }

  return null;
}

/** Pick Unknown → Groceries → first spending category in the map. */
export function pickFallbackCategory(
  categoriesByName: Map<string, { id: string; name: string }>,
  unknownCategoryId: string | null,
  unknownCategoryName: string,
): { id: string; name: string } | null {
  if (unknownCategoryId) {
    return { id: unknownCategoryId, name: unknownCategoryName };
  }
  const unknown = categoriesByName.get("Unknown");
  if (unknown) return unknown;
  const groceries = categoriesByName.get("Groceries");
  if (groceries) return groceries;
  for (const [, cat] of categoriesByName) {
    if (cat.name.toLowerCase() === "unknown") continue;
    return cat;
  }
  return null;
}

/** Map Gemini lines through ReceiptCategoryRule, then categoryHint, then fallback. */
export function mapReceiptLines(params: {
  lines: ReceiptLineParsed[];
  rules: ReceiptRuleRow[];
  categoriesByName: Map<string, { id: string; name: string }>;
  unknownCategoryId: string | null;
  unknownCategoryName: string;
}): MappedReceiptLine[] {
  const fallback = pickFallbackCategory(
    params.categoriesByName,
    params.unknownCategoryId,
    params.unknownCategoryName,
  );

  const mapped: MappedReceiptLine[] = [];
  for (const line of params.lines) {
    const amountCents = Math.round(line.amount * 100);
    const rule = matchRule(line.description, params.rules);
    if (rule?.ignore) {
      mapped.push({
        description: line.description,
        amountCents,
        categoryHint: line.categoryHint ?? null,
        categoryId: null,
        categoryName: null,
        matchedRuleId: rule.id,
        ignored: true,
      });
      continue;
    }

    let categoryId = rule?.categoryId ?? null;
    let categoryName = rule?.categoryName ?? null;
    let matchedRuleId = rule?.id ?? null;

    if (!categoryId) {
      const fromHint = resolveCategoryForHint(
        line.categoryHint,
        params.categoriesByName,
      );
      if (fromHint) {
        categoryId = fromHint.id;
        categoryName = fromHint.name;
      }
    }

    if (!categoryId && fallback) {
      categoryId = fallback.id;
      categoryName = fallback.name;
    }

    mapped.push({
      description: line.description,
      amountCents,
      categoryHint: line.categoryHint ?? null,
      categoryId,
      categoryName,
      matchedRuleId,
      ignored: false,
    });
  }
  return mapped;
}

/** Aggregate mapped product lines into one split per category. */
export function aggregateProposedSplits(
  lines: MappedReceiptLine[],
  expectedAbsCents: number,
): ProposedSplit[] {
  const byCat = new Map<
    string,
    { categoryName: string; amountCents: number; notes: string[] }
  >();

  for (const line of lines) {
    if (line.ignored || !line.categoryId || !line.categoryName) continue;
    const cur = byCat.get(line.categoryId) ?? {
      categoryName: line.categoryName,
      amountCents: 0,
      notes: [],
    };
    cur.amountCents += line.amountCents;
    if (cur.notes.length < 8) cur.notes.push(line.description);
    byCat.set(line.categoryId, cur);
  }

  let splits: ProposedSplit[] = [...byCat.entries()].map(
    ([categoryId, v]) => ({
      categoryId,
      categoryName: v.categoryName,
      amountCents: v.amountCents,
      notes: v.notes.join(", ").slice(0, 240),
    }),
  );

  const sum = splits.reduce((s, p) => s + p.amountCents, 0);
  const delta = expectedAbsCents - sum;
  if (delta !== 0 && splits.length > 0) {
    const groceries = splits.find((s) => s.categoryName === "Groceries");
    const target = groceries ?? splits[0];
    target.amountCents += delta;
    if (target.amountCents <= 0) {
      splits = splits.filter((s) => s.categoryId !== target.categoryId);
      if (splits.length === 0) {
        splits = [
          {
            ...target,
            amountCents: expectedAbsCents,
          },
        ];
      }
    }
  }

  return splits.filter((s) => s.amountCents > 0);
}
