import type { Prisma } from "@prisma/client";
import { findFirstMatchingImportRule } from "@/lib/ing-import";
import {
  dateIdCursorOr,
  decodeListCursor,
  LIST_PAGE_SIZE,
  nextCursorFromRows,
} from "@/lib/list-cursor";
import { prisma } from "@/lib/prisma";
import type { RegisterRow } from "@/components/transactions/TransactionsRegister";

export type TransactionsListFilters = {
  q?: string;
  memo?: string;
  payee?: string;
  accountId?: string;
  categoryId?: string;
  groupId?: string;
  month?: string;
  flow?: "income" | "spending";
  dir?: "in" | "out";
  from?: string;
  to?: string;
};

function ruleHref(
  base: "/more/import-rules" | "/more/receipt-rules",
  rule: { id: string; matchText: string },
) {
  const params = new URLSearchParams({
    rule: rule.id,
    q: rule.matchText,
  });
  return `${base}?${params.toString()}`;
}

function merchantFromRaw(rawJson: string | null): string | null {
  if (!rawJson) return null;
  try {
    const obj = JSON.parse(rawJson) as { merchant?: unknown };
    return typeof obj.merchant === "string" && obj.merchant.trim()
      ? obj.merchant.trim()
      : null;
  } catch {
    return null;
  }
}

export function buildTransactionsWhere(
  budgetId: string,
  filters: TransactionsListFilters,
): Prisma.TransactionWhereInput {
  const {
    q,
    memo,
    payee,
    accountId,
    categoryId,
    groupId,
    month,
    flow,
    dir,
    from,
    to,
  } = filters;

  const categoryActivityView = Boolean(categoryId && month);
  const groupActivityView = Boolean(groupId && month);
  const flowActivityView = Boolean(month && flow);
  const activityView =
    categoryActivityView || groupActivityView || flowActivityView;

  const dateFilter: Prisma.StringFilter | undefined =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

  if (activityView) {
    return {
      isParent: false,
      transferTwinId: null,
      date: { gte: `${month}-01`, lte: `${month}-31` },
      account: {
        budgetId,
        onBudget: true,
        ...(accountId ? { id: accountId } : {}),
      },
      ...(categoryId
        ? { categoryId }
        : groupId
          ? { category: { groupId } }
          : flow === "income"
            ? {
                OR: [
                  { category: { isIncome: true } },
                  { categoryId: null },
                  { isStartingBalance: true },
                ],
              }
            : flow === "spending"
              ? { category: { isIncome: false } }
              : {}),
    };
  }

  return {
    isChild: false,
    account: {
      budgetId,
      ...(accountId ? { id: accountId } : {}),
    },
    ...(categoryId ? { categoryId } : {}),
    ...(payee ? { payee: { name: { contains: payee } } } : {}),
    ...(memo ? { notes: { contains: memo } } : {}),
    ...(dir === "in"
      ? { amount: { gt: 0 } }
      : dir === "out"
        ? { amount: { lt: 0 } }
        : {}),
    ...(dateFilter ? { date: dateFilter } : {}),
    ...(q
      ? {
          OR: [
            { notes: { contains: q } },
            { payee: { name: { contains: q } } },
            { category: { name: { contains: q } } },
            { account: { name: { contains: q } } },
          ],
        }
      : {}),
  };
}

