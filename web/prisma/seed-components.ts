import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { PrismaClient } from "../src/generated/prisma-client";

const DESCRIPTION_MAX = 100_000;
const MAX_IMAGES_PER_PART = 48;
const IMAGE_RE = /\.(jpe?g|png|gif|webp)$/i;

function sanitizeImageBasename(fileName: string): string {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 96);
  return `${safe}${ext.toLowerCase()}`;
}

function trySummaryImagePaths(dir: string): string[] {
  const summaryPath = path.join(dir, "summary.json");
  if (!fs.existsSync(summaryPath)) {
    return [];
  }
  try {
    const j = JSON.parse(fs.readFileSync(summaryPath, "utf8")) as { images?: unknown };
    if (!Array.isArray(j.images)) {
      return [];
    }
    const out: string[] = [];
    for (const name of j.images) {
      if (typeof name !== "string") {
        continue;
      }
      const fp = path.join(dir, name);
      if (fs.existsSync(fp) && fs.statSync(fp).isFile() && IMAGE_RE.test(name)) {
        out.push(fp);
      }
    }
    return out.slice(0, MAX_IMAGES_PER_PART);
  } catch {
    return [];
  }
}

function listRootImages(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && IMAGE_RE.test(e.name))
    .map((e) => path.join(dir, e.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { sensitivity: "base" }))
    .slice(0, MAX_IMAGES_PER_PART);
}

const SKIP_SUBDIR = /^(node_modules|\.git|__pycache__)$/i;
/** Skip bulky SDK/library trees when searching for product photos. */
const SKIP_SUBDIR_PREFIX =
  /^(Arduinio libraries|Arduino libraries|SerialMP3PlayerDemoCode|SSCOM32 Serial Tool|Voice Sources for TF card)$/i;

function walkCollectImages(dir: string, depth: number, maxDepth: number, out: string[]): void {
  if (depth > maxDepth || out.length >= MAX_IMAGES_PER_PART) {
    return;
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const subdirs: string[] = [];
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_SUBDIR.test(e.name)) {
        continue;
      }
      if (SKIP_SUBDIR_PREFIX.test(e.name)) {
        continue;
      }
      subdirs.push(full);
    } else if (e.isFile() && IMAGE_RE.test(e.name)) {
      files.push(full);
    }
  }
  files.sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { sensitivity: "base" }));
  for (const f of files) {
    if (out.length >= MAX_IMAGES_PER_PART) {
      return;
    }
    out.push(f);
  }
  subdirs.sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { sensitivity: "base" }));
  for (const sd of subdirs) {
    walkCollectImages(sd, depth + 1, maxDepth, out);
    if (out.length >= MAX_IMAGES_PER_PART) {
      return;
    }
  }
}

function collectImageSourceFiles(dir: string): string[] {
  const fromSummary = trySummaryImagePaths(dir);
  if (fromSummary.length > 0) {
    return fromSummary;
  }
  const root = listRootImages(dir);
  if (root.length > 0) {
    return root;
  }
  const out: string[] = [];
  walkCollectImages(dir, 0, 5, out);
  return out.slice(0, MAX_IMAGES_PER_PART);
}

/**
 * Copies images into `web/public/part-assets/{partId}/` and returns public URL paths (same order).
 */
function copyImagesToPublic(partId: string, sourceDir: string, webRoot: string): string[] {
  const files = collectImageSourceFiles(sourceDir);
  const destRoot = path.join(webRoot, "public", "part-assets", partId);
  if (fs.existsSync(destRoot)) {
    fs.rmSync(destRoot, { recursive: true, force: true });
  }
  if (files.length === 0) {
    return [];
  }
  fs.mkdirSync(destRoot, { recursive: true });
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const src = files[i];
    const destName = `${String(i).padStart(2, "0")}-${sanitizeImageBasename(path.basename(src))}`;
    const dest = path.join(destRoot, destName);
    fs.copyFileSync(src, dest);
    urls.push(`/part-assets/${partId}/${destName}`);
  }
  return urls;
}

function stableHash(folderName: string): string {
  return crypto.createHash("sha256").update(folderName).digest("hex").slice(0, 20);
}

function parseFolderName(folderName: string): { folderNum: string | null; displayName: string } {
  const m = folderName.match(/^(\d+)\s+([\s\S]+)$/);
  if (m) {
    return { folderNum: m[1], displayName: m[2].trim().slice(0, 300) };
  }
  return { folderNum: null, displayName: folderName.trim().slice(0, 300) };
}

