import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { accountTypeMeta } from "@/lib/ui-accents";
import {
  buttonPrimaryClass,
  cardClass,
  inputClass,
  labelClass,
  moneyClass,
  sectionHeadingClass,
  sectionSubheadingClass,
} from "@/components/forms/field-classes";
import { createAccount } from "@/app/(app)/plan/actions";
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
        <h1 className={sectionHeadingClass}>Accounts</h1>
        <p className={sectionSubheadingClass}>
          On-budget balances feed Ready to Assign. Tracking accounts are for net
          worth.
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={PiggyBank}
            title="No accounts yet"
            description="Create a checking or cash account to start tracking balances."
            action={
              <a href="#add-account" className={`${buttonPrimaryClass} px-5`}>
                Add account
              </a>
            }
          />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => {
            const balance = balanceMap.get(a.id) ?? 0;
            const meta = accountTypeMeta(a.type);
            const Icon = meta.icon;
            return (
              <li key={a.id}>
                <Link
                  href={`/accounts/${a.id}`}
                  prefetch
                  className={`${cardClass} flex h-full items-center gap-3 overflow-hidden px-4 py-4 transition-colors hover:border-rim ${
                    a.closed ? "opacity-50" : ""
                  }`}
                >
                  <span
                    className="w-1 self-stretch rounded-full"
                    style={{ background: meta.accent }}
                    aria-hidden
                  />
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fg">{a.name}</p>
                    <p className="text-xs text-fg-subtle">
                      {meta.label}
                      {!a.onBudget ? " · tracking" : ""}
                      {a.closed ? " · closed" : ""}
                    </p>
                  </div>
                  <p
                    className={`text-base font-semibold ${moneyClass} ${
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

      <section
        id="add-account"
        className={`${cardClass} scroll-mt-20 p-4 sm:max-w-lg lg:max-w-xl`}
      >
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
              className={`${inputClass} ${moneyClass}`}
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>
          <button type="submit" className={buttonPrimaryClass}>
            Create account
          </button>
        </form>
      </section>
    </div>
  );
}
