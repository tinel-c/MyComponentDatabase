import type { PrismaClient } from "@prisma/client";
import { isBillImportPendingNotes } from "@/lib/ing-import/overlap";
import { currentMonth } from "@/lib/money";

export type AccountActivitySummary = {
  accountId: string;
  accountName: string;
  accountType: string;
  month: string;
  billsImported: number;
  manualEntries: number;
  ingBatches: number;
  ingTxnCount: number;
};

/** Uppercase letter pool from a name: existing capitals, else first letter of each word. */
export function accountNameLetterSeed(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const caps = [...trimmed]
    .filter((c) => c >= "A" && c <= "Z")
    .join("");
  if (caps.length > 0) return caps;
  const words = trimmed.split(/[\s/_·.–-]+/).filter(Boolean);
  const initials = words
    .map((w) => {
      const ch = [...w].find((c) => /[A-Za-zÀ-ÿ]/.test(c));
      return ch ? ch.toUpperCase() : "";
    })
    .join("");
  if (initials.length > 0) return initials;
  const fallback = [...trimmed].find((c) => /[A-Za-zÀ-ÿ]/.test(c));
  return fallback ? fallback.toUpperCase() : "?";
}

/**
 * Short unique monograms for a set of accounts (collapsed rail labels).
 * Prefers 1–3 capital letters derived from each name; lengthens on collisions.
 */
export function uniqueAccountMonograms(
  accounts: { id: string; name: string }[],
): Record<string, string> {
  const seeds = accounts.map((a) => ({
    id: a.id,
    letters: accountNameLetterSeed(a.name),
  }));
  const used = new Set<string>();
  const out: Record<string, string> = {};

  for (const { id, letters } of seeds) {
    let assigned = "";
    const startLen = letters.length >= 2 ? 2 : 1;
    const maxLen = Math.min(3, Math.max(letters.length, startLen));
    for (let len = startLen; len <= maxLen; len++) {
      const cand = letters.slice(0, len);
      if (cand && !used.has(cand)) {
        assigned = cand;
        break;
      }
    }
    if (!assigned && startLen > 1) {
      const cand = letters.slice(0, 1);
      if (cand && !used.has(cand)) assigned = cand;
    }
    if (!assigned) {
      const base = letters.slice(0, 2) || "?";
      let n = 2;
      while (used.has(`${base}${n}`) && n < 99) n++;
      assigned = `${base}${n}`.slice(0, 3);
    }
    used.add(assigned);
    out[id] = assigned;
  }
  return out;
}

/**
 * Per finance-account activity for the current calendar month (desktop right rail).
 * Lean selects + groupBy for batches (no nested receiptScans include).
 */
export async function loadAccountActivitySummaries(
  prisma: PrismaClient,
  budgetId: string,
  month = currentMonth(),
): Promise<AccountActivitySummary[]> {
  const accounts = await prisma.financeAccount.findMany({
    where: { budgetId, closed: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, type: true },
  });
  if (accounts.length === 0) return [];

  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const nextMonth =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const batchFrom = new Date(`${monthStart}T00:00:00.000Z`);
  const batchTo = new Date(`${nextMonth}T00:00:00.000Z`);
  const accountIds = accounts.map((a) => a.id);

  const [txns, scanTxnIds, batchGroups] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        date: { gte: monthStart, lt: nextMonth },
        isChild: false,
      },
      select: {
        id: true,
        accountId: true,
        notes: true,
        importBatchId: true,
        importFingerprint: true,
        isPendingBill: true,
      },
    }),
    prisma.receiptScan.findMany({
      where: {
        budgetId,
        transactionId: { not: null },
        transaction: {
          accountId: { in: accountIds },
          date: { gte: monthStart, lt: nextMonth },
        },
      },
      select: { transactionId: true },
      distinct: ["transactionId"],
    }),
    prisma.importBatch.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accountIds },
        createdAt: { gte: batchFrom, lt: batchTo },
      },
      _count: { _all: true },
    }),
  ]);

  const hasScan = new Set(
    scanTxnIds.map((s) => s.transactionId).filter(Boolean) as string[],
  );
  const batchCount = new Map(
    batchGroups.map((b) => [b.accountId, b._count._all]),
  );

  return accounts.map((a) => {
    const rows = txns.filter((t) => t.accountId === a.id);
    let billsImported = 0;
    let manualEntries = 0;
    let ingTxnCount = 0;
    for (const t of rows) {
      const billish =
        t.isPendingBill ||
        isBillImportPendingNotes(t.notes) ||
        hasScan.has(t.id);
      if (billish) billsImported++;
      if (t.importFingerprint) ingTxnCount++;
      if (!t.importBatchId && !billish && !t.importFingerprint) {
        manualEntries++;
      }
    }
    return {
      accountId: a.id,
      accountName: a.name,
      accountType: a.type,
      month,
      billsImported,
      manualEntries,
      ingBatches: batchCount.get(a.id) ?? 0,
      ingTxnCount,
    };
  });
}
