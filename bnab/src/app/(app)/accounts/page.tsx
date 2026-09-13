import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { accountTypeMeta } from "@/lib/ui-accents";
import {
  excludePendingBillImportsWhere,
  findPendingBillImportParentIds,
} from "@/lib/ing-import/pending-bill-balance";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  cardCompactClass,
  chipClass,
  chipMutedClass,
  inputClass,
  inputCompactClass,
  labelClass,
  moneyClass,
  pageStackClass,
  sectionSubheadingClass,
} from "@/components/forms/field-classes";
import { createAccount } from "@/app/(app)/plan/actions";
import { EmptyState } from "@/components/ui/EmptyState";

const ACCOUNT_TYPES = [
  "CHECKING",
  "SAVINGS",
  "CASH",
  "CREDIT_CARD",
  "TRACKING_ASSET",
  "TRACKING_LIABILITY",
] as const;

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    onBudget?: string;
    closed?: string;
  }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const type = ACCOUNT_TYPES.includes(sp.type as (typeof ACCOUNT_TYPES)[number])
    ? sp.type
    : "";
  const onBudget =
    sp.onBudget === "1" ? true : sp.onBudget === "0" ? false : null;
  const closed =
    sp.closed === "1" ? true : sp.closed === "0" ? false : null;

  const accounts = await prisma.financeAccount.findMany({
    where: {
      budgetId: budget.id,
      ...(q ? { name: { contains: q } } : {}),
      ...(type ? { type: type as (typeof ACCOUNT_TYPES)[number] } : {}),
      ...(onBudget !== null ? { onBudget } : {}),
      ...(closed !== null ? { closed } : {}),
    },
    orderBy: [{ closed: "asc" }, { sortOrder: "asc" }],
  });

  const accountIds = accounts.map((a) => a.id);
  const pendingIds = await findPendingBillImportParentIds(prisma, accountIds);
  const balances = accountIds.length
    ? await prisma.transaction.groupBy({
        by: ["accountId"],
        where: {
          accountId: { in: accountIds },
          isChild: false,
          ...excludePendingBillImportsWhere(pendingIds),
        },
        _sum: { amount: true },
      })
    : [];
  const balanceMap = new Map(
    balances.map((b) => [b.accountId, b._sum.amount ?? 0]),
  );

  const hasFilters = Boolean(q || type || onBudget !== null || closed !== null);

  function href(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const next = {
      q: q || undefined,
      type: type || undefined,
      onBudget:
        onBudget === true ? "1" : onBudget === false ? "0" : undefined,
      closed: closed === true ? "1" : closed === false ? "0" : undefined,
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    const s = params.toString();
    return s ? `/accounts?${s}` : "/accounts";
  }

  return (
    <div className={pageStackClass}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
          Accounts
        </h1>
        <p className={sectionSubheadingClass}>
          On-budget balances feed Ready to Assign. Tracking accounts are for net
          worth.
        </p>
      </div>

      <form
        method="get"
        className={`${cardCompactClass} flex flex-wrap items-end gap-2 p-3`}
      >
        <label className="block min-w-[8rem] flex-1 text-xs font-medium text-fg-muted">
          Search
          <input
            name="q"
            defaultValue={q}
            className={`${inputCompactClass} mt-1`}
            placeholder="Name"
          />
        </label>
        <label className="block text-xs font-medium text-fg-muted">
          Type
          <select
            name="type"
            defaultValue={type}
            className={`${inputCompactClass} mt-1`}
          >
            <option value="">All</option>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {accountTypeMeta(t).label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-fg-muted">
          Budget
          <select
            name="onBudget"
            defaultValue={
              onBudget === true ? "1" : onBudget === false ? "0" : ""
            }
            className={`${inputCompactClass} mt-1`}
          >
            <option value="">All</option>
            <option value="1">On-budget</option>
            <option value="0">Tracking</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-fg-muted">
          Closed
          <select
            name="closed"
            defaultValue={closed === true ? "1" : closed === false ? "0" : ""}
            className={`${inputCompactClass} mt-1`}
          >
            <option value="">All</option>
            <option value="0">Open</option>
            <option value="1">Closed</option>
          </select>
        </label>
        <button type="submit" className={buttonCompactClass}>
          Filter
        </button>
        {hasFilters ? (
          <Link href="/accounts" className={buttonCompactClass}>
            Clear
          </Link>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-2" role="navigation" aria-label="Quick filters">
        <Link
          href={href({ closed: "0", onBudget: undefined })}
          className={closed === false ? chipClass : chipMutedClass}
        >
          Open
        </Link>
        <Link
          href={href({ onBudget: "1", closed: "0" })}
          className={
            onBudget === true && closed === false ? chipClass : chipMutedClass
          }
        >
          On-budget
        </Link>
        <Link
          href={href({ onBudget: "0" })}
          className={onBudget === false ? chipClass : chipMutedClass}
        >
          Tracking
        </Link>
      </div>

      {accounts.length === 0 ? (
        <div className={cardCompactClass}>
          <EmptyState
            icon={PiggyBank}
            title={hasFilters ? "No matching accounts" : "No accounts yet"}
            description={
              hasFilters
                ? "Try clearing filters."
                : "Create a checking or cash account to start tracking balances."
            }
            action={
              hasFilters ? (
                <Link href="/accounts" className={`${buttonPrimaryClass} px-5`}>
                  Clear filters
                </Link>
              ) : (
                <a href="#add-account" className={`${buttonPrimaryClass} px-5`}>
                  Add account
                </a>
              )
            }
          />
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => {
            const balance = balanceMap.get(a.id) ?? 0;
            const meta = accountTypeMeta(a.type);
            const Icon = meta.icon;
            return (
              <li key={a.id}>
                <Link
                  href={`/accounts/${a.id}`}
                  prefetch
                  className={`${cardCompactClass} flex h-full items-center gap-2.5 overflow-hidden px-3 py-2.5 transition-colors hover:border-rim ${
                    a.closed ? "opacity-50" : ""
                  }`}
                >
                  <span
                    className="w-1 self-stretch rounded-full"
                    style={{ background: meta.accent }}
                    aria-hidden
                  />
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background:
                        "color-mix(in oklch, var(--accent-muted) 70%, transparent)",
                      color: meta.accent,
                    }}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">
                      {a.name}
                    </p>
                    <p className="text-[10px] text-fg-subtle">
                      {meta.label}
                      {!a.onBudget ? " · tracking" : ""}
                      {a.closed ? " · closed" : ""}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold ${moneyClass} ${
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
        className={`${cardCompactClass} scroll-mt-20 p-3 sm:max-w-lg lg:max-w-xl`}
      >
        <h2 className="text-sm font-semibold text-fg">Add account</h2>
        <form action={createAccount} className="mt-2 space-y-2">
          <label className={labelClass}>
            Name
            <input
              name="name"
              required
              className={inputClass}
              placeholder="Checking"
            />
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
