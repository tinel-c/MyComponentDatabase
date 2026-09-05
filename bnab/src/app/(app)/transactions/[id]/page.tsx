import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import {
  buttonDangerClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import {
  deleteTransaction,
  updateTransaction,
} from "@/app/(app)/transactions/actions";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const { id } = await params;

  const txn = await prisma.transaction.findFirst({
    where: { id, account: { budgetId: budget.id }, isChild: false },
    include: {
      payee: true,
      category: true,
      account: true,
      children: { include: { category: true } },
    },
  });
  if (!txn) notFound();

  const twin = txn.transferTwinId
    ? await prisma.transaction.findFirst({
        where: { id: txn.transferTwinId },
        include: { account: true },
      })
    : null;

  const groups = await prisma.categoryGroup.findMany({
    where: { budgetId: budget.id, hidden: false },
    orderBy: { sortOrder: "asc" },
    include: {
      categories: { where: { hidden: false }, orderBy: { sortOrder: "asc" } },
    },
  });

  const absDisplay = (Math.abs(txn.amount) / 100).toFixed(2);
  const isInflow = txn.amount > 0 && !txn.transferTwinId;
  const isSplit = txn.isParent;
  const isTransfer = Boolean(txn.transferTwinId);

  return (
    <div className="space-y-4 pb-28">
      <div>
        <Link
          href={`/accounts/${txn.accountId}`}
          className="text-sm text-fg-muted hover:text-fg"
        >
          ← {txn.account.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
          Edit transaction
        </h1>
        <p className="text-sm text-fg-muted">
          {formatMoney(txn.amount, budget.currency)}
          {isSplit ? " · split (date, notes, cleared only)" : ""}
          {isTransfer ? " · transfer" : ""}
        </p>
      </div>

      <form action={updateTransaction} className={`${cardClass} space-y-4 p-4`}>
        <input type="hidden" name="id" value={txn.id} />

        <label className={labelClass}>
          Account
          <input
            className={inputClass}
            value={txn.account.name}
            disabled
            readOnly
          />
        </label>

        <label className={labelClass}>
          Date
          <input
            name="date"
            type="date"
            required
            className={inputClass}
            defaultValue={txn.date}
          />
        </label>

        {!isSplit ? (
          <label className={labelClass}>
            Amount
            <input
              name="amount"
              required
              inputMode="decimal"
              className={inputClass}
              defaultValue={absDisplay}
            />
          </label>
        ) : (
          <input type="hidden" name="amount" value={absDisplay} />
        )}

        {!isTransfer && !isSplit ? (
          <>
            <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                name="inflow"
                value="1"
                defaultChecked={isInflow}
                className="size-5"
              />
              Inflow (income / refund)
            </label>

            <label className={labelClass}>
              Payee
              <input
                name="payee"
                className={inputClass}
                defaultValue={txn.payee?.name ?? ""}
                autoComplete="off"
              />
            </label>

            <label className={labelClass}>
              Category
              <select
                name="categoryId"
                className={inputClass}
                defaultValue={txn.categoryId ?? ""}
              >
                <option value="">Ready to Assign / none</option>
                {groups.map((g) => (
                  <optgroup key={g.id} label={g.name}>
                    {g.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {isTransfer ? (
          <p className="text-sm text-fg-muted">
            Transfer with {twin?.account.name ?? "other account"}. Amount updates
            both sides.
          </p>
        ) : null}

        {isSplit ? (
          <ul className="space-y-1 rounded-xl border border-rim-subtle p-3 text-sm">
            {txn.children.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span className="text-fg">{c.category?.name ?? "—"}</span>
                <span className="tabular-nums text-fg-muted">
                  {formatMoney(c.amount, budget.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <label className={labelClass}>
          Notes
          <input
            name="notes"
            className={inputClass}
            defaultValue={txn.notes ?? ""}
          />
        </label>

        <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            name="cleared"
            value="1"
            defaultChecked={txn.cleared}
            className="size-5"
          />
          Cleared
        </label>

        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-rim/60 bg-canvas/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="mx-auto flex max-w-3xl gap-2 pb-[env(safe-area-inset-bottom)] md:pb-0">
            <button type="submit" className={`${buttonPrimaryClass} flex-1`}>
              Save
            </button>
            <Link
              href={`/accounts/${txn.accountId}`}
              className={`${buttonSecondaryClass} flex-1`}
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>

      <form action={deleteTransaction} className="px-1">
        <input type="hidden" name="id" value={txn.id} />
        <button type="submit" className={`${buttonDangerClass} w-full`}>
          Delete transaction
        </button>
      </form>
    </div>
  );
}
