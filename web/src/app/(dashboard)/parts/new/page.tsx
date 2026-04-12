import { PartCreateForm } from "@/components/parts/PartForm";
import { auth } from "@/auth";
import { expandVisibleCategoryIds, getVisibleCategoryIdsForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { flatTreeForSelect } from "@/lib/tree";
import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function NewPartPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const locations = await prisma.storageLocation.findMany({ orderBy: { name: "asc" } });
  const locationOptions = flatTreeForSelect(
    locations.map((l) => ({
      id: l.id,
      name: l.name,
      parentId: l.parentId,
    })),
  );

  let categoryOptions: { id: string; label: string }[];

  if (session.user.role === Role.ADMIN) {
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    categoryOptions = flatTreeForSelect(
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId,
      })),
    );
  } else {
    const assigned = await getVisibleCategoryIdsForUser(session.user.id);
    const expanded = await expandVisibleCategoryIds(assigned);
    const categories =
      expanded.length === 0
        ? []
        : await prisma.category.findMany({
            where: { id: { in: expanded } },
            orderBy: { name: "asc" },
          });
    categoryOptions = categories.map((c) => ({
      id: c.id,
      label: c.name,
    }));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/parts"
        className="text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:underline"
      >
        ← Parts
      </Link>
      <PartCreateForm
        categoryOptions={categoryOptions}
        locationOptions={locationOptions}
        requireCategory={session.user.role === Role.USER}
      />
    </div>
  );
}
