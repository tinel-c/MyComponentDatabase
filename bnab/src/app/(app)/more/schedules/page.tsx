import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney, todayISO } from "@/lib/money";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  cardCompactClass,
  inputClass,
  labelClass,
  pageStackClass,
} from "@/components/forms/field-classes";
import {
  createSchedule,
  enterScheduled,
  updateScheduleAutoEnter,
} from "../actions";

export default async function SchedulesPage() {
  const { budget } = await requireBudgetAccess();
  const [schedules, accounts, groups] = await Promise.all([
    prisma.scheduledTransaction.findMany({
      where: { budgetId: budget.id, kind: "SCHEDULED", active: true },
      orderBy: { nextDate: "asc" },
      include: { account: true, payee: true, category: true },
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
  ]);

  return (
    <div className={pageStackClass}>
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-fg md:text-2xl">
          Scheduled
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Auto-enter or manual Enter — separate from{" "}
          <Link href="/planned" className="text-accent hover:underline">
            planned payments
          </Link>
          .
        </p>
      </div>

      <ul className={`${cardCompactClass} divide-y divide-rim-subtle`}>
        {schedules.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-fg-muted">
            No scheduled transactions.
          </li>
        ) : (
          schedules.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">
                  {s.payee?.name ?? s.notes ?? "Scheduled"}
                </p>
                <p className="text-xs text-fg-subtle">
                  {s.nextDate} · {s.recurrence.toLowerCase()} · {s.account.name}
                  {s.category ? ` · ${s.category.name}` : ""}
                </p>
                <form
                  action={updateScheduleAutoEnter}
                  className="mt-1 flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="id" value={s.id} />
                  <label className="flex items-center gap-2 text-xs text-fg-muted">
                    <input
                      type="checkbox"
                      name="autoEnter"
                      value="1"
                      defaultChecked={s.autoEnter}
                      className="size-3.5"
                    />
                    Auto-enter when due
                  </label>
                  <button type="submit" className={buttonCompactClass}>
                    Save
                  </button>
                </form>
              </div>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <p className="tabular-nums text-sm font-medium text-fg">
                  {formatMoney(s.amount, budget.currency)}
                </p>
                <form action={enterScheduled}>
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className={buttonCompactClass}>
                    Enter
                  </button>
                </form>
              </div>
            </li>
          ))
        )}
      </ul>

      <form
        action={createSchedule}
        className={`${cardCompactClass} space-y-2 p-3 lg:grid lg:max-w-4xl lg:grid-cols-2 lg:gap-2 lg:space-y-0`}
      >
        <input type="hidden" name="kind" value="SCHEDULED" />
        <h2 className="text-sm font-semibold text-fg lg:col-span-2">
          New schedule
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
          Next date
          <input name="nextDate" type="date" className={inputClass} defaultValue={todayISO()} />
        </label>
        <label className={labelClass}>
          Recurrence
          <select name="recurrence" className={inputClass} defaultValue="MONTHLY">
            <option value="ONCE">Once</option>
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Biweekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-fg lg:col-span-2">
          <input type="checkbox" name="autoEnter" value="1" className="size-4" />
          Auto-enter when due (catch-up on app load)
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
