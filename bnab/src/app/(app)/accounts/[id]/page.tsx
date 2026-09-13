import Link from "next/link";
import { notFound } from "next/navigation";
import { ListX } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { accountTypeMeta } from "@/lib/ui-accents";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  cardCompactClass,
  inputClass,
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
import { ClearToggle } from "@/components/accounts/ClearToggle";
import { AdjustBalanceForm } from "@/components/accounts/AdjustBalanceForm";
import { DeleteTransactionButton } from "@/components/transactions/DeleteTransactionButton";
import { EmptyState } from "@/components/ui/EmptyState";

const PAGE_SIZE = 40;

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const { id } = await params;
  const sp = await searchParams;

  const account = await prisma.financeAccount.findFirst({
    where: { id, budgetId: budget.id },
  });
  if (!account) notFound();

  const pageNum = Math.max(1, Number(sp.page ?? "1") || 1);
  const skip = (pageNum - 1) * PAGE_SIZE;

  const pendingIds = await findPendingBillImportParentIds(prisma, [id]);
  const [sumAgg, transactions, count, balanceAdjustments] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        accountId: id,
        isChild: false,
        ...excludePendingBillImportsWhere(pendingIds),
      },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { accountId: id, isChild: false },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { payee: true, category: true },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.transaction.count({ where: { accountId: id, isChild: false } }),
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
  const hasMore = skip + transactions.length < count;
  const remaining = Math.max(0, count - skip - transactions.length);
  const page = transactions;
  const meta = accountTypeMeta(account.type);
  const Icon = meta.icon;

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
        <form action={renameAccount} className="flex flex-col gap-2 sm:flex-row">
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

      <p className="text-xs text-fg-subtle">{count} transactions · tap a row to edit</p>

      <ul className={`${cardCompactClass} divide-y divide-rim-subtle/60`}>
        {page.length === 0 ? (
          <li>
            <EmptyState
              icon={ListX}
              title="No transactions yet"
              description="Use Add to record spending or income."
            />
          </li>
        ) : (
          page.map((t) => (
            <li key={t.id}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <ClearToggle id={t.id} cleared={t.cleared} />
                <Link
                  href={`/transactions/${t.id}`}
                  prefetch
                  className="flex min-w-0 flex-1 items-center gap-3 py-1"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fg">
                      {t.transferTwinId
                        ? "Transfer"
                        : t.payee?.name ??
                          t.notes ??
                          (t.isStartingBalance ? "Starting balance" : "Transaction")}
                    </p>
                    <p className="text-xs text-fg-subtle">
                      {t.date}
                      {t.category ? ` · ${t.category.name}` : ""}
                      {t.payee?.name === "Balance Adjustment"
                        ? " · adjustment"
                        : ""}
                      {t.isParent ? " · split" : ""}
                      {t.reconciled ? " · reconciled" : ""}
                    </p>
                  </div>
                  <p
                    className={`tabular-nums font-medium ${
                      t.amount < 0 ? "text-fg" : "text-ok"
                    }`}
                  >
                    {formatMoney(t.amount, budget.currency)}
                  </p>
                </Link>
                <DeleteTransactionButton
                  id={t.id}
                  returnTo={`/accounts/${account.id}`}
                  compact
                />
              </div>
            </li>
          ))
        )}
      </ul>

      {hasMore ? (
        <Link
          href={`/accounts/${id}?page=${pageNum + 1}`}
          className={`${buttonCompactClass} w-full`}
        >
          Next page · {remaining} remaining
        </Link>
      ) : null}
      {pageNum > 1 ? (
        <Link
          href={`/accounts/${id}?page=${pageNum - 1}`}
          className={`${buttonCompactClass} w-full`}
        >
          Previous page
        </Link>
      ) : null}
    </div>
  );
}
