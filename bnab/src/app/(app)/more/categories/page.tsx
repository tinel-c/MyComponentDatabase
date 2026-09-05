import Link from "next/link";
import { FolderTree } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { groupAccent } from "@/lib/ui-accents";
import {
  buttonDangerClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  createCategory,
  createCategoryGroup,
  hideOrDeleteCategory,
  moveCategory,
  moveCategoryGroup,
  renameCategory,
  renameCategoryGroup,
  setCategoryTarget,
  toggleCategoryGroupHidden,
  toggleCategoryHidden,
} from "../actions";

export default async function CategoriesPage() {
  const { budget } = await requireBudgetAccess();
  const groups = await prisma.categoryGroup.findMany({
    where: { budgetId: budget.id },
    orderBy: { sortOrder: "asc" },
    include: {
      categories: {
        orderBy: { sortOrder: "asc" },
        include: { targets: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-fg">Categories</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Rename groups like Bills and Frequent, add categories, hide, or reorder.
        </p>
      </div>

      <section className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold text-fg">New group</h2>
        <form action={createCategoryGroup} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            name="name"
            required
            maxLength={80}
            className={inputClass}
            placeholder="e.g. Vacation"
          />
          <button type="submit" className={buttonPrimaryClass}>
            Add group
          </button>
        </form>
      </section>

      {groups.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={FolderTree}
            title="No category groups"
            description="Create a group to organize envelopes."
          />
        </div>
      ) : null}

      {groups.map((g) => (
        <section
          key={g.id}
          className={`${cardClass} overflow-hidden ${g.hidden ? "opacity-60" : ""}`}
        >
          <div
            className="flex items-center gap-2 border-b border-rim-subtle px-3 py-3"
            style={{
              borderLeft: `4px solid ${groupAccent(g.name)}`,
              background:
                "color-mix(in oklch, var(--accent-muted) 35%, transparent)",
            }}
          >
            <div className="min-w-0 flex-1">
              <form action={renameCategoryGroup} className="flex gap-2">
                <input type="hidden" name="id" value={g.id} />
                <input
                  name="name"
                  required
                  defaultValue={g.name}
                  className={`${inputClass} mt-0`}
                />
                <button type="submit" className={buttonSecondaryClass}>
                  Rename
                </button>
              </form>
              <p className="mt-1 text-xs text-fg-subtle">
                {g.isIncome ? "Income group" : "Spending group"}
                {g.hidden ? " · hidden" : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-rim-subtle px-3 py-2">
            <form action={moveCategoryGroup}>
              <input type="hidden" name="id" value={g.id} />
              <input type="hidden" name="dir" value="up" />
              <button type="submit" className={buttonSecondaryClass}>
                ↑
              </button>
            </form>
            <form action={moveCategoryGroup}>
              <input type="hidden" name="id" value={g.id} />
              <input type="hidden" name="dir" value="down" />
              <button type="submit" className={buttonSecondaryClass}>
                ↓
              </button>
            </form>
            <form action={toggleCategoryGroupHidden}>
              <input type="hidden" name="id" value={g.id} />
              <button type="submit" className={buttonSecondaryClass}>
                {g.hidden ? "Unhide group" : "Hide group"}
              </button>
            </form>
          </div>

          <ul className="divide-y divide-rim-subtle/60">
            {g.categories.map((c) => (
              <li
                key={c.id}
                className={`space-y-3 px-4 py-3 ${c.hidden ? "opacity-50" : ""}`}
              >
                <form action={renameCategory} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="id" value={c.id} />
                  <input
                    name="name"
                    required
                    defaultValue={c.name}
                    className={inputClass}
                    disabled={c.isSystem}
                  />
                  {!c.isSystem ? (
                    <button type="submit" className={buttonSecondaryClass}>
                      Rename
                    </button>
                  ) : (
                    <span className="self-center text-xs text-fg-subtle">system</span>
                  )}
                </form>

                <div className="flex flex-wrap gap-2">
                  <form action={moveCategory}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button type="submit" className={buttonSecondaryClass}>
                      ↑
                    </button>
                  </form>
                  <form action={moveCategory}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button type="submit" className={buttonSecondaryClass}>
                      ↓
                    </button>
                  </form>
                  <form action={toggleCategoryHidden}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className={buttonSecondaryClass}>
                      {c.hidden ? "Unhide" : "Hide"}
                    </button>
                  </form>
                  {!c.isSystem ? (
                    <form action={hideOrDeleteCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className={buttonDangerClass}>
                        Remove
                      </button>
                    </form>
                  ) : null}
                </div>

                {c.targets[0] ? (
                  <p className="text-xs text-accent">
                    Target {formatMoney(c.targets[0].amount, budget.currency)} /{" "}
                    {c.targets[0].type.toLowerCase().replaceAll("_", " ")}
                  </p>
                ) : null}

                {!c.isIncome ? (
                  <form action={setCategoryTarget} className="grid gap-2 sm:grid-cols-4">
                    <input type="hidden" name="categoryId" value={c.id} />
                    <select
                      name="type"
                      className={inputClass}
                      defaultValue="MONTHLY_SPENDING"
                    >
                      <option value="MONTHLY_SPENDING">Monthly</option>
                      <option value="NEEDED_BY_DATE">By date</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="SAVINGS_BALANCE">Savings balance</option>
                    </select>
                    <input
                      name="amount"
                      className={inputClass}
                      placeholder="Amount"
                      inputMode="decimal"
                      required
                    />
                    <input name="dueDate" type="date" className={inputClass} />
                    <button type="submit" className={buttonPrimaryClass}>
                      Set target
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>

          <form
            action={createCategory}
            className="flex flex-col gap-2 border-t border-rim-subtle p-4 sm:flex-row"
          >
            <input type="hidden" name="groupId" value={g.id} />
            <label className={`${labelClass} flex-1`}>
              New category in {g.name}
              <input
                name="name"
                required
                maxLength={80}
                className={inputClass}
                placeholder="Category name"
              />
            </label>
            <button type="submit" className={`${buttonPrimaryClass} sm:mt-6`}>
              Add
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
