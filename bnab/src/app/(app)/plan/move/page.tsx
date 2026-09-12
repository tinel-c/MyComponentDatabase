import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { currentMonth } from "@/lib/money";
import { MoveMoneyForm } from "@/components/plan/MoveMoneyForm";
import {
  cardClass,
  sectionHeadingClass,
  sectionSubheadingClass,
} from "@/components/forms/field-classes";

export default async function MoveMoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const month =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentMonth();

  const groups = await prisma.categoryGroup.findMany({
    where: { budgetId: budget.id, hidden: false, isIncome: false },
    orderBy: { sortOrder: "asc" },
    include: {
      categories: {
        where: { hidden: false },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      },
    },
  });

  const categories = groups.flatMap((g) =>
    g.categories.map((c) => ({ id: c.id, name: c.name })),
  );

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <Link
          href={`/plan?month=${encodeURIComponent(month)}`}
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Back to Plan
        </Link>
        <h1 className={`${sectionHeadingClass} mt-2`}>Move money</h1>
        <p className={sectionSubheadingClass}>
          Shift assigned amounts between envelopes for {month} without changing
          Ready to Assign.
        </p>
      </div>

      <section className={`${cardClass} p-4`}>
        {categories.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No spending categories yet. Add groups under More → Categories.
          </p>
        ) : (
          <MoveMoneyForm month={month} categories={categories} />
        )}
      </section>
    </div>
  );
}
