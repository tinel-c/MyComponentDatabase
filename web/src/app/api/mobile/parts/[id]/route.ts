import { logAudit, serializePart } from "@/lib/audit";
import {
  assertCanEditPart,
  findPartForMobileById,
  requireApiSession,
} from "@/lib/mobile-api";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchBodySchema = z.object({
  quantityOnHand: z.number().int().min(0),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireApiSession();
  if ("response" in authResult) {
    return authResult.response;
  }
  const { session } = authResult;
  const { id } = await context.params;
  const partId = id.trim();
  if (!partId) {
    return NextResponse.json({ error: "Missing part id." }, { status: 400 });
  }

  const found = await findPartForMobileById(request, partId, session.user.id, session.user.role);
  if ("status" in found && found.status === 404) {
    return NextResponse.json({ error: "Part not found." }, { status: 404 });
  }
  if ("status" in found && found.status === 403) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ part: found.dto });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireApiSession();
  if ("response" in authResult) {
    return authResult.response;
  }
  const { session } = authResult;
  const { id } = await context.params;
  const partId = id.trim();
  if (!partId) {
    return NextResponse.json({ error: "Missing part id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  const { quantityOnHand } = parsed.data;

  const existing = await prisma.part.findUnique({ where: { id: partId } });
  if (!existing) {
    return NextResponse.json({ error: "Part not found." }, { status: 404 });
  }

  const allowed = await assertCanEditPart(session.user.id, session.user.role, existing.categoryId);
  if (!allowed) {
    return NextResponse.json({ error: "You cannot edit this part." }, { status: 403 });
  }

  const beforeFull = await prisma.part.findUnique({
    where: { id: partId },
    include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!beforeFull) {
    return NextResponse.json({ error: "Part not found." }, { status: 404 });
  }

  try {
    await prisma.part.update({
      where: { id: partId },
      data: { quantityOnHand },
    });
  } catch {
    return NextResponse.json({ error: "Could not update part." }, { status: 500 });
  }

  const afterFull = await prisma.part.findUnique({
    where: { id: partId },
    include: { purchaseLinks: { orderBy: { sortOrder: "asc" } } },
  });
  if (afterFull) {
    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      model: "Part",
      recordId: partId,
      recordName: afterFull.name,
      before: serializePart(beforeFull),
      after: serializePart(afterFull),
    });
  }

  revalidatePath("/parts");
  revalidatePath(`/parts/${partId}`);
  revalidatePath(`/parts/${partId}/edit`);
  revalidatePath(`/p/${beforeFull.partNumber}`);
  revalidatePath("/admin/audit");

  const found = await findPartForMobileById(request, partId, session.user.id, session.user.role);
  if ("dto" in found) {
    return NextResponse.json({ part: found.dto });
  }
  return NextResponse.json({ error: "Part not found." }, { status: 404 });
}
