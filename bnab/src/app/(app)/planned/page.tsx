import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/money";
import {
  buttonPrimaryClass,
  cardCompactClass,
  inputClass,
  labelClass,
  pageStackClass,
} from "@/components/forms/field-classes";
import {
  createSchedule,
} from "@/app/(app)/more/actions";
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

  const [schedules, accounts, groups, importRules] = await Promise.all([
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
  ]);

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
