import { auth } from "@/auth";
import { createReadStream, existsSync } from "node:fs";
import { Readable } from "node:stream";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createDbSnapshot, resolveDatabasePath } from "@/lib/ing-import/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const dbPath = resolveDatabasePath();
  if (!dbPath || !existsSync(dbPath)) {
    return new Response("Database file not found", { status: 404 });
  }

  try {
    createDbSnapshot("admin-export");
  } catch {
    /* still allow download of live file */
  }

  const url = new URL(request.url);
  const gzip = url.searchParams.get("gzip") === "1";
  const iso = new Date().toISOString().replace(/[:.]/g, "-");

  if (!gzip) {
    const stream = createReadStream(dbPath);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="bnab-${iso}.db"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const { PassThrough } = await import("node:stream");
  const pass = new PassThrough();
  void pipeline(createReadStream(dbPath), createGzip(), pass).catch(() => {
    pass.destroy();
  });

  return new Response(Readable.toWeb(pass) as ReadableStream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="bnab-${iso}.db.gz"`,
      "Cache-Control": "no-store",
    },
  });
}
