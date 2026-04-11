import { UserCreateForm } from "@/components/admin/UserCreateForm";
import { tableClass, tdClass, thClass } from "@/components/forms/field-classes";
import { prisma } from "@/lib/prisma";
import { flatTreeForSelect } from "@/lib/tree";
import Link from "next/link";
import { Role } from "@prisma/client";

export default async function AdminUsersPage() {
  const [users, categories] = await Promise.all([
    prisma.user.findMany({
      orderBy: { email: "asc" },
      include: {
        categoryAccess: { include: { category: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const treeNodes = categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
  }));
  const categoryOptions = flatTreeForSelect(treeNodes);

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Team & access
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Create accounts by email, then assign categories for members. Users sign in with Google
          only after their email exists here.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>User</th>
                <th className={thClass}>Role</th>
                <th className={thClass}>Visibility</th>
                <th className={`${thClass} w-24`} />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className={tdClass}>
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{u.email}</div>
                    {u.name ? (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{u.name}</div>
                    ) : null}
                  </td>
                  <td className={tdClass}>
                    <span
                      className={
                        u.role === Role.ADMIN
                          ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                          : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      }
                    >
                      {u.role === Role.ADMIN ? "Admin" : "Member"}
                    </span>
                  </td>
                  <td className={`${tdClass} max-w-xs text-zinc-600 dark:text-zinc-400`}>
                    {u.role === Role.ADMIN ? (
                      <span className="text-zinc-400">All categories</span>
                    ) : u.categoryAccess.length === 0 ? (
                      <span className="text-amber-700 dark:text-amber-400">No categories</span>
                    ) : (
                      <span className="line-clamp-2 text-sm">
                        {u.categoryAccess.map((a) => a.category.name).join(", ")}
                      </span>
                    )}
                  </td>
                  <td className={tdClass}>
                    <Link
                      href={`/admin/users/${u.id}/edit`}
                      className="font-medium text-amber-800 hover:underline dark:text-amber-400"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <UserCreateForm categoryOptions={categoryOptions} />
      </div>
    </div>
  );
}
