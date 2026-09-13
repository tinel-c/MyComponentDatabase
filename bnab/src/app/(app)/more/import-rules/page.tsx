import Link from "next/link";
import { Suspense } from "react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  ensureYngsbCategories,
  seedDefaultImportRules,
} from "@/lib/starter-categories";
import {
  buttonCompactClass,
  cardCompactClass,
  inputCompactClass,
  pageStackClass,
  sectionSubheadingClass,
} from "@/components/forms/field-classes";
import { createImportRuleAction } from "../import/actions";
import { ImportRulesEditor } from "@/components/import/ImportRulesEditor";

export default async function ImportRulesPage() {
  const { budget } = await requireBudgetAccess();
  await ensureYngsbCategories(prisma, budget.id);
  await seedDefaultImportRules(prisma, budget.id);

  const [rules, groups, accounts] = await Promise.all([
    prisma.importCategoryRule.findMany({
      where: { budgetId: budget.id },
      include: {
        category: { include: { group: true } },
        transferAccount: { select: { id: true, name: true } },
        schedules: {
          where: { active: true },
          select: {
            id: true,
            notes: true,
            payee: { select: { name: true } },
          },
          take: 5,
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.categoryGroup.findMany({
      where: { budgetId: budget.id, hidden: false },
      include: {
        categories: { where: { hidden: false }, orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.financeAccount.findMany({
      where: { budgetId: budget.id, closed: false },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, type: true },
    }),
  ]);

  const categoryOptions = groups.flatMap((g) =>
    g.categories.map((c) => ({
      id: c.id,
      label: `${g.name}: ${c.name}`,
    })),
  );

  const accountOptions = accounts.map((a) => ({
    id: a.id,
    label: a.name,
  }));

  const ruleRows = rules.map((rule) => ({
    id: rule.id,
    matchText: rule.matchText,
    categoryId: rule.categoryId,
    ignore: rule.ignore,
    categoryLabel: rule.category
      ? `${rule.category.group.name}: ${rule.category.name}`
      : null,
    transferAccountId: rule.transferAccountId,
    transferAccountLabel: rule.transferAccount?.name ?? null,
    plannedLinks: rule.schedules.map((s) => ({
      id: s.id,
      label: s.payee?.name ?? s.notes ?? "Planned payment",
    })),
  }));

  return (
    <div className={pageStackClass}>
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-fg md:text-2xl">
          Import mappings
        </h1>
        <p className={sectionSubheadingClass}>
          Substring rules applied in order to ING memos. First match wins.
          Transfer-only rules create a linked pair. Category + transfer (e.g.
          Paycheck + savings) categorizes the statement row and posts the
          opposite amount on the other account.{" "}
          <Link href="/more/import" className="text-accent hover:underline">
            Import CSV
          </Link>
          . Vocabulary: Import rule ≠ Receipt rule ≠ Planned payment (
          <code className="text-xs">docs/import-vocabulary.md</code>).
        </p>
      </div>

      <form
        action={createImportRuleAction}
        className={`${cardCompactClass} grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] sm:items-end`}
      >
        <label className="block text-xs font-medium text-fg-muted">
          Match
          <input
            name="matchText"
            required
            minLength={3}
            className={`${inputCompactClass} mt-1`}
          />
        </label>
        <label className="block text-xs font-medium text-fg-muted">
          Category
          <select name="categoryId" className={`${inputCompactClass} mt-1`}>
            <option value="">—</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-fg-muted">
          Transfer / debit account
          <select
            name="transferAccountId"
            className={`${inputCompactClass} mt-1`}
          >
            <option value="">— none —</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-8 items-center gap-2 text-sm text-fg sm:mb-0">
          <input
            type="checkbox"
            name="ignore"
            value="1"
            className="size-4 accent-[var(--accent)]"
          />
          Ignore
        </label>
        <button type="submit" className={buttonCompactClass}>
          Add
        </button>
      </form>
      <p className="text-xs text-fg-subtle">
        Category alone categorizes the statement row. Transfer alone (Category
        = —) creates a linked twin: statement keeps the CSV sign, the other
        account gets the opposite (checking → savings = out / in). Income
        category + savings posts income on the statement account and a debit
        twin on savings. Ignore excludes the row from the budget.
      </p>

      <Suspense fallback={<p className="text-sm text-fg-muted">Loading mappings…</p>}>
        <ImportRulesEditor
          rules={ruleRows}
          categoryOptions={categoryOptions}
          accountOptions={accountOptions}
        />
      </Suspense>
    </div>
  );
}
