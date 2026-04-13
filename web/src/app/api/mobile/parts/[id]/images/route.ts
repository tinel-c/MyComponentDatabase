import { logAudit, serializePart } from "@/lib/audit";
import { assertCanEditPart, requireApiSession, toAbsoluteAssetUrl } from "@/lib/mobile-api";
import {
  ensurePartAssetsDir,
  extensionForMime,
  isAllowedImageMime,
  syncPartHeroFromGallery,
  MAX_IMAGE_FILE_BYTES,
  MAX_PART_IMAGES,
} from "@/lib/part-image-files";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireApiSession();
  if ("response" in authResult) {
    return authResult.response;
  }
  const { session } = authResult;
  const { id } = await context.params;
  const partId = id.trim();
  if (!partId) {
    return NextResponse.json({ error: "Missing part id." }, { status: 400 });
  }

  const existing = await prisma.part.findUnique({ where: { id: partId } });
  if (!existing) {
    return NextResponse.json({ error: "Part not found." }, { status: 404 });
  }

  const allowed = await assertCanEditPart(session.user.id, session.user.role, existing.categoryId);
  if (!allowed) {
    return NextResponse.json({ error: "You cannot edit this part." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const rawFiles = formData.getAll("files");
  const files = rawFiles.filter(
    (f): f is File =>
      typeof f === "object" &&
      f !== null &&
      "arrayBuffer" in f &&
      "size" in f &&
      (f as File).size > 0,
  );

  if (files.length === 0) {
    return NextResponse.json({ error: "Choose one or more image files." }, { status: 400 });
  }

  const currentCount = await prisma.partImage.count({ where: { partId } });
  if (currentCount + files.length > MAX_PART_IMAGES) {
    return NextResponse.json(
      { error: `At most ${MAX_PART_IMAGES} images per part.` },
      { status: 400 },
    );
  }

  const beforeFull = await prisma.part.findUnique({
    where: { id: partId },
    include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
  });

  const dir = ensurePartAssetsDir(partId);
  const maxOrder = (
    await prisma.partImage.aggregate({
      where: { partId },
      _max: { sortOrder: true },
    })
  )._max.sortOrder;
  const baseOrder = maxOrder ?? -1;

  const rows: { partId: string; url: string; sortOrder: number }[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mime = file.type || "application/octet-stream";
      if (!isAllowedImageMime(mime)) {
        return NextResponse.json(
          { error: `Unsupported type: ${mime}. Use JPEG, PNG, GIF, or WebP.` },
          { status: 400 },
        );
      }
      if (file.size > MAX_IMAGE_FILE_BYTES) {
        return NextResponse.json(
          { error: `Each file must be at most ${MAX_IMAGE_FILE_BYTES / (1024 * 1024)} MB.` },
          { status: 413 },
        );
      }
      const ext = extensionForMime(mime);
      if (!ext) {
        return NextResponse.json({ error: "Could not determine file extension." }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
      const dest = path.join(dir, name);
      fs.writeFileSync(dest, buf);
      const url = `/part-assets/${partId}/${name}`;
      rows.push({ partId, url, sortOrder: baseOrder + 1 + i });
    }

    await prisma.partImage.createMany({ data: rows });
    await syncPartHeroFromGallery(prisma, partId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const afterFull = await prisma.part.findUnique({
    where: { id: partId },
    include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
  });
  if (beforeFull && afterFull) {
    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      model: "Part",
      recordId: partId,
      recordName: afterFull.name,
      before: serializePart(beforeFull),
      after: serializePart(afterFull),
    });
  }

  revalidatePath("/parts");
  revalidatePath(`/parts/${partId}/edit`);
  revalidatePath(`/parts/${partId}`);
  revalidatePath(`/p/${existing.partNumber}`);
  revalidatePath("/admin/audit");

  const images = await prisma.partImage.findMany({
    where: { partId },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    ok: true,
    images: images.map((img) => ({
      id: img.id,
      url: toAbsoluteAssetUrl(request, img.url) ?? img.url,
      sortOrder: img.sortOrder,
      caption: img.caption,
    })),
  });
}
