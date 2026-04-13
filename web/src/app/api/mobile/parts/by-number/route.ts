import {
  findPartForMobileByPartNumber,
  requireApiSession,
} from "@/lib/mobile-api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await requireApiSession();
  if ("response" in authResult) {
    return authResult.response;
  }
  const { session } = authResult;
  const url = new URL(request.url);
  const raw = url.searchParams.get("partNumber");
  if (raw === null || raw.trim() === "") {
    return NextResponse.json({ error: "Missing partNumber." }, { status: 400 });
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return NextResponse.json({ error: "partNumber must be digits only." }, { status: 400 });
  }
  const partNumber = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(partNumber) || partNumber < 1) {
    return NextResponse.json({ error: "Invalid part number." }, { status: 400 });
  }

  const found = await findPartForMobileByPartNumber(
    request,
    partNumber,
    session.user.id,
    session.user.role,
  );
  if ("status" in found && found.status === 404) {
    return NextResponse.json({ error: "Part not found." }, { status: 404 });
  }
  if ("status" in found && found.status === 403) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ part: found.dto });
}