export async function fetchTransactionsRegisterChunk(opts: {
  budgetId: string;
  where: Prisma.TransactionWhereInput;
  cursor?: string | null;
  take?: number;
}): Promise<{
  items: RegisterRow[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const take = opts.take ?? LIST_PAGE_SIZE;
  const decoded = decodeListCursor(opts.cursor);
  const where: Prisma.TransactionWhereInput = decoded
    ? { AND: [opts.where, { OR: dateIdCursorOr(decoded) }] }
    : opts.where;

  const [transactions, importRules] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take,
      select: {
        id: true,
        accountId: true,
        date: true,
        amount: true,
        categoryId: true,
        notes: true,
        cleared: true,
        isParent: true,
        isChild: true,
        transferTwinId: true,
        payee: { select: { name: true } },
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
    }),
    prisma.importCategoryRule.findMany({
      where: { budgetId: opts.budgetId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        matchText: true,
        categoryId: true,
        transferAccountId: true,
        ignore: true,
        sortOrder: true,
      },
    }),
  ]);

  const twinIds = transactions
    .map((t) => t.transferTwinId)
    .filter((id): id is string => Boolean(id));
  const txnIds = transactions.map((t) => t.id);
  const parentIds = transactions.filter((t) => t.isParent).map((t) => t.id);

  const [twins, receiptLines, children, linkedScans] = await Promise.all([
    twinIds.length > 0
      ? prisma.transaction.findMany({
          where: { id: { in: twinIds } },
          select: { id: true, account: { select: { name: true } } },
        })
      : Promise.resolve([]),
    txnIds.length > 0
      ? prisma.receiptScanLine.findMany({
          where: {
            matchedRuleId: { not: null },
            scan: { transactionId: { in: txnIds } },
          },
          select: {
            matchedRuleId: true,
            matchedRule: { select: { id: true, matchText: true } },
            scan: { select: { transactionId: true } },
          },
        })
      : Promise.resolve([]),
    parentIds.length > 0
      ? prisma.transaction.findMany({
          where: { parentId: { in: parentIds } },
          select: {
            id: true,
            parentId: true,
            amount: true,
            notes: true,
            category: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    txnIds.length > 0
      ? prisma.receiptScan.findMany({
          where: { transactionId: { in: txnIds } },
          select: { id: true, transactionId: true, rawJson: true },
        })
      : Promise.resolve([]),
  ]);

  const twinById = new Map(twins.map((t) => [t.id, t]));
  const childrenByParent = new Map<string, typeof children>();
  for (const c of children) {
    if (!c.parentId) continue;
    const list = childrenByParent.get(c.parentId) ?? [];
    list.push(c);
    childrenByParent.set(c.parentId, list);
  }
  const scanByTxn = new Map(
    linkedScans
      .filter((s) => s.transactionId)
      .map((s) => [s.transactionId as string, s]),
  );

  const receiptRulesByTxn = new Map<
    string,
    { id: string; matchText: string }[]
  >();
  for (const line of receiptLines) {
    const txnId = line.scan.transactionId;
    const rule = line.matchedRule;
    if (!txnId || !rule) continue;
    const list = receiptRulesByTxn.get(txnId) ?? [];
    if (!list.some((r) => r.id === rule.id)) {
      list.push({ id: rule.id, matchText: rule.matchText });
      receiptRulesByTxn.set(txnId, list);
    }
  }

  const items: RegisterRow[] = transactions.map((t) => {
    const twin = t.transferTwinId ? twinById.get(t.transferTwinId) : null;
    const isTransfer = Boolean(t.transferTwinId);
    const notes = t.notes ?? "";
    const importMatch =
      notes.trim().length > 0
        ? findFirstMatchingImportRule(notes, importRules, t.accountId)
        : null;
    const receiptMatches = receiptRulesByTxn.get(t.id) ?? [];
    const kids = childrenByParent.get(t.id) ?? [];
    const scan = scanByTxn.get(t.id);
    const billGroup =
      kids.length > 0
        ? {
            merchant: merchantFromRaw(scan?.rawJson ?? null),
            scanId: scan?.id ?? null,
            splits: kids.map((c) => ({
              id: c.id,
              categoryName: c.category?.name ?? "—",
              amountDisplay: (Math.abs(c.amount) / 100).toFixed(2),
              notes: c.notes,
            })),
          }
        : null;
    return {
      id: t.id,
      accountId: t.accountId,
      accountName: t.account.name,
      date: t.date,
      payee: t.payee?.name ?? "",
      categoryId: t.categoryId ?? "",
      notes,
      cleared: t.cleared,
      absAmount: (Math.abs(t.amount) / 100).toFixed(2),
      isInflow: t.amount > 0,
      isSplit: t.isParent || t.isChild,
      isTransfer,
      transferLabel: twin?.account.name ?? null,
      matchedImportRule: importMatch
        ? {
            id: importMatch.id,
            matchText: importMatch.matchText,
            href: ruleHref("/more/import-rules", importMatch),
          }
        : null,
      matchedReceiptRules: receiptMatches.map((r) => ({
        ...r,
        href: ruleHref("/more/receipt-rules", r),
      })),
      billGroup,
    };
  });

  const { nextCursor, hasMore } = nextCursorFromRows(items, take);
  return { items, nextCursor, hasMore };
}
