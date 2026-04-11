import { UserEditForm } from "@/components/admin/UserEditForm";
import { prisma } from "@/lib/prisma";
import { flatTreeForSelect } from "@/lib/tree";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditUserPage({ params }: PageProps) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { categoryAccess: true },
  });
  if (!user) notFound();

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const treeNodes = categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
  }));
  const categoryOptions = flatTreeForSelect(treeNodes);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href="/admin/users"
        className="text-sm font-medium text-amber-800 hover:underline dark:text-amber-400"
      >
        ← Team
      </Link>
      <UserEditForm
        user={{
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          categoryIds: user.categoryAccess.map((a) => a.categoryId),
        }}
        categoryOptions={categoryOptions}
      />
    </div>
  );
}
