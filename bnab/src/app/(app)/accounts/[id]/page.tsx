import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
} from "@/components/forms/field-classes";
import {
  reconcileAccount,
  toggleCleared,
} from "@/app/(app)/transactions/actions";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const { id } = await params;
  const account = await prisma.financeAccount.findFirst({
    where: { id, budgetId: budget.id },
    include: {
      transactions: {
        where: { isChild: false },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: { payee: true, category: true, children: true },
        take: 200,
      },
    },
  });
  if (!account) notFound();

  const allTx = await prisma.transaction.findMany({
    where: { accountId: id, isChild: false },
    select: { amount: true },
  });
  const balance = allTx.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/accounts" className="text-sm text-fg-muted hover:text-fg">
            ← Accounts
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-fg">{account.name}</h1>
          <p className="text-sm text-fg-muted">
            Balance {formatMoney(balance, budget.currency)}
          </p>
        </div>
        <Link href="/transactions/new" className={buttonPrimaryClass}>
          Add
        </Link>
      </div>

      <form action={reconcileAccount}>
        <input type="hidden" name="accountId" value={account.id} />
        <button type="submit" className={buttonSecondaryClass}>
          Reconcile cleared
        </button>
      </form>

      <ul className={`${cardClass} divide-y divide-rim-subtle/60`}>
        {account.transactions.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-fg-muted">
            No transactions yet.
          </li>
        ) : (
          account.transactions.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <form action={toggleCleared}>
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  className={`size-5 rounded-full border ${
                    t.cleared
                      ? "border-ok bg-ok"
                      : "border-rim bg-transparent"
                  }`}
                  aria-label={t.cleared ? "Uncleared" : "Clear"}
                />
              </form>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">
                  {t.transferTwinId
                    ? "Transfer"
                    : t.payee?.name ?? t.notes ?? (t.isStartingBalance ? "Starting balance" : "Transaction")}
                </p>
                <p className="text-xs text-fg-subtle">
                  {t.date}
                  {t.category ? ` · ${t.category.name}` : ""}
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
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
