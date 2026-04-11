import { LocationEditForm } from "@/components/locations/LocationEditForm";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { blockedDescendantIds } from "@/lib/tree";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditLocationPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const location = await prisma.storageLocation.findUnique({ where: { id } });
  if (!location) notFound();

  const all = await prisma.storageLocation.findMany({ orderBy: { name: "asc" } });
  const nodes = all.map((l) => ({
    id: l.id,
    name: l.name,
    parentId: l.parentId,
  }));
  const blocked = blockedDescendantIds(location.id, nodes);
  const parentOptions = all
    .filter((l) => !blocked.has(l.id))
    .map((l) => ({ id: l.id, label: l.name }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 sm:px-6">
      <Link
        href="/locations"
        className="text-sm font-medium text-amber-800 hover:underline dark:text-amber-400"
      >
        ← Storage locations
      </Link>
      <div className="mt-6">
        <LocationEditForm location={location} parentOptions={parentOptions} />
      </div>
    </main>
  );
}
