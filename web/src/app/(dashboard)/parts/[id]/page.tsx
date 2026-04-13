import { assertPartVisibleToUser } from "@/app/(dashboard)/parts/actions";
import { PartDetailView } from "@/components/parts/PartDetailView";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/app-url";
import { userCanEditPart } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

/** Canonical in-app part page: /parts/{id} — always registered; avoids /p/{n} routing issues. */
export default async function PartByIdPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  if (id === "new") {
    notFound();
  }

  await assertPartVisibleToUser(id);

  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      category: true,
      defaultLocation: true,
      purchaseLinks: { orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!part) notFound();

  const baseUrl = await getAppBaseUrl();
  const shortLinkUrl =
    part.partNumber != null ? `${baseUrl}/p/${part.partNumber}` : `${baseUrl}/parts/${part.id}`;

  const canEditDescription = await userCanEditPart(
    session.user.id,
    session.user.role,
    part.categoryId,
  );
  const [categoryOptions, locationOptions] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.storageLocation.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <PartDetailView
      part={part}
      shortLinkUrl={shortLinkUrl}
      canEditDescription={canEditDescription}
      canEditDetails={canEditDescription}
      categoryOptions={categoryOptions}
      locationOptions={locationOptions}
    />
  );
}
