import { auth } from "@/auth";
import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== Role.ADMIN) {
    redirect("/parts");
  }
  return session;
}

/** Expand assigned category ids to include all descendants (parts in subcategories visible). */
export async function expandVisibleCategoryIds(assignedIds: string[]): Promise<string[]> {
  if (assignedIds.length === 0) return [];
  const all = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });
  const visible = new Set(assignedIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of all) {
      if (c.parentId && visible.has(c.parentId) && !visible.has(c.id)) {
        visible.add(c.id);
        changed = true;
      }
    }
  }
  return [...visible];
}

export async function getVisibleCategoryIdsForUser(userId: string): Promise<string[]> {
  const rows = await prisma.userCategoryAccess.findMany({
    where: { userId },
    select: { categoryId: true },
  });
  const assigned = rows.map((r) => r.categoryId);
  return expandVisibleCategoryIds(assigned);
}

/** Where clause for Part queries: admins see all; users only see parts in visible categories. */
export async function partVisibilityWhere(
  userId: string,
  role: Role,
): Promise<Prisma.PartWhereInput | undefined> {
  if (role === Role.ADMIN) return undefined;
  const ids = await getVisibleCategoryIdsForUser(userId);
  if (ids.length === 0) {
    return { id: { in: [] } };
  }
  return { categoryId: { in: ids } };
}

export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN;
}
