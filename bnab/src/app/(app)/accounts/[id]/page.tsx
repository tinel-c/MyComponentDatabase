import Link from "next/link";
import { notFound } from "next/navigation";
import { ListX } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { accountTypeMeta } from "@/lib/ui-accents";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import {
  renameAccount,
  toggleAccountClosed,
} from "@/app/(app)/plan/actions";
import { reconcileAccount } from "@/app/(app)/transactions/actions";
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
  const take = pageNum * PAGE_SIZE;

  const [sumAgg, transactions, count] = await Promise.all([
    prisma.transaction.aggregate({
      where: { accountId: id, isChild: false },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { accountId: id, isChild: false },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { payee: true, category: true },
      take,
    }),
    prisma.transaction.count({ where: { accountId: id, isChild: false } }),
  ]);

  const balance = sumAgg._sum.amount ?? 0;
  const hasMore = transactions.length < count;
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
              className="flex size-11 shrink-0 items-center justify-center rounded-xl"
              style={{
                background:
                  "color-mix(in oklch, var(--accent-muted) 70%, transparent)",
                color: meta.accent,
              }}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold text-fg">
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

      <section className={`${cardClass} space-y-3 p-4`}>
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

      <section className={`${cardClass} space-y-3 p-4`}>
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
          <button type="submit" className={`${buttonSecondaryClass} sm:mt-6`}>
            Save name
          </button>
        </form>
        <form action={toggleAccountClosed}>
          <input type="hidden" name="id" value={account.id} />
          <button type="submit" className={`${buttonSecondaryClass} w-full`}>
            {account.closed ? "Reopen account" : "Close account"}
          </button>
        </form>
      </section>

      <form action={reconcileAccount}>
        <input type="hidden" name="accountId" value={account.id} />
        <button type="submit" className={buttonSecondaryClass}>
          Reconcile cleared
        </button>
      </form>

      <p className="text-xs text-fg-subtle">{count} transactions · tap a row to edit</p>

      <ul className={`${cardClass} divide-y divide-rim-subtle/60`}>
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
          className={`${buttonSecondaryClass} w-full`}
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}
