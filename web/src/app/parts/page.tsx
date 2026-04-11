import { tableClass, tdClass, thClass } from "@/components/forms/field-classes";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function PartsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = q?.trim();

  const parts = await prisma.part.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query } },
            { mpn: { contains: query } },
            { internalSku: { contains: query } },
            { manufacturer: { contains: query } },
          ],
        }
      : undefined,
    include: { category: true, defaultLocation: true },
    orderBy: { name: "asc" },
    take: 500,
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parts</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Search by name, MPN, internal SKU, or manufacturer.
          </p>
        </div>
        <Link
          href="/parts/new"
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Add part
        </Link>
      </div>

      <form method="get" className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query ?? ""}
          placeholder="Search…"
          className="w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 dark:border-zinc-700 dark:bg-zinc-950 sm:flex-1"
        />
        <button
          type="submit"
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>SKU</th>
              <th className={thClass}>Qty</th>
              <th className={thClass}>Category</th>
              <th className={thClass}>Location</th>
              <th className={`${thClass} w-24`} />
            </tr>
          </thead>
          <tbody>
            {parts.length === 0 ? (
              <tr>
                <td colSpan={6} className={`${tdClass} text-zinc-500`}>
                  {query ? "No matches." : "No parts yet. Add your first part."}
                </td>
              </tr>
            ) : (
              parts.map((p) => {
                const low =
                  p.reorderMin != null && p.quantityOnHand <= p.reorderMin;
                return (
                  <tr key={p.id}>
                    <td className={tdClass}>
                      <span className="font-medium">{p.name}</span>
                      {low ? (
                        <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                          Low
                        </span>
                      ) : null}
                    </td>
                    <td className={`${tdClass} text-zinc-600 dark:text-zinc-400`}>
                      {p.internalSku ?? "—"}
                    </td>
                    <td className={tdClass}>
                      {p.quantityOnHand} {p.unit}
                    </td>
                    <td className={`${tdClass} text-zinc-600 dark:text-zinc-400`}>
                      {p.category?.name ?? "—"}
                    </td>
                    <td className={`${tdClass} text-zinc-600 dark:text-zinc-400`}>
                      {p.defaultLocation?.name ?? "—"}
                    </td>
                    <td className={tdClass}>
                      <Link
                        href={`/parts/${p.id}/edit`}
                        className="font-medium text-amber-800 hover:underline dark:text-amber-400"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
