import { tableClass, tdClass, thClass } from "@/components/forms/field-classes";
import { LocationCreateForm } from "@/components/locations/LocationCreateForm";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { flatTreeForSelect } from "@/lib/tree";
import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LocationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isAdmin = session.user.role === Role.ADMIN;

  const locations = await prisma.storageLocation.findMany({
    include: { parent: true },
    orderBy: { name: "asc" },
  });

  const treeNodes = locations.map((l) => ({
    id: l.id,
    name: l.name,
    parentId: l.parentId,
  }));
  const parentOptions = isAdmin ? flatTreeForSelect(treeNodes) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Storage locations
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {isAdmin
            ? "Map shelves, bins, and drawers."
            : "Read-only view of warehouse locations (for reference on parts)."}
        </p>
      </header>

      <div
        className={
          isAdmin
            ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]"
            : "grid gap-10"
        }
      >
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Parent</th>
                {isAdmin ? <th className={`${thClass} w-28`} /> : null}
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 3 : 2}
                    className={`${tdClass} text-zinc-500`}
                  >
                    {isAdmin
                      ? "No locations yet. Add one in the panel."
                      : "No locations configured yet."}
                  </td>
                </tr>
              ) : (
                locations.map((l) => (
                  <tr key={l.id}>
                    <td className={tdClass}>{l.name}</td>
                    <td className={`${tdClass} text-zinc-600 dark:text-zinc-400`}>
                      {l.parent?.name ?? "—"}
                    </td>
                    {isAdmin ? (
                      <td className={tdClass}>
                        <Link
                          href={`/locations/${l.id}/edit`}
                          className="font-medium text-zinc-400 hover:text-zinc-200 hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {isAdmin ? <LocationCreateForm parentOptions={parentOptions} /> : null}
      </div>
    </div>
  );
}
