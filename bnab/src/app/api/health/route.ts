import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function readBuildId(): Promise<string | null> {
  try {
    const p = path.join(process.cwd(), ".next", "BUILD_ID");
    const id = (await readFile(p, "utf8")).trim();
    return id || null;
  } catch {
    return null;
  }
}

export async function GET() {
  const buildId = await readBuildId();
  return NextResponse.json(
    {
      ok: true,
      slot: process.env.BNAB_SLOT ?? null,
      buildId,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
