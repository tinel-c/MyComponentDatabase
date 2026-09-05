import Link from "next/link";
import { ArrowLeftRight, Search } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClearToggle } from "@/components/accounts/ClearToggle";

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

  const accounts = await prisma.financeAccount.findMany({
    where: { budgetId: budget.id },
    orderBy: [{ closed: "asc" }, { sortOrder: "asc" }],
  });

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

  const hasMore = transactions.length < count;
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (accountId) qs.set("accountId", accountId);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Tap a row to view or edit. {count} total
            {q || accountId ? " (filtered)" : ""}.
          </p>
        </div>
        <Link href="/transactions/new" prefetch className={buttonPrimaryClass}>
          Add
        </Link>
      </div>

      <form className={`${cardClass} space-y-3 p-4`}>
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

      <ul className={`${cardClass} divide-y divide-rim-subtle/60`}>
        {transactions.length === 0 ? (
          <li>
            <EmptyState
              icon={ArrowLeftRight}
              title="No transactions found"
              description={
                q || accountId
                  ? "Try clearing filters or add a new transaction."
                  : "Add your first transaction with the + button."
              }
            />
          </li>
        ) : (
          transactions.map((t) => {
            const title = t.transferTwinId
              ? "Transfer"
              : t.payee?.name ??
                t.notes ??
                (t.isStartingBalance ? "Starting balance" : "Transaction");
            return (
              <li key={t.id}>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <ClearToggle id={t.id} cleared={t.cleared} />
                  <Link
                    href={`/transactions/${t.id}`}
                    prefetch
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 active:bg-overlay/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-fg">{title}</p>
                      <p className="truncate text-xs text-fg-subtle">
                        {t.date} · {t.account.name}
                        {t.category ? ` · ${t.category.name}` : ""}
                        {t.isParent ? " · split" : ""}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 tabular-nums font-medium ${
                        t.amount < 0 ? "text-fg" : "text-ok"
                      }`}
                    >
                      {formatMoney(t.amount, budget.currency)}
                    </p>
                  </Link>
                </div>
              </li>
            );
          })
        )}
      </ul>

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
