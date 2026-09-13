import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  currentMonth,
  formatMoney,
  monthLabel,
  todayISO,
} from "@/lib/money";
import {
  plannedCashDueInMonth,
  plannedMonthlyAssign,
} from "@/lib/planned-payments";
import {
  buttonPrimaryClass,
  cardCompactClass,
  inputClass,
  labelClass,
  pageStackClass,
} from "@/components/forms/field-classes";
import { createSchedule } from "@/app/(app)/more/actions";
import {
  PlannedPaymentsSheet,
  type PlannedSheetRow,
} from "@/components/planned/PlannedPaymentsSheet";

export default async function PlannedPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const highlightId = sp.id ?? null;
  const today = todayISO();
  const month = currentMonth();

  const [schedules, accounts, groups, importRules, executed] =
    await Promise.all([
      prisma.scheduledTransaction.findMany({
        where: { budgetId: budget.id, kind: "PLANNED" },
        orderBy: [{ active: "desc" }, { nextDate: "asc" }],
        include: {
          account: true,
          payee: true,
          category: true,
          importRule: { select: { id: true, matchText: true } },
          _count: { select: { occurrences: true } },
        },
      }),
      prisma.financeAccount.findMany({
        where: { budgetId: budget.id, closed: false },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.categoryGroup.findMany({
        where: { budgetId: budget.id },
        orderBy: { sortOrder: "asc" },
        include: { categories: { orderBy: { sortOrder: "asc" } } },
      }),
      prisma.importCategoryRule.findMany({
        where: { budgetId: budget.id },
        orderBy: { sortOrder: "asc" },
        select: { id: true, matchText: true },
      }),
      prisma.transaction.findMany({
        where: {
          isChild: false,
          scheduledTransactionId: { not: null },
          date: { gte: `${month}-01`, lte: `${month}-31` },
          account: { budgetId: budget.id },
          scheduledTransaction: { kind: "PLANNED" },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        select: {
          id: true,
          date: true,
          amount: true,
          notes: true,
          payee: { select: { name: true } },
          account: { select: { name: true } },
          category: { select: { name: true } },
          scheduledTransactionId: true,
          scheduledTransaction: {
            select: {
              id: true,
              notes: true,
              payee: { select: { name: true } },
            },
          },
        },
      }),
    ]);

  const activeOutflows = schedules.filter((s) => s.active && s.amount < 0);
  let payThisMonth = 0;
  let assignThisMonth = 0;
  for (const s of activeOutflows) {
    payThisMonth += Math.abs(
      plannedCashDueInMonth({
        amount: s.amount,
        recurrence: s.recurrence,
        nextDate: s.nextDate,
        month,
        weekday: s.weekday,
      }),
    );
    assignThisMonth += Math.abs(
      plannedMonthlyAssign({
        amount: s.amount,
        recurrence: s.recurrence,
        nextDate: s.nextDate,
        month,
        weekday: s.weekday,
      }),
    );
  }

  const sheetRows: PlannedSheetRow[] = schedules.map((s) => {
    const status: PlannedSheetRow["status"] = !s.active
      ? "inactive"
      : s.nextDate <= today
        ? "due"
        : "upcoming";
    return {
      id: s.id,
      accountId: s.accountId,
      payeeName: s.payee?.name ?? "",
      categoryId: s.categoryId ?? "",
      amountAbs: (Math.abs(s.amount) / 100).toFixed(2),
      isInflow: s.amount > 0,
      notes: s.notes ?? "",
      nextDate: s.nextDate,
      recurrence: s.recurrence,
      billingUrl: s.billingUrl ?? "",
      importRuleId: s.importRuleId ?? "",
      active: s.active,
      occurrenceCount: s._count.occurrences,
      status,
    };
  });

  return (
    <div className={pageStackClass}>
      <div>
        <h1 className="text-xl font-semibold text-fg md:text-2xl">
          Planned payments
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Recurring ledger expectations matched on import (not bill scans). Edit
          in the sheet; Hits opens linked transactions.{" "}
          <Link href="/more/schedules" className="text-accent hover:underline">
            Auto-enter schedules
          </Link>
        </p>
      </div>

      <section className={`${cardCompactClass} space-y-3 p-3`}>
        <div>
          <h2 className="text-sm font-semibold text-fg">
            How sinking-fund planning works
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            Each month, assign (set aside) a slice of large bills into their
            category — for a yearly 12 000 bill that is{" "}
            <span className="tabular-nums text-fg">1 000</span> every month —
            ideally parked in savings until Due. When the Due date arrives, pay
            the full bill from that saved envelope. Use{" "}
            <Link
              href={`/plan?month=${encodeURIComponent(month)}`}
              className="text-accent hover:underline"
            >
              Assign from planned
            </Link>{" "}
            on Plan to raise Assigned to at least this month&apos;s assign total.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-rim-subtle bg-overlay/40 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
              Pay this month · {monthLabel(month)}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-fg">
              {formatMoney(-payThisMonth, budget.currency)}
            </p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              Cash due when Due falls in this month (full yearly amount).
            </p>
          </div>
          <div className="rounded-xl border border-rim-subtle bg-overlay/40 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
              Assign this month · {monthLabel(month)}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-fg">
              {formatMoney(-assignThisMonth, budget.currency)}
            </p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              Envelope funding (yearly bills = amount ÷ 12).
            </p>
          </div>
        </div>
        {payThisMonth > assignThisMonth ? (
          <p className="text-xs text-fg-muted">
            Pay exceeds monthly assign — draw from money already saved in the
            envelope.
          </p>
        ) : null}
      </section>

      <section className={cardCompactClass}>
        <h2 className="border-b border-rim-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          Executed · {monthLabel(month)} ({executed.length})
        </h2>
        <ul className="divide-y divide-rim-subtle">
          {executed.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-fg-muted">
              No planned payments matched this month yet
            </li>
          ) : (
            executed.map((t) => {
              const plannedLabel =
                t.scheduledTransaction?.payee?.name ??
                t.scheduledTransaction?.notes?.slice(0, 40) ??
                "Planned";
              const txnLabel =
                t.payee?.name ?? t.notes?.slice(0, 40) ?? plannedLabel;
              return (
                <li
                  key={t.id}
                  className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">
                      <Link
                        href={`/transactions/${t.id}`}
                        className="hover:text-accent hover:underline"
                      >
                        {txnLabel}
                      </Link>
                    </p>
                    <p className="text-xs text-fg-subtle">
                      {t.date} · {t.account.name}
                      {t.category ? ` · ${t.category.name}` : ""}
                      {t.scheduledTransactionId ? (
                        <>
                          {" · "}
                          <Link
                            href={`/planned?id=${encodeURIComponent(t.scheduledTransactionId)}`}
                            className="text-accent hover:underline"
                          >
                            Planned · {plannedLabel}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 tabular-nums text-sm font-medium ${
                      t.amount > 0 ? "text-ok" : "text-fg"
                    }`}
                  >
                    {formatMoney(t.amount, budget.currency)}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <PlannedPaymentsSheet
        rows={sheetRows}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          categories: g.categories.map((c) => ({ id: c.id, name: c.name })),
        }))}
        importRules={importRules}
        highlightId={highlightId}
      />

      <form
        action={createSchedule}
        className={`${cardCompactClass} space-y-2 p-3 lg:grid lg:max-w-4xl lg:grid-cols-2 lg:gap-2 lg:space-y-0`}
      >
        <input type="hidden" name="kind" value="PLANNED" />
        <h2 className="text-sm font-semibold text-fg lg:col-span-2">
          New planned payment
        </h2>
        <label className={labelClass}>
          Account
          <select name="accountId" className={inputClass} required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Amount
          <input name="amount" required inputMode="decimal" className={inputClass} />
        </label>
        <label className="flex items-center gap-2 text-sm text-fg lg:col-span-2">
          <input type="checkbox" name="inflow" value="1" className="size-4" />
          Inflow
        </label>
        <label className={labelClass}>
          Payee
          <input name="payee" className={inputClass} />
        </label>
        <label className={labelClass}>
          Category
          <select name="categoryId" className={inputClass} defaultValue="">
            <option value="">None</option>
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
        <label className={labelClass}>
          Due date
          <input
            name="nextDate"
            type="date"
            className={inputClass}
            defaultValue={todayISO()}
          />
        </label>
        <label className={labelClass}>
          Recurrence
          <select name="recurrence" className={inputClass} defaultValue="MONTHLY">
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
            <option value="ONCE">Once</option>
            <option value="BIWEEKLY">Biweekly</option>
          </select>
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Billing URL (optional)
          <input
            name="billingUrl"
            type="url"
            placeholder="https://"
            className={inputClass}
          />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Link import rule (optional)
          <select name="importRuleId" className={inputClass} defaultValue="">
            <option value="">None</option>
            {importRules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.matchText}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className={`${buttonPrimaryClass} w-full lg:col-span-2 lg:max-w-xs`}
        >
          Create
        </button>
      </form>
    </div>
  );
}
