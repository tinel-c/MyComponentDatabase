import type { ParsedIngRow } from "@/lib/ing-import/parse";
import {
  applyRules,
  importContentHash,
  importFingerprint,
  type AppliedRow,
  type ImportRuleLike,
} from "@/lib/ing-import/parse";
import type { SaltEdgeTransaction } from "./client";

export type NormalizedSaltEdgeRow = ParsedIngRow & {
  providerTransactionId: string;
  pending: boolean;
  rawDescription: string;
  saltEdgeCategory: string | null;
  extra: Record<string, unknown> | null;
};

/**
 * Convert a Salt Edge AIS transaction into the same shape CSV import uses.
 * Amounts: Salt Edge uses major units (float); BNAB uses minor units (int).
 * Sign: Salt Edge negative = money out → BNAB amount negative.
 */
export function saltEdgeTxnToParsedRow(
  txn: SaltEdgeTransaction,
): NormalizedSaltEdgeRow | null {
  const id = String(txn.id ?? "").trim();
  if (!id) return null;

  const madeOn = (txn.made_on ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(madeOn)) return null;

  const major = Number(txn.amount);
  if (!Number.isFinite(major)) return null;
  const amount = Math.round(major * 100);
  const outflowMinor = amount < 0 ? Math.abs(amount) : 0;
  const inflowMinor = amount > 0 ? amount : 0;

  const description = (txn.description ?? "").trim() || "Salt Edge transaction";
  const payeeGuess = guessPayee(description, txn.extra ?? null);

  return {
    date: madeOn,
    memo: description,
    payeeGuess,
    outflowMinor,
    inflowMinor,
    amount,
    providerTransactionId: id,
    pending: (txn.status ?? "").toLowerCase() === "pending",
    rawDescription: description,
    saltEdgeCategory: txn.category?.trim() || null,
    extra: txn.extra ?? null,
  };
}

function guessPayee(
  description: string,
  extra: Record<string, unknown> | null,
): string {
  const merchant =
    (typeof extra?.merchant_id === "string" && extra.merchant_id) ||
    (typeof extra?.payee === "string" && extra.payee) ||
    (typeof extra?.type === "string" && extra.type) ||
    null;
  if (merchant) return merchant.slice(0, 120);
  const first = description.split(/[\n|;]/)[0]?.trim() ?? description;
  return first.slice(0, 120) || "Unknown";
}

export type AppliedSaltEdgeRow = Omit<AppliedRow, "status" | "manualMatchId"> & {
  providerTransactionId: string;
  pending: boolean;
  saltEdgeCategory: string | null;
  status?: AppliedRow["status"];
  manualMatchId?: string | null;
};

export function applyRulesToSaltEdgeRows(
  rows: NormalizedSaltEdgeRow[],
  rules: ImportRuleLike[],
  accountId: string,
  categoryNameById: Map<string, string>,
): AppliedSaltEdgeRow[] {
  const parsed: ParsedIngRow[] = rows.map((r) => ({
    date: r.date,
    memo: r.memo,
    payeeGuess: r.payeeGuess,
    outflowMinor: r.outflowMinor,
    inflowMinor: r.inflowMinor,
    amount: r.amount,
  }));
  const applied = applyRules(parsed, rules, accountId, categoryNameById);
  return applied.map((row, i) => {
    const src = rows[i]!;
    // Prefer content fingerprint identical to CSV path for cross-source dedupe.
    const fingerprint = importFingerprint(
      accountId,
      row.date,
      row.amount,
      row.memo,
    );
    const contentHash = importContentHash({
      date: row.date,
      payee: row.payeeGuess,
      categoryName: row.categoryId
        ? (categoryNameById.get(row.categoryId) ?? "")
        : "",
      memo: row.memo,
      outflowMinor: row.outflowMinor,
      inflowMinor: row.inflowMinor,
    });
    return {
      ...row,
      fingerprint,
      contentHash,
      providerTransactionId: src.providerTransactionId,
      pending: src.pending,
      saltEdgeCategory: src.saltEdgeCategory,
    };
  });
}

export function normalizeSaltEdgeTransactions(
  txns: SaltEdgeTransaction[],
): NormalizedSaltEdgeRow[] {
  const out: NormalizedSaltEdgeRow[] = [];
  for (const t of txns) {
    const row = saltEdgeTxnToParsedRow(t);
    if (row) out.push(row);
  }
  return out;
}
