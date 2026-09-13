import Link from "next/link";
import { notFound } from "next/navigation";
import { ListX } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { accountTypeMeta } from "@/lib/ui-accents";
import { fetchAccountRegisterChunk } from "@/lib/account-register-chunk";
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
import { AdjustBalanceForm } from "@/components/accounts/AdjustBalanceForm";
import { AccountTransactionsInfiniteList } from "@/components/accounts/AccountTransactionsInfiniteList";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const { id } = await params;

  const account = await prisma.financeAccount.findFirst({
    where: { id, budgetId: budget.id },
  });
  if (!account) notFound();

  const pendingIds = await findPendingBillImportParentIds(prisma, [id]);
  const [sumAgg, chunk, count, balanceAdjustments] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        accountId: id,
        isChild: false,
        ...excludePendingBillImportsWhere(pendingIds),
      },
      _sum: { amount: true },
    }),
    fetchAccountRegisterChunk(id),
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

      {chunk.items.length === 0 ? (
        <div className={cardCompactClass}>
          <EmptyState
            icon={ListX}
            title="No transactions yet"
            description="Use Add to record spending or income."
          />
        </div>
      ) : (
        <AccountTransactionsInfiniteList
          accountId={account.id}
          currency={budget.currency}
          initialItems={chunk.items}
          initialCursor={chunk.nextCursor}
          hasMore={chunk.hasMore}
        />
      )}
    </div>
  );
}
