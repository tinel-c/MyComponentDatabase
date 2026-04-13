import { auth } from "@/auth";
import { exportInventory, getBearerToken, verifySyncSecret } from "@/lib/sync";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const bearer = getBearerToken(request);
  const bearerOk = verifySyncSecret(bearer);
  const session = await auth();
  const sessionOk = session?.user?.role === Role.ADMIN;

  if (!bearerOk && !sessionOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await exportInventory();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return NextResponse.json(payload, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-sync-${stamp}.json"`,
    },
  });
}
