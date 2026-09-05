import Link from "next/link";
import { PiggyBank } from "lucide-react";
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
import { createAccount, toggleAccountClosed } from "@/app/(app)/plan/actions";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AccountsPage() {
  const { budget } = await requireBudgetAccess();
  const accounts = await prisma.financeAccount.findMany({
    where: { budgetId: budget.id },
    orderBy: [{ closed: "asc" }, { sortOrder: "asc" }],
  });

  const balances = await prisma.transaction.groupBy({
    by: ["accountId"],
    where: {
      accountId: { in: accounts.map((a) => a.id) },
      isChild: false,
    },
    _sum: { amount: true },
  });
  const balanceMap = new Map(
    balances.map((b) => [b.accountId, b._sum.amount ?? 0]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Accounts</h1>
        <p className="mt-1 text-sm text-fg-muted">
          On-budget balances feed Ready to Assign. Tracking accounts are for net worth.
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={PiggyBank}
            title="No accounts yet"
            description="Create a checking or cash account to start tracking balances."
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => {
            const balance = balanceMap.get(a.id) ?? 0;
            const meta = accountTypeMeta(a.type);
            const Icon = meta.icon;
            return (
              <li key={a.id}>
                <Link
                  href={`/accounts/${a.id}`}
                  prefetch
                  className={`${cardClass} flex items-center gap-3 overflow-hidden px-3 py-3 ${
                    a.closed ? "opacity-50" : ""
                  }`}
                >
                  <span
                    className="w-1 self-stretch rounded-full"
                    style={{ background: meta.accent }}
                    aria-hidden
                  />
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background:
                        "color-mix(in oklch, var(--accent-muted) 70%, transparent)",
                      color: meta.accent,
                    }}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fg">{a.name}</p>
                    <p className="text-xs text-fg-subtle">
                      {meta.label}
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
      )}

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

      {accounts.some((a) => !a.closed) || accounts.some((a) => a.closed) ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-fg-muted">Close / reopen</h2>
          {accounts.map((a) => (
            <form key={a.id} action={toggleAccountClosed}>
              <input type="hidden" name="id" value={a.id} />
              <button type="submit" className={`${buttonSecondaryClass} w-full`}>
                {a.closed ? `Reopen ${a.name}` : `Close ${a.name}`}
              </button>
            </form>
          ))}
        </section>
      ) : null}
    </div>
  );
}
