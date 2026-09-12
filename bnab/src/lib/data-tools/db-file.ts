import {
  copyFileSync,
  createWriteStream,
  existsSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { createDbSnapshot, resolveDatabasePath } from "@/lib/ing-import/snapshot";

export function requireDatabaseFilePath(): string {
  const dbPath = resolveDatabasePath();
  if (!dbPath || !existsSync(dbPath)) {
    throw new Error("DATABASE_URL file database not found");
  }
  return dbPath;
}

function stripSqliteSidecars(dbPath: string) {
  for (const suf of ["-wal", "-shm", "-journal"]) {
    const side = dbPath + suf;
    if (existsSync(side)) {
      try {
        unlinkSync(side);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Snapshot current DB, then replace the shared SQLite file with uploaded bytes.
 * Caller should disconnect Prisma first when possible; a process restart may still
 * be needed if connections hold the old file open.
 */
export async function replaceDatabaseFromUpload(params: {
  bytes: Buffer;
  filename: string;
}): Promise<{ snapshotRelative: string }> {
  const dbPath = requireDatabaseFilePath();
  const snap = createDbSnapshot("pre-db-import");
  const lower = params.filename.toLowerCase();
  const tmp = dbPath + ".upload-tmp";

  if (lower.endsWith(".gz")) {
    const { Readable } = await import("node:stream");
    await pipeline(
      Readable.from(params.bytes),
      createGunzip(),
      createWriteStream(tmp),
    );
  } else if (
    lower.endsWith(".db") ||
    lower.endsWith(".sqlite") ||
    lower.endsWith(".sqlite3")
  ) {
    writeFileSync(tmp, params.bytes);
  } else {
    throw new Error("Upload must be .db, .sqlite, .sqlite3, or .gz");
  }

  stripSqliteSidecars(dbPath);
  copyFileSync(tmp, dbPath);
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  stripSqliteSidecars(dbPath);
  return { snapshotRelative: snap.relativePath };
}
