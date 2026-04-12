import { assertPartVisibleToUser } from "@/app/(dashboard)/parts/actions";
import { PartEditForm } from "@/components/parts/PartForm";
import { auth } from "@/auth";
import { expandVisibleCategoryIds, getVisibleCategoryIdsForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { flatTreeForSelect } from "@/lib/tree";
import { Role } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPartPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  await assertPartVisibleToUser(id);

  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      purchaseLinks: { orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!part) notFound();

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
      <PartEditForm
        part={{
          id: part.id,
          partNumber: part.partNumber,
          internalSku: part.internalSku,
          name: part.name,
          mpn: part.mpn,
          manufacturer: part.manufacturer,
          description: part.description,
          imageUrl: part.imageUrl,
          quantityOnHand: part.quantityOnHand,
          reorderMin: part.reorderMin,
          unit: part.unit,
          categoryId: part.categoryId,
          defaultLocationId: part.defaultLocationId,
          purchaseLinks: part.purchaseLinks.map((l) => ({ label: l.label, url: l.url })),
        }}
        partImages={part.images.map((img) => ({ id: img.id, url: img.url, sortOrder: img.sortOrder }))}
        categoryOptions={categoryOptions}
        locationOptions={locationOptions}
        requireCategory={session.user.role === Role.USER}
      />
    </div>
  );
}
