import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { TransactionSheetEditor } from "@/components/transactions/TransactionSheetEditor";
import { ReceiptUploadPanel } from "@/components/receipts/ReceiptUploadPanel";
import {
  ensureYngsbCategories,
  seedDefaultReceiptRules,
} from "@/lib/starter-categories";
import { cardClass } from "@/components/forms/field-classes";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const { id } = await params;
  await ensureYngsbCategories(prisma, budget.id);
  await seedDefaultReceiptRules(prisma, budget.id);

  const txn = await prisma.transaction.findFirst({
    where: { id, account: { budgetId: budget.id }, isChild: false },
    include: {
      payee: true,
      category: true,
      account: true,
      children: { include: { category: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!txn) notFound();

  const twin = txn.transferTwinId
    ? await prisma.transaction.findFirst({
        where: { id: txn.transferTwinId },
        include: { account: true },
      })
    : null;

  const [groups, payees] = await Promise.all([
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

  const absDisplay = (Math.abs(txn.amount) / 100).toFixed(2);
  const isInflow = txn.amount > 0 && !txn.transferTwinId;
  const isSplit = txn.isParent;
  const isTransfer = Boolean(txn.transferTwinId);
  const transferLabel = twin
    ? twin.account.name
    : isTransfer
      ? "other account"
      : null;

  return (
    <div className="space-y-3">
      <div>
        <Link
          href="/transactions"
          className="text-sm text-fg-muted hover:text-fg"
        >
          ← Transactions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
          Edit transaction
        </h1>
        <p className="text-sm text-fg-muted">
          {formatMoney(txn.amount, budget.currency)}
          {isSplit ? " · split" : ""}
          {isTransfer ? " · transfer" : ""}
        </p>
      </div>

      <TransactionSheetEditor
        txnId={txn.id}
        accountId={txn.accountId}
        accountName={txn.account.name}
        date={txn.date}
        payee={txn.payee?.name ?? ""}
        categoryId={txn.categoryId ?? ""}
        notes={txn.notes ?? ""}
        cleared={txn.cleared}
        absAmount={absDisplay}
        isInflow={isInflow || (isTransfer && txn.amount > 0)}
        isSplit={isSplit}
        isTransfer={isTransfer}
        transferLabel={transferLabel}
        currencyHint={budget.currency}
        returnTo="/transactions"
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          isIncome: g.isIncome,
          categories: g.categories.map((c) => ({ id: c.id, name: c.name })),
        }))}
        payees={payees.map((p) => p.name)}
        childrenRows={txn.children.map((c) => ({
          id: c.id,
          categoryName: c.category?.name ?? "—",
          amountDisplay: (Math.abs(c.amount) / 100).toFixed(2),
          isInflow: c.amount > 0,
        }))}
      />

      {!isTransfer && txn.amount < 0 ? (
        <ReceiptUploadPanel
          transactionId={txn.id}
          currency={budget.currency}
        />
      ) : null}

      {isSplit && txn.children.length > 0 ? (
        <div className={`${cardClass} p-4`}>
          <h2 className="text-sm font-semibold text-fg">Split lines</h2>
          <ul className="mt-2 divide-y divide-rim-subtle">
            {txn.children.map((c) => (
              <li
                key={c.id}
                className="flex justify-between gap-3 py-2 text-sm"
              >
                <span className="text-fg">
                  {c.category?.name ?? "—"}
                  {c.notes ? (
                    <span className="block truncate text-fg-muted">
                      {c.notes}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-fg">
                  {formatMoney(c.amount, budget.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
