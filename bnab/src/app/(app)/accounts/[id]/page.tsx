import Link from "next/link";
import { notFound } from "next/navigation";
import { ListX } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { accountTypeMeta } from "@/lib/ui-accents";
import {
  buildAccountRegisterWhere,
  fetchAccountRegisterChunk,
  type AccountRegisterFilters,
} from "@/lib/account-register-chunk";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  cardCompactClass,
  chipClass,
  chipMutedClass,
  inputClass,
  inputCompactClass,
  labelClass,
  moneyClass,
} from "@/components/forms/field-classes";
import {
  renameAccount,
  toggleAccountClosed,
} from "@/app/(app)/plan/actions";
import { reconcileAccount } from "@/app/(app)/transactions/actions";
import {
  excludePendingBillImportsWhere,
  findPendingBillImportParentIds,
} from "@/lib/ing-import/pending-bill-balance";
import { AdjustBalanceForm } from "@/components/accounts/AdjustBalanceForm";
import { AccountTransactionsInfiniteList } from "@/components/accounts/AccountTransactionsInfiniteList";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    dir?: string;
    from?: string;
    to?: string;
    cleared?: string;
    planned?: string;
  }>;
}) {
  const { budget } = await requireBudgetAccess();
  const { id } = await params;
  const sp = await searchParams;

  const account = await prisma.financeAccount.findFirst({
    where: { id, budgetId: budget.id },
  });
  if (!account) notFound();

  const filters: AccountRegisterFilters = {
    q: sp.q?.trim() || undefined,
    categoryId: sp.categoryId?.trim() || undefined,
    dir: sp.dir === "in" || sp.dir === "out" ? sp.dir : undefined,
    from: sp.from?.trim() || undefined,
    to: sp.to?.trim() || undefined,
    cleared: sp.cleared === "0" || sp.cleared === "1" ? sp.cleared : undefined,
    planned:
      sp.planned === "linked" || sp.planned === "none" ? sp.planned : undefined,
  };
  const hasFilters = Object.values(filters).some(Boolean);

  const pendingIds = await findPendingBillImportParentIds(prisma, [id]);
  const categories = await prisma.category.findMany({
    where: { group: { budgetId: budget.id }, hidden: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  const [sumAgg, chunk, listCount, balanceAdjustments] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        accountId: id,
        isChild: false,
        ...excludePendingBillImportsWhere(pendingIds),
      },
      _sum: { amount: true },
    }),
    fetchAccountRegisterChunk(id, null, undefined, filters),
    prisma.transaction.count({
      where: buildAccountRegisterWhere(id, filters),
    }),
    prisma.transaction.findMany({
      where: {
        accountId: id,
        isChild: false,
        OR: [
          { payee: { name: "Balance Adjustment" } },
          { isStartingBalance: true },
          { notes: { contains: "balance adjustment" } },
        ],
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { payee: true, category: true },
      take: 50,
    }),
  ]);

  const balance = sumAgg._sum.amount ?? 0;
  const meta = accountTypeMeta(account.type);
  const Icon = meta.icon;

  function chipHref(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const next = {
      q: filters.q,
      categoryId: filters.categoryId,
      dir: filters.dir,
      from: filters.from,
      to: filters.to,
      cleared: filters.cleared,
      planned: filters.planned,
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    const s = params.toString();
    return s ? `/accounts/${id}?${s}` : `/accounts/${id}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/accounts" className="text-sm text-fg-muted hover:text-fg">
            ← Accounts
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                background:
                  "color-mix(in oklch, var(--accent-muted) 70%, transparent)",
                color: meta.accent,
              }}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-fg md:text-2xl">
                {account.name}
              </h1>
              <p className="text-sm text-fg-muted">
                Balance {formatMoney(balance, budget.currency)}
                {account.closed ? " · closed" : ""}
              </p>
            </div>
          </div>
        </div>
        <Link
          href={`/transactions/new?accountId=${account.id}`}
          prefetch
          className={buttonPrimaryClass}
        >
          Add
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className={`${cardCompactClass} space-y-2 p-3`}>
          <h2 className="text-sm font-semibold text-fg">
            Adjust to ING / statement
          </h2>
          <p className="text-xs text-fg-muted">
            Enter the balance shown in HomeBank/ING. BNAB inserts one transaction
            for the difference so you can see when the account was corrected.
          </p>
          <AdjustBalanceForm
            accountId={account.id}
            currentBalance={balance}
            currency={budget.currency}
          />
        </section>

        <section className={`${cardCompactClass} space-y-2 p-3`}>
          <h2 className="text-sm font-semibold text-fg">Rename</h2>
          <form
            action={renameAccount}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input type="hidden" name="id" value={account.id} />
            <label className={`${labelClass} flex-1`}>
              Name
              <input
                name="name"
                required
                maxLength={80}
                defaultValue={account.name}
                className={inputClass}
              />
            </label>
            <button type="submit" className={`${buttonCompactClass} sm:mt-5`}>
              Save name
            </button>
          </form>
          <form action={toggleAccountClosed}>
            <input type="hidden" name="id" value={account.id} />
            <button type="submit" className={`${buttonCompactClass} w-full`}>
              {account.closed ? "Reopen account" : "Close account"}
            </button>
          </form>
        </section>
      </div>

      {balanceAdjustments.length > 0 ? (
        <section className={`${cardCompactClass} overflow-hidden`}>
          <div className="border-b border-rim-subtle px-4 py-2.5">
            <h2 className="text-sm font-semibold text-fg">
              Balance adjustments
            </h2>
            <p className="text-[11px] text-fg-subtle">
              Statement corrections and starting balances for this account
              (included in Plan income)
            </p>
          </div>
          <ul className="divide-y divide-rim-subtle/60">
            {balanceAdjustments.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/transactions/${t.id}`}
                  prefetch
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-overlay/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">
                      {t.isStartingBalance
                        ? "Starting balance"
                        : (t.payee?.name ?? "Balance Adjustment")}
                    </p>
                    <p className="truncate text-xs text-fg-subtle">
                      {t.date}
                      {t.category
                        ? ` · ${t.category.name}`
                        : " · uncategorized (Ready to Assign)"}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 tabular-nums text-sm font-semibold ${moneyClass} ${
                      t.amount < 0 ? "text-danger" : "text-ok"
                    }`}
                  >
                    {formatMoney(t.amount, budget.currency)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form action={reconcileAccount}>
        <input type="hidden" name="accountId" value={account.id} />
        <button type="submit" className={buttonCompactClass}>
          Reconcile cleared
        </button>
      </form>

      <form
        method="get"
        className={`${cardCompactClass} grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4`}
      >
        <label className="block text-xs font-medium text-fg-muted sm:col-span-2">
          Search
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            className={`${inputCompactClass} mt-1`}
            placeholder="Memo or payee"
          />
        </label>
        <label className="block text-xs font-medium text-fg-muted">
          Category
          <select
            name="categoryId"
            defaultValue={filters.categoryId ?? ""}
            className={`${inputCompactClass} mt-1`}
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-fg-muted">
          Direction
          <select
            name="dir"
            defaultValue={filters.dir ?? ""}
            className={`${inputCompactClass} mt-1`}
          >
            <option value="">All</option>
            <option value="out">Out</option>
            <option value="in">In</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-fg-muted">
          From
          <input
            type="date"
            name="from"
            defaultValue={filters.from ?? ""}
            className={`${inputCompactClass} mt-1`}
          />
        </label>
        <label className="block text-xs font-medium text-fg-muted">
          To
          <input
            type="date"
            name="to"
            defaultValue={filters.to ?? ""}
            className={`${inputCompactClass} mt-1`}
          />
        </label>
        <label className="block text-xs font-medium text-fg-muted">
          Cleared
          <select
            name="cleared"
            defaultValue={filters.cleared ?? ""}
            className={`${inputCompactClass} mt-1`}
          >
            <option value="">All</option>
            <option value="1">Cleared</option>
            <option value="0">Uncleared</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-fg-muted">
          Planned
          <select
            name="planned"
            defaultValue={filters.planned ?? ""}
            className={`${inputCompactClass} mt-1`}
          >
            <option value="">All</option>
            <option value="linked">Linked</option>
            <option value="none">No planned hit</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button type="submit" className={buttonCompactClass}>
            Filter
          </button>
          {hasFilters ? (
            <Link href={`/accounts/${id}`} className={buttonCompactClass}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        <Link
          href={chipHref({ planned: "none" })}
          className={filters.planned === "none" ? chipClass : chipMutedClass}
        >
          No planned
        </Link>
        <Link
          href={chipHref({ cleared: "0" })}
          className={filters.cleared === "0" ? chipClass : chipMutedClass}
        >
          Uncleared
        </Link>
        <Link
          href={chipHref({ dir: "out" })}
          className={filters.dir === "out" ? chipClass : chipMutedClass}
        >
          Outflows
        </Link>
      </div>

      <p className="text-xs text-fg-subtle">
        {listCount} transactions · tap a row to edit
      </p>

      {chunk.items.length === 0 ? (
        <div className={cardCompactClass}>
          <EmptyState
            icon={ListX}
            title={hasFilters ? "No matching transactions" : "No transactions yet"}
            description={
              hasFilters
                ? "Try clearing filters."
                : "Use Add to record spending or income."
            }
          />
        </div>
      ) : (
        <AccountTransactionsInfiniteList
          accountId={account.id}
          currency={budget.currency}
          initialItems={chunk.items}
          initialCursor={chunk.nextCursor}
          hasMore={chunk.hasMore}
          filters={filters}
        />
      )}
    </div>
  );
}
