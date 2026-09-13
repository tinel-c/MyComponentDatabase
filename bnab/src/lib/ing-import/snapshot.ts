import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const RETAIN = 20;

/** Directory for SQLite snapshots (dev + prod). */
export function snapshotsDir(): string {
  if (process.env.BNAB_SNAPSHOT_DIR) {
    return process.env.BNAB_SNAPSHOT_DIR;
  }
  // Production shared volume
  if (existsSync("/opt/bnab/shared")) {
    return "/opt/bnab/shared/snapshots";
  }
  return path.join(process.cwd(), "data", "snapshots");
}

export function resolveDatabasePath(): string | null {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) return null;

  let p = url.slice("file:".length);
  // Strip optional leading // (file:///C:/... or file://localhost/...)
  if (p.startsWith("//")) {
    p = p.replace(/^\/\/\/?/, "");
    // Windows: file:///C:/path → C:/path; file://localhost/C:/ → still odd — keep simple
    if (/^[A-Za-z]:/.test(p) || p.startsWith("/")) {
      // absolute-ish
    } else {
      p = path.resolve(process.cwd(), p);
    }
  } else if (p.startsWith("./") || p.startsWith(".\\") || !path.isAbsolute(p)) {
    p = path.resolve(process.cwd(), p);
  }

  if (existsSync(p)) return p;

  // Prisma resolves relative SQLite paths against the schema directory (`prisma/`),
  // so `file:./dev.db` often means `prisma/dev.db`, not `<cwd>/dev.db`.
  const schemaRelative = path.resolve(process.cwd(), "prisma", path.basename(p));
  if (existsSync(schemaRelative)) return schemaRelative;

  const prismaDev = path.resolve(process.cwd(), "prisma", "dev.db");
  if (existsSync(prismaDev)) return prismaDev;

  return existsSync(p) ? p : null;
}

export function createDbSnapshot(batchId: string): {
  relativePath: string;
  absolutePath: string;
} {
  const dbPath = resolveDatabasePath();
  if (!dbPath || !existsSync(dbPath)) {
    throw new Error("Cannot snapshot: DATABASE_URL file not found");
  }
  const dir = snapshotsDir();
  mkdirSync(dir, { recursive: true });
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `bnab-${iso}-${batchId}.db`;
  const absolutePath = path.join(dir, fileName);
  copyFileSync(dbPath, absolutePath);
  // Also copy wal/shm if present
  for (const suf of ["-wal", "-shm", "-journal"]) {
    const side = dbPath + suf;
    if (existsSync(side)) {
      copyFileSync(side, absolutePath + suf);
    }
  }
  pruneOldSnapshots(dir);
  return { relativePath: fileName, absolutePath };
}

function pruneOldSnapshots(dir: string) {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("bnab-") && f.endsWith(".db"))
    .map((f) => ({ f, t: path.join(dir, f) }))
    .sort((a, b) => b.f.localeCompare(a.f));
  for (const extra of files.slice(RETAIN)) {
    try {
      unlinkSync(extra.t);
      for (const suf of ["-wal", "-shm", "-journal"]) {
        const side = extra.t + suf;
        if (existsSync(side)) unlinkSync(side);
      }
    } catch {
      /* ignore */
    }
  }
}

export function absoluteSnapshotPath(relativeOrAbsolute: string): string {
  if (path.isAbsolute(relativeOrAbsolute)) return relativeOrAbsolute;
  return path.join(snapshotsDir(), relativeOrAbsolute);
}