function findDescription(dir: string): string | null {
  const processed = path.join(dir, "description_processed.txt");
  if (fs.existsSync(processed)) {
    return fs.readFileSync(processed, "utf8");
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile() && e.name.startsWith("Description ") && e.name.endsWith(".txt")) {
      return fs.readFileSync(path.join(dir, e.name), "utf8");
    }
  }

  const summaryPath = path.join(dir, "summary.json");
  if (fs.existsSync(summaryPath)) {
    try {
      const j = JSON.parse(fs.readFileSync(summaryPath, "utf8")) as {
        title?: string;
        url?: string;
        description?: string;
      };
      const chunks: string[] = [];
      if (j.title) {
        chunks.push(`## ${j.title}`, "");
      }
      if (j.url) {
        chunks.push(`[Product link](${j.url})`, "");
      }
      if (j.description && j.description.length < 2000) {
        chunks.push(j.description);
      }
      const text = chunks.join("\n").trim();
      if (text) {
        return text;
      }
    } catch {
      /* ignore */
    }
  }

  const rootTxts = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".txt"));
  for (const e of rootTxts) {
    const n = e.name.toLowerCase();
    if (n.includes("pcb") || n.includes("readme") || n.includes("adapter")) {
      return fs.readFileSync(path.join(dir, e.name), "utf8");
    }
  }
  if (rootTxts.length === 1) {
    return fs.readFileSync(path.join(dir, rootTxts[0].name), "utf8");
  }
  if (rootTxts.length > 0) {
    return fs.readFileSync(path.join(dir, rootTxts[0].name), "utf8");
  }

  return null;
}

function extractListingUrl(dir: string): string | null {
  const summaryPath = path.join(dir, "summary.json");
  if (!fs.existsSync(summaryPath)) {
    return null;
  }
  try {
    const j = JSON.parse(fs.readFileSync(summaryPath, "utf8")) as { url?: string };
    if (j.url) {
      const u = j.url.trim();
      if (u.startsWith("http://") || u.startsWith("https://")) {
        return u.slice(0, 2000);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function guessMpn(description: string | null): string | null {
  if (!description) {
    return null;
  }
  const model = description.match(/Model Number[:\s]+([^\n]+)/i);
  if (model) {
    return model[1].trim().slice(0, 200);
  }
  return null;
}

/**
 * Upserts one Part per immediate subfolder of `componentsRoot` (repo `Components/`).
 * Folder names with a numeric prefix like `00036 Some title` use `comp-00036` as id and `COMP-00036` as SKU.
 * Folders without a numeric prefix get stable ids from a hash of the folder name.
 */
export async function seedComponentsFromFolder(
  prisma: PrismaClient,
  componentsRoot: string,
): Promise<number> {
  if (!fs.existsSync(componentsRoot)) {
    console.warn(`Components folder not found (${componentsRoot}), skipping folder import.`);
    return 0;
  }

  const dirents = fs.readdirSync(componentsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());

  let nextPartNumber =
    (await prisma.part.aggregate({ _max: { partNumber: true } }))._max.partNumber ?? 0;

  let count = 0;
  for (const dirent of dirents) {
    const folderName = dirent.name;
    const dir = path.join(componentsRoot, folderName);
    const { folderNum, displayName } = parseFolderName(folderName);

    const partId = folderNum ? `comp-${folderNum}` : `comp-${stableHash(folderName)}`;
    const internalSku = folderNum ? `COMP-${folderNum}` : `COMP-${stableHash(folderName).slice(0, 12)}`;

    let description = findDescription(dir);
    if (description && description.length > DESCRIPTION_MAX) {
      description = description.slice(0, DESCRIPTION_MAX) + "\n\n…(truncated)";
    }
    if (!description?.trim()) {
      description = `Imported from local folder \`${folderName.replace(/`/g, "'")}\`. Add notes in the app as needed.`;
    }

    const mpn = guessMpn(description);
    const listingUrl = extractListingUrl(dir);

    const existing = await prisma.part.findUnique({ where: { id: partId } });
    const partNumber = existing?.partNumber ?? ++nextPartNumber;

    const webRoot = process.cwd();
    const imageUrls = copyImagesToPublic(partId, dir, webRoot);
    const primaryImageUrl = imageUrls[0] ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.part.upsert({
        where: { id: partId },
        create: {
          id: partId,
          partNumber,
          name: displayName || folderName,
          internalSku,
          mpn,
          manufacturer: null,
          description,
          quantityOnHand: 1,
          reorderMin: null,
          unit: "pcs",
          categoryId: "seed-components-library",
          defaultLocationId: "seed-components-bin",
          imageUrl: primaryImageUrl,
        },
        update: {
          name: displayName || folderName,
          internalSku,
          mpn,
          description,
          categoryId: "seed-components-library",
          defaultLocationId: "seed-components-bin",
          imageUrl: primaryImageUrl,
        },
      });

      await tx.partImage.deleteMany({ where: { partId } });
      if (imageUrls.length > 0) {
        await tx.partImage.createMany({
          data: imageUrls.map((url, i) => ({
            partId,
            url,
            sortOrder: i,
          })),
        });
      }

      await tx.partPurchaseLink.deleteMany({ where: { partId } });
      if (listingUrl) {
        await tx.partPurchaseLink.create({
          data: {
            partId,
            label: "Listing",
            url: listingUrl,
            sortOrder: 0,
          },
        });
      }
    });

    count += 1;
  }

  return count;
}
