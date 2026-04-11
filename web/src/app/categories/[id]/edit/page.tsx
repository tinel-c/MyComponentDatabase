import { CategoryEditForm } from "@/components/categories/CategoryEditForm";
import { prisma } from "@/lib/prisma";
import { blockedDescendantIds } from "@/lib/tree";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditCategoryPage({ params }: PageProps) {
  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) notFound();

  const all = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const nodes = all.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
  }));
  const blocked = blockedDescendantIds(category.id, nodes);
  const parentOptions = all
    .filter((c) => !blocked.has(c.id))
    .map((c) => ({ id: c.id, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 sm:px-6">
      <Link
        href="/categories"
        className="text-sm font-medium text-amber-800 hover:underline dark:text-amber-400"
      >
        ← Categories
      </Link>
      <div className="mt-6">
        <CategoryEditForm category={category} parentOptions={parentOptions} />
      </div>
    </main>
  );
}
