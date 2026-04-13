import { promises as fs } from "node:fs";
import path from "node:path";

const PART_ASSETS_ROOT = path.join(process.cwd(), "public", "part-assets");

export type AssetFilePayload = {
  path: string;
  contentBase64: string;
};

export type AssetSyncPayload = {
  version: 1;
  exportedAt: string;
  files: AssetFilePayload[];
};

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walkFiles(full);
      if (entry.isFile()) return [full];
      return [];
    }),
  );
  return nested.flat();
}

function toPosixRelative(filePath: string, root: string): string {
  const rel = path.relative(root, filePath);
  return rel.split(path.sep).join("/");
}

function assertSafeRelativePath(relPath: string): void {
  if (
    !relPath ||
    relPath.startsWith("/") ||
    relPath.includes("..") ||
    relPath.split("/").some((segment) => segment.trim() === "")
  ) {
    throw new Error(`Unsafe asset path: "${relPath}"`);
  }
}

export async function exportPartAssetsPayload(): Promise<AssetSyncPayload> {
  try {
    await fs.access(PART_ASSETS_ROOT);
  } catch {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      files: [],
    };
  }

  const files = await walkFiles(PART_ASSETS_ROOT);
  const payloadFiles = await Promise.all(
    files.map(async (absPath) => {
      const rel = toPosixRelative(absPath, PART_ASSETS_ROOT);
      assertSafeRelativePath(rel);
      const buf = await fs.readFile(absPath);
      return {
        path: rel,
        contentBase64: buf.toString("base64"),
      };
    }),
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    files: payloadFiles,
  };
}

export function parseAssetSyncPayload(body: unknown): AssetSyncPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid assets payload");
  }
  const payload = body as Partial<AssetSyncPayload>;
  if (payload.version !== 1 || !Array.isArray(payload.files)) {
    throw new Error("Invalid assets payload version/files");
  }
  for (const file of payload.files) {
    if (!file || typeof file !== "object") {
      throw new Error("Invalid asset file entry");
    }
    if (typeof file.path !== "string" || typeof file.contentBase64 !== "string") {
      throw new Error("Invalid asset file entry shape");
    }
    assertSafeRelativePath(file.path);
  }
  return {
    version: 1,
    exportedAt:
      typeof payload.exportedAt === "string" && payload.exportedAt
        ? payload.exportedAt
        : new Date().toISOString(),
    files: payload.files as AssetFilePayload[],
  };
}

export async function importPartAssetsPayload(payload: AssetSyncPayload): Promise<{ files: number }> {
  await fs.rm(PART_ASSETS_ROOT, { recursive: true, force: true });
  await fs.mkdir(PART_ASSETS_ROOT, { recursive: true });

  for (const file of payload.files) {
    const outPath = path.join(PART_ASSETS_ROOT, ...file.path.split("/"));
    const outDir = path.dirname(outPath);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(outPath, Buffer.from(file.contentBase64, "base64"));
  }

  return { files: payload.files.length };
}
