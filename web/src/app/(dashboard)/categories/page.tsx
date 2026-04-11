import { CategoryCreateForm } from "@/components/categories/CategoryCreateForm";
import { tableClass, tdClass, thClass } from "@/components/forms/field-classes";
import { auth } from "@/auth";
import { expandVisibleCategoryIds, getVisibleCategoryIdsForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { flatTreeForSelect } from "@/lib/tree";
import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isAdmin = session.user.role === Role.ADMIN;

  let categories;
  if (isAdmin) {
    categories = await prisma.category.findMany({
      include: { parent: true },
      orderBy: { name: "asc" },
    });
  } else {
    const assigned = await getVisibleCategoryIdsForUser(session.user.id);
    const expanded = await expandVisibleCategoryIds(assigned);
    categories =
      expanded.length === 0
        ? []
        : await prisma.category.findMany({
            where: { id: { in: expanded } },
            include: { parent: true },
            orderBy: { name: "asc" },
          });
  }

  const treeNodes = categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
  }));
  const parentOptions = isAdmin ? flatTreeForSelect(treeNodes) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Categories
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {isAdmin
            ? "Organize parts in a hierarchy (e.g. Resistors → SMD → 0603)."
            : "Categories your administrator assigned to you (including children)."}
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
              {categories.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 3 : 2}
                    className={`${tdClass} text-zinc-500`}
                  >
                    {isAdmin
                      ? "No categories yet. Add one in the panel."
                      : "No categories assigned to your account yet."}
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id}>
                    <td className={tdClass}>{c.name}</td>
                    <td className={`${tdClass} text-zinc-600 dark:text-zinc-400`}>
                      {c.parent?.name ?? "—"}
                    </td>
                    {isAdmin ? (
                      <td className={tdClass}>
                        <Link
                          href={`/categories/${c.id}/edit`}
                          className="font-medium text-amber-800 hover:underline dark:text-amber-400"
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

        {isAdmin ? <CategoryCreateForm parentOptions={parentOptions} /> : null}
      </div>
    </div>
  );
}
