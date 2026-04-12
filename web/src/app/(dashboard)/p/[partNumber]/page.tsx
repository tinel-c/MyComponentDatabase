import { assertPartVisibleByPartNumber, userCanEditPart } from "@/lib/authz";
import { PartDetailView } from "@/components/parts/PartDetailView";
import { getAppBaseUrl } from "@/lib/app-url";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ partNumber: string }> };

export default async function PublicPartPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { partNumber: rawParam } = await params;
  const raw = decodeURIComponent(String(rawParam ?? "").trim());
  // Accept /p/1, /p/01, etc. (strict equality with String(n) rejected leading zeros)
  if (!/^\d+$/.test(raw)) {
    notFound();
  }
  const partNumber = Number.parseInt(raw, 10);
  if (!Number.isFinite(partNumber) || partNumber < 1) {
    notFound();
  }

  await assertPartVisibleByPartNumber(partNumber, session.user.id, session.user.role);

  const part = await prisma.part.findFirst({
    where: { partNumber },
    include: {
      category: true,
      defaultLocation: true,
      purchaseLinks: { orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!part) notFound();

  const baseUrl = await getAppBaseUrl();
  const shortLinkUrl = `${baseUrl}/p/${part.partNumber}`;

  const canEditDescription = await userCanEditPart(
    session.user.id,
    session.user.role,
    part.categoryId,
  );

  return (
    <PartDetailView
      part={part}
      shortLinkUrl={shortLinkUrl}
      canEditDescription={canEditDescription}
    />
  );
}
