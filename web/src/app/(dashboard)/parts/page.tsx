import { tableClass, tdClass, thClass } from "@/components/forms/field-classes";
import { auth } from "@/auth";
import { partVisibilityWhere } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function PartsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isAdmin = session.user.role === Role.ADMIN;

  const { q } = await searchParams;
  const query = q?.trim();

  const vis = await partVisibilityWhere(session.user.id, session.user.role);
  const searchWhere = query
    ? {
        OR: [
          { name: { contains: query } },
          { mpn: { contains: query } },
          { internalSku: { contains: query } },
          { manufacturer: { contains: query } },
        ],
      }
    : undefined;

  const where =
    vis && searchWhere
      ? { AND: [vis, searchWhere] }
      : vis
        ? vis
        : searchWhere
          ? searchWhere
          : undefined;

  const parts = await prisma.part.findMany({
    where,
    include: { category: true, defaultLocation: true },
    orderBy: { name: "asc" },
    take: 500,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Parts
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {isAdmin
              ? "Search by name, MPN, internal SKU, or manufacturer."
              : "Only parts in categories assigned to you are listed."}
          </p>
        </div>
        <Link
          href="/parts/new"
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Add part
        </Link>
      </header>

      <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query ?? ""}
          placeholder="Search…"
          className="w-full max-w-md rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/30 dark:border-zinc-700 dark:bg-zinc-950 sm:flex-1"
        />
        <button
          type="submit"
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
                  {query ? "No matches." : "No parts yet — add your first part."}
                </td>
              </tr>
            ) : (
              parts.map((p) => {
                const low =
                  p.reorderMin != null && p.quantityOnHand <= p.reorderMin;
                return (
                  <tr key={p.id}>
                    <td className={tdClass}>
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {p.name}
                      </span>
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
    </div>
  );
}
