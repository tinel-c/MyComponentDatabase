import Link from "next/link";
import { ArrowLeftRight, Search, X } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney, monthLabel } from "@/lib/money";
import {
  buildTransactionsWhere,
  fetchTransactionsRegisterChunk,
  type TransactionsListFilters,
} from "@/lib/transactions-register-chunk";
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
import { TransactionsInfiniteRegister } from "@/components/transactions/TransactionsInfiniteRegister";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Flow = "income" | "spending";
type Dir = "in" | "out";

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

  const filters: TransactionsListFilters = {
    ...(q ? { q } : {}),
    ...(memo ? { memo } : {}),
    ...(payee ? { payee } : {}),
    ...(accountId ? { accountId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(groupId ? { groupId } : {}),
    ...(month ? { month } : {}),
    ...(flow ? { flow } : {}),
    ...(dir ? { dir } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };

  const where = buildTransactionsWhere(budget.id, filters);

  const [
    accounts,
    groups,
    payees,
    filterCategory,
    filterGroup,
    filterAccount,
    chunk,
    count,
    activitySum,
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
    fetchTransactionsRegisterChunk({
      budgetId: budget.id,
      where,
    }),
    prisma.transaction.count({ where }),
    activityView
      ? prisma.transaction.aggregate({
          where,
          _sum: { amount: true },
        })
      : Promise.resolve(null),
  ]);

  const rows = chunk.items;
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

  const sheetGroups = groups.map((g) => ({
    id: g.id,
    name: g.name,
    isIncome: g.isIncome,
    categories: g.categories.map((c) => ({ id: c.id, name: c.name })),
  }));

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

      {rows.length === 0 ? (
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
        <TransactionsInfiniteRegister
          initialRows={rows}
          initialCursor={chunk.nextCursor}
          hasMore={chunk.hasMore}
          filters={filters}
          groups={sheetGroups}
          payees={payees.map((p) => p.name)}
          currency={budget.currency}
        />
      )}
    </div>
  );
}
