import Link from "next/link";
import { FolderTree } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { groupAccent } from "@/lib/ui-accents";
import {
  buttonCompactClass,
  buttonCompactDangerClass,
  cardCompactClass,
  chipClass,
  chipMutedClass,
  inputCompactClass,
  pageStackClass,
  sectionSubheadingClass,
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

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hidden?: string; income?: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const q = sp.q?.trim().toLowerCase() || "";
  const showHidden = sp.hidden === "1";
  const incomeFilter =
    sp.income === "1" ? true : sp.income === "0" ? false : null;

  const groupsRaw = await prisma.categoryGroup.findMany({
    where: {
      budgetId: budget.id,
      ...(incomeFilter !== null ? { isIncome: incomeFilter } : {}),
    },
    orderBy: { sortOrder: "asc" },
    include: {
      categories: {
        orderBy: { sortOrder: "asc" },
        include: { targets: true },
      },
    },
  });

  const groups = groupsRaw
    .map((g) => {
      let cats = g.categories;
      if (!showHidden) {
        if (g.hidden) return null;
        cats = cats.filter((c) => !c.hidden);
      }
      if (q) {
        const groupMatch = g.name.toLowerCase().includes(q);
        cats = groupMatch
          ? cats
          : cats.filter((c) => c.name.toLowerCase().includes(q));
        if (!groupMatch && cats.length === 0) return null;
      }
      return { ...g, categories: cats };
    })
    .filter((g): g is NonNullable<typeof g> => g != null);

  const hasFilters = Boolean(q || showHidden || incomeFilter !== null);

  function href(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const next = {
      q: q || undefined,
      hidden: showHidden ? "1" : undefined,
      income:
        incomeFilter === true ? "1" : incomeFilter === false ? "0" : undefined,
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    const s = params.toString();
    return s ? `/more/categories?${s}` : "/more/categories";
  }

  return (
    <div className={pageStackClass}>
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-fg md:text-2xl">
          Categories
        </h1>
        <p className={sectionSubheadingClass}>
          Rename groups, add envelopes, hide, or reorder.
        </p>
      </div>

      <form
        method="get"
        className={`${cardCompactClass} flex flex-wrap items-end gap-2 p-3`}
      >
        <label className="min-w-[10rem] flex-1 text-xs font-medium text-fg-muted">
          Search
          <input
            name="q"
            defaultValue={sp.q?.trim() ?? ""}
            className={`${inputCompactClass} mt-1`}
            placeholder="Group or category"
          />
        </label>
        <button type="submit" className={buttonCompactClass}>
          Filter
        </button>
        {hasFilters ? (
          <Link href="/more/categories" className={buttonCompactClass}>
            Clear
          </Link>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-2" role="navigation" aria-label="Category filters">
        <Link
          href={href({ income: "0" })}
          className={incomeFilter === false ? chipClass : chipMutedClass}
        >
          Spending
        </Link>
        <Link
          href={href({ income: "1" })}
          className={incomeFilter === true ? chipClass : chipMutedClass}
        >
          Income
        </Link>
        <Link
          href={href({ hidden: showHidden ? undefined : "1" })}
          className={showHidden ? chipClass : chipMutedClass}
        >
          Show hidden
        </Link>
      </div>

      <form
        action={createCategoryGroup}
        className={`${cardCompactClass} flex flex-wrap items-end gap-2 p-3`}
      >
        <label className="min-w-[12rem] flex-1 text-xs font-medium text-fg-muted">
          New group
          <input
            name="name"
            required
            maxLength={80}
            className={`${inputCompactClass} mt-1`}
            placeholder="e.g. Vacation"
          />
        </label>
        <label className="flex h-8 items-center gap-2 text-sm text-fg">
          <input type="checkbox" name="isIncome" value="1" className="size-4" />
          Income
        </label>
        <button type="submit" className={buttonCompactClass}>
          Add group
        </button>
      </form>

      {groups.length === 0 ? (
        <div className={cardCompactClass}>
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
          className={`${cardCompactClass} overflow-hidden ${g.hidden ? "opacity-60" : ""}`}
        >
          <div
            className="flex flex-wrap items-center gap-2 border-b border-rim-subtle px-3 py-2"
            style={{
              borderLeft: `4px solid ${groupAccent(g.name)}`,
              background:
                "color-mix(in oklch, var(--accent-muted) 35%, transparent)",
            }}
          >
            <form
              action={renameCategoryGroup}
              className="flex min-w-0 flex-1 items-center gap-1"
            >
              <input type="hidden" name="id" value={g.id} />
              <input
                name="name"
                required
                defaultValue={g.name}
                className={`${inputCompactClass} min-w-0 flex-1`}
              />
              <button type="submit" className={buttonCompactClass}>
                Rename
              </button>
            </form>
            <div className="flex flex-wrap items-center gap-1">
              <form action={moveCategoryGroup}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="dir" value="up" />
                <button type="submit" className={buttonCompactClass} aria-label="Move group up">
                  ↑
                </button>
              </form>
              <form action={moveCategoryGroup}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="dir" value="down" />
                <button type="submit" className={buttonCompactClass} aria-label="Move group down">
                  ↓
                </button>
              </form>
              <form action={toggleCategoryGroupHidden}>
                <input type="hidden" name="id" value={g.id} />
                <button type="submit" className={buttonCompactClass}>
                  {g.hidden ? "Unhide" : "Hide"}
                </button>
              </form>
              <span className="text-[10px] uppercase text-fg-subtle">
                {g.isIncome ? "Income" : "Spend"}
              </span>
            </div>
          </div>

          <ul className="divide-y divide-rim-subtle/60">
            {g.categories.map((c) => (
              <li
                key={c.id}
                className={`space-y-1.5 px-3 py-2 ${c.hidden ? "opacity-50" : ""}`}
              >
                <div className="flex flex-col gap-1.5 md:flex-row md:items-center">
                  <form
                    action={renameCategory}
                    className="flex min-w-0 flex-1 items-center gap-1"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <input
                      name="name"
                      required
                      defaultValue={c.name}
                      className={`${inputCompactClass} min-w-0 flex-1`}
                      disabled={c.isSystem}
                    />
                    {!c.isSystem ? (
                      <button type="submit" className={buttonCompactClass}>
                        Save
                      </button>
                    ) : (
                      <span className="text-[10px] text-fg-subtle">sys</span>
                    )}
                  </form>
                  {c.targets[0] ? (
                    <p className="truncate text-xs text-accent md:max-w-[10rem]">
                      {formatMoney(c.targets[0].amount, budget.currency)} ·{" "}
                      {c.targets[0].type.toLowerCase().replaceAll("_", " ")}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1 md:ml-auto">
                    <form action={moveCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="dir" value="up" />
                      <button type="submit" className={buttonCompactClass} aria-label="Up">
                        ↑
                      </button>
                    </form>
                    <form action={moveCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="dir" value="down" />
                      <button type="submit" className={buttonCompactClass} aria-label="Down">
                        ↓
                      </button>
                    </form>
                    <form action={toggleCategoryHidden}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className={buttonCompactClass}>
                        {c.hidden ? "Unhide" : "Hide"}
                      </button>
                    </form>
                    {!c.isSystem ? (
                      <form action={hideOrDeleteCategory}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className={buttonCompactDangerClass}>
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>

                {!c.isIncome ? (
                  <form
                    action={setCategoryTarget}
                    className="flex flex-wrap items-center gap-1"
                  >
                    <input type="hidden" name="categoryId" value={c.id} />
                    <select
                      name="type"
                      className={`${inputCompactClass} w-[7.5rem]`}
                      defaultValue="MONTHLY_SPENDING"
                    >
                      <option value="MONTHLY_SPENDING">Monthly</option>
                      <option value="NEEDED_BY_DATE">By date</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="SAVINGS_BALANCE">Savings</option>
                    </select>
                    <input
                      name="amount"
                      className={`${inputCompactClass} w-24`}
                      placeholder="Amt"
                      inputMode="decimal"
                      required
                    />
                    <input
                      name="dueDate"
                      type="date"
                      className={`${inputCompactClass} w-[9.5rem]`}
                    />
                    <button type="submit" className={buttonCompactClass}>
                      Target
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>

          <form
            action={createCategory}
            className="flex flex-wrap items-center gap-2 border-t border-rim-subtle p-2"
          >
            <input type="hidden" name="groupId" value={g.id} />
            <input
              name="name"
              required
              maxLength={80}
              className={`${inputCompactClass} min-w-[10rem] flex-1`}
              placeholder={`Add in ${g.name}`}
              aria-label={`New category in ${g.name}`}
            />
            <button type="submit" className={buttonCompactClass}>
              Add
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
