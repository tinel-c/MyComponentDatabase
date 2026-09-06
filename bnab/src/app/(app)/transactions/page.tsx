import Link from "next/link";
import { ArrowLeftRight, Search } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
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
    page?: string;
  }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const accountId = sp.accountId || undefined;
  const pageNum = Math.max(1, Number(sp.page ?? "1") || 1);
  const take = pageNum * PAGE_SIZE;

  const [accounts, groups, payees] = await Promise.all([
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
  ]);

  const where = {
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

  const [transactions, count] = await Promise.all([
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
      isSplit: t.isParent,
      isTransfer,
      transferLabel: twin?.account.name ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={sectionHeadingClass}>Transactions</h1>
          <p className={sectionSubheadingClass}>
            Spreadsheet register — edit a cell, leave it to save. {count} total
            {q || accountId ? " (filtered)" : ""}.
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

      {transactions.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions found"
            description={
              q || accountId
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
