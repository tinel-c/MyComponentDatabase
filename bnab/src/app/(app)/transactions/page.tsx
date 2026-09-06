import Link from "next/link";
import { ArrowLeftRight, Search, X } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
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

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    accountId?: string;
    categoryId?: string;
    month?: string;
    page?: string;
  }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const accountId = sp.accountId || undefined;
  const categoryId = sp.categoryId || undefined;
  const month =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : undefined;
  const activityView = Boolean(categoryId && month);
  const pageNum = Math.max(1, Number(sp.page ?? "1") || 1);
  const take = pageNum * PAGE_SIZE;

  const [accounts, groups, payees, filterCategory] = await Promise.all([
    prisma.financeAccount.findMany({
      where: { budgetId: budget.id },
      orderBy: [{ closed: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.categoryGroup.findMany({
      where: { budgetId: budget.id, hidden: false },
      orderBy: { sortOrder: "asc" },
      include: {
        categories: { where: { hidden: false }, orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.payee.findMany({
      where: { budgetId: budget.id },
      orderBy: { name: "asc" },
      take: 100,
      select: { name: true },
    }),
    categoryId
      ? prisma.category.findFirst({
          where: { id: categoryId, group: { budgetId: budget.id } },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  const where = activityView
    ? {
        isParent: false,
        categoryId: categoryId!,
        date: { gte: `${month}-01`, lte: `${month}-31` },
        account: { budgetId: budget.id, onBudget: true },
        transferTwinId: null,
      }
    : {
        isChild: false,
        account: {
          budgetId: budget.id,
          ...(accountId ? { id: accountId } : {}),
        },
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
      take,
      include: {
        payee: true,
        category: true,
        account: true,
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
  const twins =
    twinIds.length > 0
      ? await prisma.transaction.findMany({
          where: { id: { in: twinIds } },
          include: { account: true },
        })
      : [];
  const twinById = new Map(twins.map((t) => [t.id, t]));

  const hasMore = transactions.length < count;
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (accountId) qs.set("accountId", accountId);
  if (categoryId) qs.set("categoryId", categoryId);
  if (month) qs.set("month", month);

  const rows = transactions.map((t) => {
    const twin = t.transferTwinId ? twinById.get(t.transferTwinId) : null;
    const isTransfer = Boolean(t.transferTwinId);
    return {
      id: t.id,
      accountId: t.accountId,
      accountName: t.account.name,
      date: t.date,
      payee: t.payee?.name ?? "",
      categoryId: t.categoryId ?? "",
      notes: t.notes ?? "",
      cleared: t.cleared,
      absAmount: (Math.abs(t.amount) / 100).toFixed(2),
      isInflow: t.amount > 0,
      isSplit: t.isParent || t.isChild,
      isTransfer,
      transferLabel: twin?.account.name ?? null,
    };
  });

  const sumCents = activitySum?._sum.amount ?? 0;
  const filtered = Boolean(q || accountId || activityView);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={sectionHeadingClass}>Transactions</h1>
          <p className={sectionSubheadingClass}>
            {activityView
              ? `Activity for ${filterCategory?.name ?? "category"} · ${monthLabel(month!)}`
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
          className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}
        >
          <div>
            <p className="text-sm font-medium text-fg">
              {filterCategory?.name ?? "Category"} · {monthLabel(month!)}
            </p>
            <p className="mt-1 text-sm text-fg-muted">
              {count} transaction{count === 1 ? "" : "s"} · sum{" "}
              <span className="font-semibold tabular-nums text-fg">
                {formatMoney(sumCents, budget.currency)}
              </span>
              {activityView ? " (matches Plan Activity)" : ""}
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
          className={`${cardClass} grid gap-3 p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end`}
        >
          <label className={labelClass}>
            Search
            <input
              name="q"
              defaultValue={q}
              className={inputClass}
              placeholder="Payee, category, notes, account…"
              autoComplete="off"
            />
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
          <button type="submit" className={`${buttonSecondaryClass} w-full`}>
            <Search className="mr-2 size-4" />
            Filter
          </button>
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
          Load more
        </Link>
      ) : null}
    </div>
  );
}
