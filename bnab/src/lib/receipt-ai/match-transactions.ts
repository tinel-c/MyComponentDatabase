import type { PrismaClient } from "@prisma/client";
import { addDaysISO } from "@/lib/money";

export type TxnMatchCandidate = {
  id: string;
  date: string;
  amount: number;
  payee: string | null;
  accountName: string;
  notes: string | null;
  alreadySplit: boolean;
  score: number;
};

function amountClose(a: number, b: number, tol = 2): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) <= tol;
}

/** Find outflow bank rows that could belong to this receipt total/date. */
export async function findTransactionsForReceipt(params: {
  prisma: PrismaClient;
  budgetId: string;
  amountCents: number;
  receiptDate?: string | null;
  /** Extra rows for manual pick when auto-match fails */
  includeRecentFallback?: boolean;
}): Promise<{
  exact: TxnMatchCandidate[];
  nearby: TxnMatchCandidate[];
  autoMatchId: string | null;
}> {
  const abs = Math.abs(params.amountCents);
  const date = params.receiptDate?.match(/^\d{4}-\d{2}-\d{2}$/)
    ? params.receiptDate
    : null;

  let dateFrom = "2000-01-01";
  let dateTo = "2100-12-31";
  if (date) {
    dateFrom = addDaysISO(date, -3);
    dateTo = addDaysISO(date, 3);
  }

  const rows = await params.prisma.transaction.findMany({
    where: {
      account: { budgetId: params.budgetId, onBudget: true },
      isChild: false,
      transferTwinId: null,
      amount: { lt: 0 },
      date: { gte: dateFrom, lte: dateTo },
    },
    include: {
      payee: { select: { name: true } },
      account: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  const exact: TxnMatchCandidate[] = [];
  for (const t of rows) {
    if (!amountClose(t.amount, abs)) continue;
    let score = 100;
    if (date) {
      const dayDiff = Math.abs(
        (Date.parse(t.date) - Date.parse(date)) / 86_400_000,
      );
      score -= dayDiff * 10;
    }
    exact.push({
      id: t.id,
      date: t.date,
      amount: t.amount,
      payee: t.payee?.name ?? null,
      accountName: t.account.name,
      notes: t.notes,
      alreadySplit: t.isParent,
      score,
    });
  }
  exact.sort((a, b) => b.score - a.score);

  let nearby: TxnMatchCandidate[] = [];
  if (params.includeRecentFallback !== false && exact.length !== 1) {
    const recent = await params.prisma.transaction.findMany({
      where: {
        account: { budgetId: params.budgetId, onBudget: true },
        isChild: false,
        transferTwinId: null,
        amount: { lt: 0 },
      },
      include: {
        payee: { select: { name: true } },
        account: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 40,
    });
    const exactIds = new Set(exact.map((e) => e.id));
    nearby = recent
      .filter((t) => !exactIds.has(t.id))
      .map((t) => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
        payee: t.payee?.name ?? null,
        accountName: t.account.name,
        notes: t.notes,
        alreadySplit: t.isParent,
        score: amountClose(t.amount, abs) ? 50 : 0,
      }));
  }

  const autoMatchId =
    exact.length === 1 && exact[0].score >= 70 ? exact[0].id : null;

  return { exact, nearby, autoMatchId };
}
