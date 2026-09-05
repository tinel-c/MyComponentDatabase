import Link from "next/link";
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
import { createAccount, toggleAccountClosed } from "@/app/(app)/plan/actions";

export default async function AccountsPage() {
  const { budget } = await requireBudgetAccess();
  const accounts = await prisma.financeAccount.findMany({
    where: { budgetId: budget.id },
    orderBy: [{ closed: "asc" }, { sortOrder: "asc" }],
    include: { transactions: { select: { amount: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Accounts</h1>
        <p className="mt-1 text-sm text-fg-muted">
          On-budget balances feed Ready to Assign. Tracking accounts are for net worth.
        </p>
      </div>

      <ul className="space-y-2">
        {accounts.map((a) => {
          const balance = a.transactions.reduce((s, t) => s + t.amount, 0);
          return (
            <li key={a.id}>
              <Link
                href={`/accounts/${a.id}`}
                className={`${cardClass} flex items-center justify-between px-4 py-4 ${
                  a.closed ? "opacity-50" : ""
                }`}
              >
                <div>
                  <p className="font-medium text-fg">{a.name}</p>
                  <p className="text-xs text-fg-subtle">
                    {a.type.replaceAll("_", " ").toLowerCase()}
                    {!a.onBudget ? " · tracking" : ""}
                    {a.closed ? " · closed" : ""}
                  </p>
                </div>
                <p
                  className={`text-base font-semibold tabular-nums ${
                    balance < 0 ? "text-danger" : "text-fg"
                  }`}
                >
                  {formatMoney(balance, budget.currency)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold text-fg">Add account</h2>
        <form action={createAccount} className="mt-3 space-y-3">
          <label className={labelClass}>
            Name
            <input name="name" required className={inputClass} placeholder="Checking" />
          </label>
          <label className={labelClass}>
            Type
            <select name="type" className={inputClass} defaultValue="CHECKING">
              <option value="CHECKING">Checking</option>
              <option value="SAVINGS">Savings</option>
              <option value="CASH">Cash</option>
              <option value="CREDIT_CARD">Credit card</option>
              <option value="TRACKING_ASSET">Tracking asset</option>
              <option value="TRACKING_LIABILITY">Tracking liability</option>
            </select>
          </label>
          <label className={labelClass}>
            Starting balance
            <input
              name="startingBalance"
              className={inputClass}
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>
          <button type="submit" className={buttonPrimaryClass}>
            Create account
          </button>
        </form>
      </section>

      {accounts.some((a) => !a.closed) ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-fg-muted">Close account</h2>
          {accounts
            .filter((a) => !a.closed)
            .map((a) => (
              <form key={a.id} action={toggleAccountClosed}>
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className={`${buttonSecondaryClass} w-full`}>
                  Close {a.name}
                </button>
              </form>
            ))}
        </section>
      ) : null}
    </div>
  );
}
