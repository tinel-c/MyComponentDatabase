import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";

export { MAX_IMAGE_FILE_BYTES, MAX_PART_IMAGES } from "@/lib/part-image-constants";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

export function isAllowedImageMime(mime: string): boolean {
  return mime in MIME_TO_EXT;
}

export function extensionForMime(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null;
}

/** Resolve a public `/part-assets/...` URL to an absolute path under `public/`, or null if unsafe. */
export function resolveUploadedPartImagePath(publicUrl: string, partId: string): string | null {
  if (!publicUrl.startsWith("/part-assets/")) {
    return null;
  }
  const segments = publicUrl.split("/").filter(Boolean);
  if (segments.length < 3 || segments[0] !== "part-assets") {
    return null;
  }
  if (segments[1] !== partId) {
    return null;
  }
  const fileName = segments.slice(2).join("/");
  if (!fileName || fileName.includes("..") || path.isAbsolute(fileName)) {
    return null;
  }
  return path.join(process.cwd(), "public", "part-assets", partId, path.basename(fileName));
}

export function unlinkPartImageFile(publicUrl: string, partId: string): void {
  const abs = resolveUploadedPartImagePath(publicUrl, partId);
  if (abs && fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }
}

export function ensurePartAssetsDir(partId: string): string {
  const dir = path.join(process.cwd(), "public", "part-assets", partId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Keeps `Part.imageUrl` aligned with uploaded gallery images when the hero is empty or already points at `/part-assets/`.
 * Does not replace an external URL the user set manually.
 */
export async function syncPartHeroFromGallery(prisma: PrismaClient, partId: string): Promise<void> {
  const part = await prisma.part.findUnique({
    where: { id: partId },
    select: { imageUrl: true },
  });
  if (!part) {
    return;
  }
  const first = await prisma.partImage.findFirst({
    where: { partId },
    orderBy: { sortOrder: "asc" },
  });
  if (first) {
    const hero = part.imageUrl;
    const isLocalOrEmpty = !hero || hero.startsWith("/part-assets/");
    if (isLocalOrEmpty) {
      await prisma.part.update({
        where: { id: partId },
        data: { imageUrl: first.url },
      });
    }
  } else {
    const hero = part.imageUrl;
    if (hero?.startsWith("/part-assets/")) {
      await prisma.part.update({
        where: { id: partId },
        data: { imageUrl: null },
      });
    }
  }
}
