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
      <ul className={`${cardClass} divide-y divide-rim-subtle`}>
        {payees.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-fg-muted">
            Payees appear when you add transactions.
          </li>
        ) : (
          payees.map((p) => (
            <li key={p.id} className="flex justify-between px-4 py-3">
              <span className="font-medium text-fg">{p.name}</span>
              <span className="text-sm text-fg-muted">
                {p.lastCategory?.name ?? "—"}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
