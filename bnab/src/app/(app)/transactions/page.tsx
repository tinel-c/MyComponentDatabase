import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { ArrowLeftRight, Search, X } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { findFirstMatchingImportRule } from "@/lib/ing-import";
import { formatMoney, monthLabel } from "@/lib/money";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
  sectionHeadingClass,
  sectionSubheadingClass,
} from "@/components/forms/field-classes";
import { EmptyState } from "@/components/ui/EmptyState";
import { TransactionsRegister } from "@/components/transactions/TransactionsRegister";

const PAGE_SIZE = 50;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Flow = "income" | "spending";
type Dir = "in" | "out";

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

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    memo?: string;
    payee?: string;
    accountId?: string;
    categoryId?: string;
    groupId?: string;
    month?: string;
    flow?: string;
    dir?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const memo = (sp.memo ?? "").trim();
  const payee = (sp.payee ?? "").trim();
  const accountId = sp.accountId || undefined;
  const categoryId = sp.categoryId || undefined;
  const groupId = sp.groupId || undefined;
  const month =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : undefined;
  const flow: Flow | undefined =
    sp.flow === "income" || sp.flow === "spending" ? sp.flow : undefined;
  const dir: Dir | undefined =
    sp.dir === "in" || sp.dir === "out" ? sp.dir : undefined;
  const from = sp.from && ISO_DATE.test(sp.from) ? sp.from : undefined;
  const to = sp.to && ISO_DATE.test(sp.to) ? sp.to : undefined;
  const categoryActivityView = Boolean(categoryId && month);
  const groupActivityView = Boolean(groupId && month);
  const flowActivityView = Boolean(month && flow);
  const activityView =
    categoryActivityView || groupActivityView || flowActivityView;
  const pageNum = Math.max(1, Number(sp.page ?? "1") || 1);
  const skip = (pageNum - 1) * PAGE_SIZE;

  const [
    accounts,
    groups,
    payees,
    importRules,
    filterCategory,
    filterGroup,
    filterAccount,
  ] = await Promise.all([
    prisma.financeAccount.findMany({
      where: { budgetId: budget.id },
      orderBy: [{ closed: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, closed: true },
    }),
    prisma.categoryGroup.findMany({
      where: { budgetId: budget.id, hidden: false },
      orderBy: { sortOrder: "asc" },
      include: {
        categories: {
          where: { hidden: false },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.payee.findMany({
      where: { budgetId: budget.id },
      orderBy: { name: "asc" },
      take: 500,
      select: { name: true },
    }),
    prisma.importCategoryRule.findMany({
      where: { budgetId: budget.id },
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
    categoryId
      ? prisma.category.findFirst({
          where: { id: categoryId, group: { budgetId: budget.id } },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    groupId
      ? prisma.categoryGroup.findFirst({
          where: { id: groupId, budgetId: budget.id },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    accountId
      ? prisma.financeAccount.findFirst({
          where: { id: accountId, budgetId: budget.id },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  const dateFilter: Prisma.StringFilter | undefined =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

  const where: Prisma.TransactionWhereInput = activityView
    ? {
        isParent: false,
        transferTwinId: null,
        date: { gte: `${month}-01`, lte: `${month}-31` },
        account: {
          budgetId: budget.id,
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
      }
    : {
        isChild: false,
        account: {
          budgetId: budget.id,
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

  const [transactions, count, activitySum] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take: PAGE_SIZE,
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
    prisma.transaction.count({ where }),
    activityView
      ? prisma.transaction.aggregate({
          where,
          _sum: { amount: true },
        })
      : Promise.resolve(null),
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

  const hasMore = skip + transactions.length < count;
  const remaining = Math.max(0, count - skip - transactions.length);
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (memo) qs.set("memo", memo);
  if (payee) qs.set("payee", payee);
  if (accountId) qs.set("accountId", accountId);
  if (categoryId) qs.set("categoryId", categoryId);
  if (groupId) qs.set("groupId", groupId);
  if (month) qs.set("month", month);
  if (flow) qs.set("flow", flow);
  if (dir) qs.set("dir", dir);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  const rows = transactions.map((t) => {
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

  const sumCents = activitySum?._sum.amount ?? 0;
  const registerFiltered = Boolean(
    q || memo || payee || accountId || categoryId || dir || from || to,
  );
  const filtered = Boolean(registerFiltered || activityView);

  const activityTitle = (() => {
    if (!activityView || !month) return null;
    const parts: string[] = [];
    if (filterCategory) parts.push(filterCategory.name);
    else if (filterGroup) parts.push(filterGroup.name);
    else if (flow === "income") parts.push("Income");
    else if (flow === "spending") parts.push("Spending");
    if (filterAccount) parts.push(filterAccount.name);
    parts.push(monthLabel(month));
    return parts.join(" · ");
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={sectionHeadingClass}>Transactions</h1>
          <p className={sectionSubheadingClass}>
            {activityView && activityTitle
              ? `Activity for ${activityTitle}`
              : "Spreadsheet register — edit a cell, leave it to save."}{" "}
            {count} total
            {filtered && !activityView ? " (filtered)" : ""}.
          </p>
        </div>
        <Link
          href="/transactions/new"
          prefetch
          className={`${buttonPrimaryClass} w-full shrink-0 sm:w-auto`}
        >
          Add
        </Link>
      </div>

      {activityView ? (
        <div
          className={`${cardClass} flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between`}
        >
          <div>
            <p className="text-sm font-medium text-fg">{activityTitle}</p>
            <p className="mt-1 text-sm text-fg-muted">
              {count} transaction{count === 1 ? "" : "s"} · sum{" "}
              <span className="font-semibold tabular-nums text-fg">
                {formatMoney(sumCents, budget.currency)}
              </span>
              {" (matches Plan activity)"}
            </p>
          </div>
          <Link
            href="/transactions"
            className={`${buttonSecondaryClass} inline-flex items-center gap-2`}
          >
            <X className="size-4" />
            Clear filter
          </Link>
        </div>
      ) : (
        <form
          className={`${cardClass} grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 xl:items-end`}
        >
          <label className={`${labelClass} xl:col-span-2`}>
            Memo
            <input
              name="memo"
              defaultValue={memo}
              className={inputClass}
              placeholder="Contains…"
              autoComplete="off"
            />
          </label>
          <label className={labelClass}>
            Payee
            <input
              name="payee"
              defaultValue={payee}
              list="txn-filter-payees"
              className={inputClass}
              placeholder="Contains…"
              autoComplete="off"
            />
            <datalist id="txn-filter-payees">
              {payees.map((p) => (
                <option key={p.name} value={p.name} />
              ))}
            </datalist>
          </label>
          <label className={labelClass}>
            Cat
            <select
              name="categoryId"
              className={inputClass}
              defaultValue={categoryId ?? ""}
            >
              <option value="">All categories</option>
              {groups.map((g) => (
                <optgroup
                  key={g.id}
                  label={g.isIncome ? `${g.name} (In)` : g.name}
                >
                  {g.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Account
            <select
              name="accountId"
              className={inputClass}
              defaultValue={accountId ?? ""}
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.closed ? " (closed)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Direction
            <select name="dir" className={inputClass} defaultValue={dir ?? ""}>
              <option value="">In &amp; out</option>
              <option value="in">In only</option>
              <option value="out">Out only</option>
            </select>
          </label>
          <label className={labelClass}>
            From
            <input
              name="from"
              type="date"
              defaultValue={from ?? ""}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            To
            <input
              name="to"
              type="date"
              defaultValue={to ?? ""}
              className={inputClass}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-8">
            <button type="submit" className={buttonSecondaryClass}>
              <Search className="mr-2 size-4" />
              Filter
            </button>
            {registerFiltered ? (
              <Link href="/transactions" className={buttonSecondaryClass}>
                <X className="mr-2 size-4" />
                Clear
              </Link>
            ) : null}
          </div>
        </form>
      )}

      {transactions.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions found"
            description={
              filtered
                ? "Try clearing filters or add a new transaction."
                : "Add your first transaction to start the register."
            }
            action={
              <Link href="/transactions/new" className={buttonPrimaryClass}>
                Add transaction
              </Link>
            }
          />
        </div>
      ) : (
        <TransactionsRegister
          rows={rows}
          groups={groups.map((g) => ({
            id: g.id,
            name: g.name,
            isIncome: g.isIncome,
            categories: g.categories.map((c) => ({ id: c.id, name: c.name })),
          }))}
          payees={payees.map((p) => p.name)}
          currency={budget.currency}
        />
      )}

      {hasMore ? (
        <Link
          href={`/transactions?${qs.toString()}${qs.toString() ? "&" : ""}page=${pageNum + 1}`}
          className={`${buttonSecondaryClass} w-full`}
        >
          Next page · {remaining} remaining
        </Link>
      ) : null}
      {pageNum > 1 ? (
        <Link
          href={`/transactions?${qs.toString()}${qs.toString() ? "&" : ""}page=${pageNum - 1}`}
          className={`${buttonSecondaryClass} w-full`}
        >
          Previous page
        </Link>
      ) : null}
    </div>
  );
}
