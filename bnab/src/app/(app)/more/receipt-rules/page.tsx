import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  ensureYngsbCategories,
  seedDefaultReceiptRules,
} from "@/lib/starter-categories";
import {
  buttonDangerClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import {
  createReceiptRuleAction,
  deleteReceiptRule,
  moveReceiptRule,
  updateReceiptRule,
} from "../receipts/actions";

export default async function ReceiptRulesPage() {
  const { budget } = await requireBudgetAccess();
  await ensureYngsbCategories(prisma, budget.id);
  await seedDefaultReceiptRules(prisma, budget.id);

  const rules = await prisma.receiptCategoryRule.findMany({
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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-fg">Receipt mappings</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Second mapping table for bill line items (Gemini detailing). First
          substring match wins — independent of ING import rules.
        </p>
      </div>

      <form
        action={createReceiptRuleAction}
        className={`${cardClass} space-y-3 p-4`}
      >
        <h2 className="text-sm font-semibold text-fg">Add rule</h2>
        <label className={labelClass}>
          Match substring
          <input name="matchText" required minLength={2} className={inputClass} />
        </label>
        <label className={labelClass}>
          Category
          <select name="categoryId" className={inputClass}>
            <option value="">—</option>
            {groups.map((g) =>
              g.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {g.name}: {c.name}
                </option>
              )),
            )}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" name="ignore" value="1" />
          Ignore line
        </label>
        <button type="submit" className={`${buttonSecondaryClass} w-full sm:w-auto`}>
          Add
        </button>
      </form>

      <ul className={`${cardClass} divide-y divide-rim-subtle/60`}>
        {rules.map((rule) => (
          <li key={rule.id} className="space-y-2 p-4">
            <form
              action={updateReceiptRule}
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              <input type="hidden" name="id" value={rule.id} />
              <label className={labelClass}>
                Match
                <input
                  name="matchText"
                  defaultValue={rule.matchText}
                  className={inputClass}
                  required
                  minLength={2}
                />
              </label>
              <label className={labelClass}>
                Category
                <select
                  name="categoryId"
                  className={inputClass}
                  defaultValue={rule.categoryId ?? ""}
                >
                  <option value="">—</option>
                  {groups.map((g) =>
                    g.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {g.name}: {c.name}
                      </option>
                    )),
                  )}
                </select>
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex items-center gap-2 pb-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    name="ignore"
                    value="1"
                    defaultChecked={rule.ignore}
                  />
                  Ignore
                </label>
                <button type="submit" className={`${buttonSecondaryClass} w-full sm:w-auto`}>
                  Save
                </button>
              </div>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action={moveReceiptRule}>
                <input type="hidden" name="id" value={rule.id} />
                <input type="hidden" name="dir" value="up" />
                <button type="submit" className={buttonSecondaryClass}>
                  ↑
                </button>
              </form>
              <form action={moveReceiptRule}>
                <input type="hidden" name="id" value={rule.id} />
                <input type="hidden" name="dir" value="down" />
                <button type="submit" className={buttonSecondaryClass}>
                  ↓
                </button>
              </form>
              <form action={deleteReceiptRule}>
                <input type="hidden" name="id" value={rule.id} />
                <button type="submit" className={buttonDangerClass}>
                  Delete
                </button>
              </form>
              <p className="self-center text-xs text-fg-subtle">
                {rule.ignore
                  ? "→ ignore"
                  : rule.category
                    ? `→ ${rule.category.group.name}: ${rule.category.name}`
                    : "→ (no category)"}
              </p>
            </div>
          </li>
        ))}
        {rules.length === 0 && (
          <li className="p-4 text-sm text-fg-muted">No rules yet.</li>
        )}
      </ul>
    </div>
  );
}
