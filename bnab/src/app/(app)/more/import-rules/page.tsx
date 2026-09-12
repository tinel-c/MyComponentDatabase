import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  ensureYngsbCategories,
  seedDefaultImportRules,
} from "@/lib/starter-categories";
import {
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
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
    <div className="space-y-6">
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-fg">Import mappings</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Substring rules applied in order to ING memos. First match wins.{" "}
          <Link href="/more/import" className="text-accent hover:underline">
            Import CSV
          </Link>
        </p>
      </div>

      <form action={createImportRuleAction} className={`${cardClass} space-y-3 p-4`}>
        <h2 className="text-sm font-semibold text-fg">Add rule</h2>
        <label className={labelClass}>
          Match substring
          <input name="matchText" required minLength={3} className={inputClass} />
        </label>
        <label className={labelClass}>
          Category
          <select name="categoryId" className={inputClass}>
            <option value="">—</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" name="ignore" value="1" />
          Ignore (skip import)
        </label>
        <button type="submit" className={buttonSecondaryClass}>
          Add
        </button>
      </form>

      <ImportRulesEditor rules={ruleRows} categoryOptions={categoryOptions} />
    </div>
  );
}
