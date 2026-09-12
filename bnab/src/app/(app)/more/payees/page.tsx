import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  cardCompactClass,
  denseTdClass,
  denseThClass,
  pageStackClass,
} from "@/components/forms/field-classes";

export default async function PayeesPage() {
  const { budget } = await requireBudgetAccess();
  const payees = await prisma.payee.findMany({
    where: { budgetId: budget.id },
    orderBy: { name: "asc" },
    include: { lastCategory: true },
  });

  return (
    <div className={pageStackClass}>
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-fg md:text-2xl">Payees</h1>
      </div>
      {payees.length === 0 ? (
        <div className={`${cardCompactClass} px-3 py-6 text-center text-sm text-fg-muted`}>
          Payees appear when you add transactions.
        </div>
      ) : (
        <>
          <div className={`${cardCompactClass} hidden overflow-x-auto md:block`}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={denseThClass}>Payee</th>
                  <th className={denseThClass}>Last category</th>
                </tr>
              </thead>
              <tbody>
                {payees.map((p) => (
                  <tr key={p.id} className="hover:bg-accent-muted/20">
                    <td className={`${denseTdClass} font-medium text-fg`}>
                      {p.name}
                    </td>
                    <td className={`${denseTdClass} text-fg-muted`}>
                      {p.lastCategory?.name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className={`${cardCompactClass} divide-y divide-rim-subtle md:hidden`}>
            {payees.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm font-medium text-fg">
                  {p.name}
                </span>
                <span className="shrink-0 text-xs text-fg-muted">
                  {p.lastCategory?.name ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
