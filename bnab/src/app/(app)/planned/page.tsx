import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney, todayISO } from "@/lib/money";
import {
  buttonPrimaryClass,
  cardCompactClass,
  inputClass,
  labelClass,
  pageStackClass,
} from "@/components/forms/field-classes";
import { createSchedule } from "@/app/(app)/more/actions";
import { ExternalLink } from "lucide-react";

export default async function PlannedPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const highlightId = sp.id ?? null;
  const today = todayISO();

  const [schedules, accounts, groups, importRules] = await Promise.all([
    prisma.scheduledTransaction.findMany({
      where: { budgetId: budget.id, kind: "PLANNED" },
      orderBy: [{ active: "desc" }, { nextDate: "asc" }],
      include: {
        account: true,
        payee: true,
        category: true,
        importRule: { select: { id: true, matchText: true } },
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
  ]);

  const due = schedules.filter((s) => s.active && s.nextDate <= today);
  const upcoming = schedules.filter((s) => s.active && s.nextDate > today);
  const inactive = schedules.filter((s) => !s.active);

  function row(
    s: (typeof schedules)[number],
    tone: "due" | "upcoming" | "inactive",
  ) {
    const highlighted = highlightId === s.id;
    return (
      <li
        key={s.id}
        id={`planned-${s.id}`}
        className={`flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center ${
          highlighted ? "bg-accent-muted/50" : ""
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">
            {s.payee?.name ?? s.notes ?? "Planned payment"}
            {tone === "due" && (
              <span className="ml-2 text-[10px] font-semibold uppercase text-danger">
                Due
              </span>
            )}
          </p>
          <p className="text-xs text-fg-subtle">
            {s.nextDate} · {s.recurrence.toLowerCase()} · {s.account.name}
            {s.category ? ` · ${s.category.name}` : ""}
            {s.importRule ? ` · Rule: ${s.importRule.matchText}` : ""}
          </p>
          {s.billingUrl ? (
            <a
              href={s.billingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Billing <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
        </div>
        <p className="tabular-nums text-sm font-medium text-fg sm:text-right">
          {formatMoney(s.amount, budget.currency)}
        </p>
      </li>
    );
  }

  return (
    <div className={pageStackClass}>
      <div>
        <h1 className="text-xl font-semibold text-fg md:text-2xl">
          Planned payments
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Recurring ledger expectations matched on import (not bill scans). See{" "}
          <code className="text-xs">docs/import-vocabulary.md</code> ·{" "}
          <Link href="/more/schedules" className="text-accent hover:underline">
            Auto-enter schedules
          </Link>
        </p>
      </div>

      <section className={cardCompactClass}>
        <h2 className="border-b border-rim-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          Due / overdue ({due.length})
        </h2>
        <ul className="divide-y divide-rim-subtle">
          {due.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-fg-muted">
              Nothing due
            </li>
          ) : (
            due.map((s) => row(s, "due"))
          )}
        </ul>
      </section>

      <section className={cardCompactClass}>
        <h2 className="border-b border-rim-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          Upcoming ({upcoming.length})
        </h2>
        <ul className="divide-y divide-rim-subtle">
          {upcoming.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-fg-muted">
              No upcoming planned payments
            </li>
          ) : (
            upcoming.map((s) => row(s, "upcoming"))
          )}
        </ul>
      </section>

      {inactive.length > 0 ? (
        <section className={cardCompactClass}>
          <h2 className="border-b border-rim-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Inactive ({inactive.length})
          </h2>
          <ul className="divide-y divide-rim-subtle">
            {inactive.map((s) => row(s, "inactive"))}
          </ul>
        </section>
      ) : null}

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
          Next date
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
