import Link from "next/link";
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

  const rules = await prisma.importCategoryRule.findMany({
    where: { budgetId: budget.id },
    include: { category: { include: { group: true } } },
    orderBy: { sortOrder: "asc" },
  });
  const groups = await prisma.categoryGroup.findMany({
    where: { budgetId: budget.id, hidden: false },
    include: {
      categories: { where: { hidden: false }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { sortOrder: "asc" },
  });

  const categoryOptions = groups.flatMap((g) =>
    g.categories.map((c) => ({
      id: c.id,
      label: `${g.name}: ${c.name}`,
    })),
  );

  const ruleRows = rules.map((rule) => ({
    id: rule.id,
    matchText: rule.matchText,
    categoryId: rule.categoryId,
    ignore: rule.ignore,
    categoryLabel: rule.category
      ? `${rule.category.group.name}: ${rule.category.name}`
      : null,
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
          Substring rules applied in order to ING memos. First match wins.{" "}
          <Link href="/more/import" className="text-accent hover:underline">
            Import CSV
          </Link>
        </p>
      </div>

      <form
        action={createImportRuleAction}
        className={`${cardCompactClass} grid gap-2 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end`}
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
        <label className="flex h-8 items-center gap-2 text-sm text-fg sm:mb-0">
          <input type="checkbox" name="ignore" value="1" className="size-4 accent-[var(--accent)]" />
          Ignore
        </label>
        <button type="submit" className={buttonCompactClass}>
          Add
        </button>
      </form>

      <ImportRulesEditor rules={ruleRows} categoryOptions={categoryOptions} />
    </div>
  );
}
