import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import {
  buttonPrimaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { setCategoryTarget } from "../actions";

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
      </div>

      {groups.map((g) => (
        <section key={g.id} className={cardClass}>
          <h2 className="border-b border-rim-subtle px-4 py-3 text-sm font-semibold text-fg">
            {g.name}
            {g.isIncome ? " · income" : ""}
          </h2>
          <ul className="divide-y divide-rim-subtle/60">
            {g.categories.map((c) => (
              <li key={c.id} className="space-y-3 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-fg">{c.name}</p>
                  {c.targets[0] ? (
                    <p className="text-xs text-accent">
                      Target {formatMoney(c.targets[0].amount, budget.currency)} /{" "}
                      {c.targets[0].type.toLowerCase().replaceAll("_", " ")}
                    </p>
                  ) : null}
                </div>
                {!c.isIncome ? (
                  <form action={setCategoryTarget} className="grid gap-2 sm:grid-cols-4">
                    <input type="hidden" name="categoryId" value={c.id} />
                    <select name="type" className={inputClass} defaultValue="MONTHLY_SPENDING">
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
        </section>
      ))}
    </div>
  );
}
