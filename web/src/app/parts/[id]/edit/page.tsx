import { PartEditForm } from "@/components/parts/PartForm";
import { prisma } from "@/lib/prisma";
import { flatTreeForSelect } from "@/lib/tree";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPartPage({ params }: PageProps) {
  const { id } = await params;
  const part = await prisma.part.findUnique({ where: { id } });
  if (!part) notFound();

  const [categories, locations] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.storageLocation.findMany({ orderBy: { name: "asc" } }),
  ]);

  const categoryOptions = flatTreeForSelect(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
    })),
  );
  const locationOptions = flatTreeForSelect(
    locations.map((l) => ({
      id: l.id,
      name: l.name,
      parentId: l.parentId,
    })),
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <Link
        href="/parts"
        className="text-sm font-medium text-amber-800 hover:underline dark:text-amber-400"
      >
        ← Parts
      </Link>
      <div className="mt-6">
        <PartEditForm
          part={{
            id: part.id,
            internalSku: part.internalSku,
            name: part.name,
            mpn: part.mpn,
            manufacturer: part.manufacturer,
            description: part.description,
            quantityOnHand: part.quantityOnHand,
            reorderMin: part.reorderMin,
            unit: part.unit,
            categoryId: part.categoryId,
            defaultLocationId: part.defaultLocationId,
          }}
          categoryOptions={categoryOptions}
          locationOptions={locationOptions}
        />
      </div>
    </main>
  );
}
