import type { MappedReceiptLine, ProposedSplit, ReceiptLineParsed } from "./types";

export type ReceiptRuleRow = {
  id: string;
  matchText: string;
  ignore: boolean;
  categoryId: string | null;
  categoryName: string | null;
  sortOrder: number;
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

function resolveByHint(
  hint: string | undefined,
  categoriesByName: Map<string, { id: string; name: string }>,
): { id: string; name: string } | null {
  if (!hint) return null;
  const exact = categoriesByName.get(hint);
  if (exact) return exact;
  const lower = hint.toLowerCase();
  for (const [name, cat] of categoriesByName) {
    if (name.toLowerCase() === lower) return cat;
  }
  return null;
}

/** Map Gemini lines through ReceiptCategoryRule, then categoryHint fallback. */
export function mapReceiptLines(params: {
  lines: ReceiptLineParsed[];
  rules: ReceiptRuleRow[];
  categoriesByName: Map<string, { id: string; name: string }>;
  unknownCategoryId: string | null;
  unknownCategoryName: string;
}): MappedReceiptLine[] {
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
      const fromHint = resolveByHint(line.categoryHint, params.categoriesByName);
      if (fromHint) {
        categoryId = fromHint.id;
        categoryName = fromHint.name;
      }
    }

    if (!categoryId && params.unknownCategoryId) {
      categoryId = params.unknownCategoryId;
      categoryName = params.unknownCategoryName;
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
