import { createHash } from "node:crypto";

export type ParsedIngRow = {
  date: string; // YYYY-MM-DD
  memo: string;
  payeeGuess: string;
  outflowMinor: number;
  inflowMinor: number;
  /** Signed amount in minor units (outflow negative). */
  amount: number;
};

export type ImportRuleLike = {
  id: string;
  matchText: string;
  categoryId: string | null;
  ignore: boolean;
  sortOrder: number;
};

export type AppliedRow = ParsedIngRow & {
  fingerprint: string;
  contentHash: string;
  categoryId: string | null;
  matchedRuleId: string | null;
  ignored: boolean;
  status:
    | "new"
    | "already_imported"
    | "ignored"
    | "unmatched"
    | "possible_manual_match";
  manualMatchId?: string | null;
  suggestedSubstring: string;
};

const RO_MONTHS: Record<string, string> = {
  ianuarie: "01",
  februarie: "02",
  martie: "03",
  aprilie: "04",
  mai: "05",
  iunie: "06",
  iulie: "07",
  august: "08",
  septembrie: "09",
  octombrie: "10",
  noiembrie: "11",
  decembrie: "12",
};

const CLEAN_MARKERS: { col: number; text: string }[] = [
  { col: 0, text: "Titular cont" },
  { col: 0, text: "Sold initial" },
  { col: 0, text: "Sold final " },
  { col: 0, text: "CNP:" },
  { col: 0, text: "Str." },
  { col: 0, text: "Date" },
  { col: 1, text: "Data" },
  { col: 1, text: "Roxana Petria" },
  { col: 1, text: "Serviciu Dezvoltare" },
  { col: 2, text: "ING Bank N.V. Amsterdam" },
  { col: 2, text: "Sucursala Buc" },
  { col: 0, text: "Eliberat pentru" },
];

