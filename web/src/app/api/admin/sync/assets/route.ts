import { auth } from "@/auth";
import {
  exportPartAssetsPayload,
  getBearerToken,
  importPartAssetsPayload,
  parseAssetSyncPayload,
  verifySyncSecret,
} from "@/lib/sync";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const bearerOk = verifySyncSecret(getBearerToken(request));
  const session = await auth();
  const sessionOk = session?.user?.role === Role.ADMIN;
  if (!bearerOk && !sessionOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await exportPartAssetsPayload();
  return NextResponse.json(payload);
}

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
    const payload = parseAssetSyncPayload(body);
    const summary = await importPartAssetsPayload(payload);
    return NextResponse.json({ ok: true as const, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
