import { auth } from "@/auth";
import { partVisibilityWhere, userCanEditPart } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";

/** Session shape after NextAuth callbacks (id + role on user). */
export type AppSession = Session & {
  user: Session["user"] & { id: string; role: Role };
};

export type MobilePartImageDto = {
  id: string;
  url: string;
  sortOrder: number;
  caption: string | null;
};

export type MobilePartDto = {
  id: string;
  partNumber: number;
  name: string;
  quantityOnHand: number;
  unit: string;
  imageUrl: string | null;
  images: MobilePartImageDto[];
};

/** Public URL path or absolute URL → absolute URL for mobile clients. */
export function toAbsoluteAssetUrl(request: Request, pathOrUrl: string | null): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = getRequestBaseUrl(request);
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base.replace(/\/$/, "")}${path}`;
}

export function getRequestBaseUrl(request: Request): string {
  const env = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  if (host) {
    const proto = forwardedProto ?? url.protocol.replace(":", "");
    return `${proto}://${host}`;
  }
  if (env) {
    return env.replace(/\/$/, "");
  }
  return `${url.protocol}//${url.host}`;
}

export async function requireApiSession(): Promise<
  { session: AppSession } | { response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session: session as AppSession };
}

function partToDto(
  request: Request,
  row: {
    id: string;
    partNumber: number;
    name: string;
    quantityOnHand: number;
    unit: string;
    imageUrl: string | null;
    images: { id: string; url: string; sortOrder: number; caption: string | null }[];
  },
): MobilePartDto {
  return {
    id: row.id,
    partNumber: row.partNumber,
    name: row.name,
    quantityOnHand: row.quantityOnHand,
    unit: row.unit,
    imageUrl: toAbsoluteAssetUrl(request, row.imageUrl),
    images: row.images.map((img) => ({
      id: img.id,
      url: toAbsoluteAssetUrl(request, img.url) ?? img.url,
      sortOrder: img.sortOrder,
      caption: img.caption,
    })),
  };
}

const partInclude = {
  images: { orderBy: { sortOrder: "asc" as const } },
} as const;

export async function findPartForMobileById(
  request: Request,
  partId: string,
  userId: string,
  role: Role,
): Promise<{ dto: MobilePartDto } | { status: 404 } | { status: 403 }> {
  const vis = await partVisibilityWhere(userId, role);
  const part = await prisma.part.findFirst({
    where: vis ? { AND: [{ id: partId }, vis] } : { id: partId },
    include: partInclude,
  });
  if (!part) {
    const exists = await prisma.part.findUnique({ where: { id: partId }, select: { id: true } });
    if (exists) return { status: 403 };
    return { status: 404 };
  }
  return { dto: partToDto(request, part) };
}

export async function findPartForMobileByPartNumber(
  request: Request,
  partNumber: number,
  userId: string,
  role: Role,
): Promise<{ dto: MobilePartDto } | { status: 404 } | { status: 403 }> {
  const vis = await partVisibilityWhere(userId, role);
  const part = await prisma.part.findFirst({
    where: vis ? { AND: [{ partNumber }, vis] } : { partNumber },
    include: partInclude,
  });
  if (!part) {
    const exists = await prisma.part.findUnique({
      where: { partNumber },
      select: { id: true },
    });
    if (exists) return { status: 403 };
    return { status: 404 };
  }
  return { dto: partToDto(request, part) };
}

export async function assertCanEditPart(
  userId: string,
  role: Role,
  categoryId: string | null,
): Promise<boolean> {
  return userCanEditPart(userId, role, categoryId);
}
