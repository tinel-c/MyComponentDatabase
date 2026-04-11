import { tableClass, tdClass, thClass } from "@/components/forms/field-classes";
import { LocationCreateForm } from "@/components/locations/LocationCreateForm";
import { prisma } from "@/lib/prisma";
import { flatTreeForSelect } from "@/lib/tree";
import Link from "next/link";

export default async function LocationsPage() {
  const locations = await prisma.storageLocation.findMany({
    include: { parent: true },
    orderBy: { name: "asc" },
  });
  const treeNodes = locations.map((l) => ({
    id: l.id,
    name: l.name,
    parentId: l.parentId,
  }));
  const parentOptions = flatTreeForSelect(treeNodes);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Storage locations</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Map shelves, bins, and drawers so you can find parts quickly.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Parent</th>
                <th className={`${thClass} w-28`} />
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr>
                  <td colSpan={3} className={`${tdClass} text-zinc-500`}>
                    No locations yet. Add one on the right.
                  </td>
                </tr>
              ) : (
                locations.map((l) => (
                  <tr key={l.id}>
                    <td className={tdClass}>{l.name}</td>
                    <td className={`${tdClass} text-zinc-600 dark:text-zinc-400`}>
                      {l.parent?.name ?? "—"}
                    </td>
                    <td className={tdClass}>
                      <Link
                        href={`/locations/${l.id}/edit`}
                        className="font-medium text-amber-800 hover:underline dark:text-amber-400"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <LocationCreateForm parentOptions={parentOptions} />
      </div>
    </main>
  );
}
