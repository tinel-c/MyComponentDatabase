import {
  getBearerToken,
  importInventoryMerge,
  parseInventoryPayload,
  SyncImportError,
  verifySyncSecret,
} from "@/lib/sync";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!verifySyncSecret(getBearerToken(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const payload = parseInventoryPayload(body);
    const { summary } = await importInventoryMerge(payload);
    return NextResponse.json({ ok: true as const, summary });
  } catch (e) {
    if (e instanceof SyncImportError) {
      const status = e.code === "CONFLICT" ? 409 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    console.error("sync import", e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
