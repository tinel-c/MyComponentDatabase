import { requireApiSession } from "@/lib/mobile-api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await requireApiSession();
  if ("response" in result) {
    return result.response;
  }
  const { session } = result;
  return NextResponse.json({
    ok: true,
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      role: session.user.role,
      name: session.user.name ?? null,
    },
  });
}
