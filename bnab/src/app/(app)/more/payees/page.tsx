import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { cardClass } from "@/components/forms/field-classes";

export default async function PayeesPage() {
  const { budget } = await requireBudgetAccess();
  const payees = await prisma.payee.findMany({
    where: { budgetId: budget.id },
    orderBy: { name: "asc" },
    include: { lastCategory: true },
  });

  return (
    <div className="space-y-4">
      <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
        ← More
      </Link>
      <h1 className="text-2xl font-semibold text-fg">Payees</h1>
      {payees.length === 0 ? (
        <div className={`${cardClass} px-4 py-8 text-center text-sm text-fg-muted`}>
          Payees appear when you add transactions.
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {payees.map((p) => (
            <li
              key={p.id}
              className={`${cardClass} flex items-center justify-between gap-3 px-4 py-3`}
            >
              <span className="min-w-0 truncate font-medium text-fg">
                {p.name}
              </span>
              <span className="shrink-0 text-sm text-fg-muted">
                {p.lastCategory?.name ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
