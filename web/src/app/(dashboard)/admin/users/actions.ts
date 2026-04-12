"use server";

import { auth } from "@/auth";
import { logAudit, serializeUserForAudit } from "@/lib/audit";
import { normalizeEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().trim().email("Valid email required"),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  role: z.nativeEnum(Role),
  categoryIds: z.array(z.string().cuid()),
});

const updateUserSchema = createUserSchema.extend({
  id: z.string().cuid(),
});

export type UserAdminState = { error?: string };

export async function createUserRecord(
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  const session = await requireAdmin();
  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    categoryIds,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  const data = parsed.data;
  if (data.role === Role.USER && data.categoryIds.length === 0) {
    return { error: "Members need at least one visible category." };
  }
  try {
    const created = await prisma.user.create({
      data: {
        email: normalizeEmail(data.email),
        name: data.name || null,
        role: data.role,
        categoryAccess:
          data.role === Role.USER
            ? {
                create: data.categoryIds.map((categoryId) => ({ categoryId })),
              }
            : undefined,
      },
    });
    const full = await prisma.user.findUnique({
      where: { id: created.id },
      include: { categoryAccess: true },
    });
    if (full) {
      await logAudit({
        userId: session.user.id,
        action: "CREATE",
        model: "User",
        recordId: full.id,
        recordName: full.email ?? full.name ?? full.id,
        after: serializeUserForAudit(full),
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return { error: "A user with this email already exists." };
    }
    return { error: "Could not create user." };
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  redirect("/admin/users");
}

export async function updateUserRecord(
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  const adminSession = await requireAdmin();
  const submittedCategoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);
  const parsed = updateUserSchema.safeParse({
    id: formData.get("id"),
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    categoryIds: submittedCategoryIds,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  const { id, categoryIds: nextCategoryIds, ...rest } = parsed.data;
  if (rest.role === Role.USER && nextCategoryIds.length === 0) {
    return { error: "Members need at least one visible category." };
  }

  const authSession = await auth();
  if (authSession?.user?.id === id && rest.role !== Role.ADMIN) {
    return { error: "You cannot remove your own admin role here." };
  }

  const before = await prisma.user.findUnique({
    where: { id },
    include: { categoryAccess: true },
  });
  if (!before) {
    return { error: "User not found." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          email: normalizeEmail(rest.email),
          name: rest.name || null,
          role: rest.role,
        },
      });
      await tx.userCategoryAccess.deleteMany({ where: { userId: id } });
      if (rest.role === Role.USER && nextCategoryIds.length > 0) {
        await tx.userCategoryAccess.createMany({
          data: nextCategoryIds.map((categoryId) => ({ userId: id, categoryId })),
        });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return { error: "Email already in use." };
    }
    return { error: "Could not update user." };
  }
  const after = await prisma.user.findUnique({
    where: { id },
    include: { categoryAccess: true },
  });
  if (after) {
    await logAudit({
      userId: adminSession.user.id,
      action: "UPDATE",
      model: "User",
      recordId: id,
      recordName: after.email ?? after.name ?? id,
      before: serializeUserForAudit(before),
      after: serializeUserForAudit(after),
    });
  }
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}/edit`);
  revalidatePath("/admin/audit");
  redirect("/admin/users");
}

export async function deleteUserRecord(formData: FormData) {
  const adminSession = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const session = await auth();
  if (session?.user?.id === id) {
    redirect("/admin/users");
  }

  const before = await prisma.user.findUnique({
    where: { id },
    include: { categoryAccess: true },
  });
  if (before) {
    await logAudit({
      userId: adminSession.user.id,
      action: "DELETE",
      model: "User",
      recordId: before.id,
      recordName: before.email ?? before.name ?? before.id,
      before: serializeUserForAudit(before),
    });
  }

  await prisma.user.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  redirect("/admin/users");
}
