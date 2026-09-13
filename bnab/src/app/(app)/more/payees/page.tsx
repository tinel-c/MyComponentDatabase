import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  buttonCompactClass,
  cardCompactClass,
  denseTdClass,
  denseThClass,
  inputCompactClass,
  pageStackClass,
} from "@/components/forms/field-classes";

export default async function PayeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const q = sp.q?.trim() || "";

  const payees = await prisma.payee.findMany({
    where: {
      budgetId: budget.id,
      ...(q ? { name: { contains: q } } : {}),
    },
    orderBy: { name: "asc" },
    include: { lastCategory: true },
  });

  return (
    <div className={pageStackClass}>
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-fg md:text-2xl">
          Payees
        </h1>
      </div>

      <form
        method="get"
        className={`${cardCompactClass} flex flex-wrap items-end gap-2 p-3`}
      >
        <label className="min-w-[12rem] flex-1 text-xs font-medium text-fg-muted">
          Search
          <input
            name="q"
            defaultValue={q}
            className={`${inputCompactClass} mt-1`}
            placeholder="Payee name"
          />
        </label>
        <button type="submit" className={buttonCompactClass}>
          Filter
        </button>
        {q ? (
          <Link href="/more/payees" className={buttonCompactClass}>
            Clear
          </Link>
        ) : null}
      </form>

      {payees.length === 0 ? (
        <div
          className={`${cardCompactClass} px-3 py-6 text-center text-sm text-fg-muted`}
        >
          {q
            ? "No matching payees."
            : "Payees appear when you add transactions."}
        </div>
      ) : (
        <>
          <div className={`${cardCompactClass} hidden overflow-x-auto md:block`}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={denseThClass}>Payee</th>
                  <th className={denseThClass}>Last category</th>
                  <th className={denseThClass}>Transactions</th>
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
                    <td className={denseTdClass}>
                      <Link
                        href={`/transactions?payee=${encodeURIComponent(p.name)}`}
                        className="text-accent hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul
            className={`${cardCompactClass} divide-y divide-rim-subtle md:hidden`}
          >
            {payees.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/transactions?payee=${encodeURIComponent(p.name)}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-overlay/40"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-fg">
                    {p.name}
                  </span>
                  <span className="shrink-0 text-xs text-fg-muted">
                    {p.lastCategory?.name ?? "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
