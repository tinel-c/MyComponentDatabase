import { CategoryCreateForm } from "@/components/categories/CategoryCreateForm";
import { tableClass, tdClass, thClass } from "@/components/forms/field-classes";
import { prisma } from "@/lib/prisma";
import { flatTreeForSelect } from "@/lib/tree";
import Link from "next/link";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    include: { parent: true },
    orderBy: { name: "asc" },
  });
  const treeNodes = categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
  }));
  const parentOptions = flatTreeForSelect(treeNodes);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Organize parts in a hierarchy (e.g. Resistors → SMD → 0603).
          </p>
        </div>
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
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={3} className={`${tdClass} text-zinc-500`}>
                    No categories yet. Add one on the right.
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id}>
                    <td className={tdClass}>{c.name}</td>
                    <td className={`${tdClass} text-zinc-600 dark:text-zinc-400`}>
                      {c.parent?.name ?? "—"}
                    </td>
                    <td className={tdClass}>
                      <Link
                        href={`/categories/${c.id}/edit`}
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

        <CategoryCreateForm parentOptions={parentOptions} />
      </div>
    </main>
  );
}