/** Parse Romanian amount "1.820,88" or "114,17" → minor units. */
export function parseIngAmount(raw: string): number {
  const s = raw.trim().replace(/\s/g, "").replace(/"/g, "");
  if (!s) return 0;
  // thousands `.`, decimal `,`
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(/,/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function parseIngDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  let s = t;
  for (const [name, num] of Object.entries(RO_MONTHS)) {
    s = s.replace(new RegExp(`\\s${name}\\s`, "i"), `/${num}/`);
  }
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    return `${m[3]}-${m[2]}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

export function normalizeMemo(memo: string): string {
  return memo.replace(/\s+/g, " ").trim();
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function importFingerprint(
  accountId: string,
  date: string,
  amountMinor: number,
  memo: string,
): string {
  return sha256Hex(
    `${accountId}|${date}|${amountMinor}|${normalizeMemo(memo)}`,
  );
}

export function importContentHash(row: {
  date: string;
  payee: string;
  categoryName: string;
  memo: string;
  outflowMinor: number;
  inflowMinor: number;
}): string {
  const outflow = (row.outflowMinor / 100).toFixed(2);
  const inflow = (row.inflowMinor / 100).toFixed(2);
  return sha256Hex(
    [
      row.date,
      row.payee,
      row.categoryName,
      normalizeMemo(row.memo),
      outflow,
      inflow,
    ].join("|"),
  );
}

/** Extract merchant from Terminal: / Tranzactie la: lines. */
export function extractPayeeGuess(memo: string): string {
  const terminal = memo.match(/Terminal:\s*([^]+?)(?:\s{2,}|\sRO\s|$)/i);
  const tranz = memo.match(/Tranzactie la:\s*([^]+?)(?:\s{2,}|\sRO\s|$)/i);
  const raw = (terminal?.[1] ?? tranz?.[1] ?? "").trim();
  if (raw) {
    // Take first chunk before country / excess spaces
    return raw.split(/\s{2,}/)[0].trim().slice(0, 80) || "Unknown";
  }
  // First non-empty detail word sequence
  const first = memo.split(/\s{2,}|\n/).map((x) => x.trim()).find(Boolean);
  return (first ?? "Unknown").slice(0, 80);
}

/** Suggest a substring for creating a new mapping rule. */
export function suggestMatchSubstring(memo: string): string {
  const payee = extractPayeeGuess(memo);
  if (payee && payee !== "Unknown" && payee.length >= 3) {
    // Prefer a stable token (first 2–3 words, capped)
    const words = payee.split(/\s+/).filter(Boolean);
    const guess = words.slice(0, 3).join(" ");
    if (guess.length >= 3) return guess.slice(0, 60);
  }
  const tokens = normalizeMemo(memo)
    .split(/[\s,;*]+/)
    .filter((t) => t.length >= 4 && !/^\d+$/.test(t));
  tokens.sort((a, b) => b.length - a.length);
  return (tokens[0] ?? normalizeMemo(memo).slice(0, 24)).slice(0, 60);
}

function shouldSkipCsvRow(cols: string[]): boolean {
  for (const { col, text } of CLEAN_MARKERS) {
    const cell = cols[col] ?? "";
    if (cell.includes(text)) return true;
  }
  return false;
}

/** Minimal CSV split that respects quoted fields (ING uses quotes for amounts). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Parse raw HomeBank ING CSV into collapsed transaction rows.
 * Columns: Date=0, Details=3, Debit=6, Credit=8.
 */
function pushCollapsed(
  results: ParsedIngRow[],
  current: {
    dateRaw: string;
    details: string[];
    debit: string;
    credit: string;
  },
) {
  const memo = normalizeMemo(current.details.join(" "));
  const date = parseIngDate(current.dateRaw);
  if (!date || !memo) return;
  const outflowMinor = parseIngAmount(current.debit);
  const inflowMinor = parseIngAmount(current.credit);
  if (outflowMinor === 0 && inflowMinor === 0) return;
  results.push({
    date,
    memo,
    payeeGuess: extractPayeeGuess(memo),
    outflowMinor,
    inflowMinor,
    amount: inflowMinor > 0 ? inflowMinor : -outflowMinor,
  });
}

/**
 * Parse raw HomeBank ING CSV into collapsed transaction rows.
 * Columns: Date=0, Details=3, Debit=6, Credit=8.
 */
export function parseIngCsv(csvText: string): ParsedIngRow[] {
  const lines = csvText.split(/\r?\n/);
  type Acc = {
    dateRaw: string;
    details: string[];
    debit: string;
    credit: string;
  };
  let current: Acc | null = null;
  const results: ParsedIngRow[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = splitCsvLine(line);
    while (cols.length < 9) cols.push("");

    if (shouldSkipCsvRow(cols)) continue;

    const dateCell = (cols[0] ?? "").trim();
    const details = (cols[3] ?? "").trim();
    const debit = (cols[6] ?? "").trim();
    const credit = (cols[8] ?? "").trim();

    if (dateCell.includes("Sold ini")) break;

    if (dateCell) {
      if (current) pushCollapsed(results, current);
      current = {
        dateRaw: dateCell,
        details: details ? [details] : [],
        debit,
        credit,
      };
    } else if (current) {
      if (details) current.details.push(details);
      if (debit && !current.debit) current.debit = debit;
      if (credit && !current.credit) current.credit = credit;
    }
  }

  if (current) pushCollapsed(results, current);
  return results;
}

export function applyRules(
  rows: ParsedIngRow[],
  rules: ImportRuleLike[],
  accountId: string,
  categoryNameById: Map<string, string>,
): Omit<AppliedRow, "status" | "manualMatchId">[] {
  const ordered = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
  return rows.map((row) => {
    let categoryId: string | null = null;
    let matchedRuleId: string | null = null;
    let ignored = false;
    for (const rule of ordered) {
      if (!rule.matchText) continue;
      if (row.memo.includes(rule.matchText)) {
        matchedRuleId = rule.id;
        if (rule.ignore) {
          ignored = true;
          categoryId = null;
        } else {
          categoryId = rule.categoryId;
        }
        break;
      }
    }
    const categoryName =
      categoryId && categoryNameById.get(categoryId)
        ? categoryNameById.get(categoryId)!
        : "";
    const fingerprint = importFingerprint(
      accountId,
      row.date,
      row.amount,
      row.memo,
    );
    const contentHash = importContentHash({
      date: row.date,
      payee: row.payeeGuess,
      categoryName,
      memo: row.memo,
      outflowMinor: row.outflowMinor,
      inflowMinor: row.inflowMinor,
    });
    return {
      ...row,
      fingerprint,
      contentHash,
      categoryId,
      matchedRuleId,
      ignored,
      suggestedSubstring: suggestMatchSubstring(row.memo),
    };
  });
}

export function dayOffset(iso: string, delta: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function findManualMatch(
  row: { date: string; amount: number; memo?: string },
  manuals: {
    id: string;
    date: string;
    amount: number;
    notes: string | null;
    payeeName?: string | null;
  }[],
): string | null {
  const absRow = Math.abs(row.amount);
  const memoLower = (row.memo ?? "").toLowerCase();
  const scored = manuals
    .map((m) => {
      if (Math.abs(Math.abs(m.amount) - absRow) > 2) return null;
      if (
        m.date < dayOffset(row.date, -3) ||
        m.date > dayOffset(row.date, 3)
      ) {
        return null;
      }
      const dayDiff = Math.abs(
        (Date.parse(m.date) - Date.parse(row.date)) / 86_400_000,
      );
      let score = 100 - dayDiff * 12;
      const payee = (m.payeeName ?? "").toLowerCase().trim();
      if (payee && memoLower.includes(payee)) score += 25;
      else if (payee && payee.length >= 4) {
        const token = payee.slice(0, Math.min(8, payee.length));
        if (memoLower.includes(token)) score += 12;
      }
      if (m.notes?.toLowerCase().includes("bill import")) score += 15;
      return { id: m.id, score };
    })
    .filter((x): x is { id: string; score: number } => Boolean(x))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  if (scored.length === 1) return scored[0].id;
  // Ambiguous: only auto-pick when clearly ahead; otherwise force a human choice
  if (scored[0].score >= scored[1].score + 15) return scored[0].id;
  return null;
}
