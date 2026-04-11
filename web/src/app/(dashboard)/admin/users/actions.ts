"use server";

import { auth } from "@/auth";
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
  await requireAdmin();
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
    await prisma.user.create({
      data: {
        email: data.email,
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return { error: "A user with this email already exists." };
    }
    return { error: "Could not create user." };
  }
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUserRecord(
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  await requireAdmin();
  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);
  const parsed = updateUserSchema.safeParse({
    id: formData.get("id"),
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    categoryIds,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  const { id, categoryIds, ...rest } = parsed.data;
  if (rest.role === Role.USER && categoryIds.length === 0) {
    return { error: "Members need at least one visible category." };
  }

  const session = await auth();
  if (session?.user?.id === id && rest.role !== Role.ADMIN) {
    return { error: "You cannot remove your own admin role here." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          email: rest.email,
          name: rest.name || null,
          role: rest.role,
        },
      });
      await tx.userCategoryAccess.deleteMany({ where: { userId: id } });
      if (rest.role === Role.USER && categoryIds.length > 0) {
        await tx.userCategoryAccess.createMany({
          data: categoryIds.map((categoryId) => ({ userId: id, categoryId })),
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
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}/edit`);
  redirect("/admin/users");
}

export async function deleteUserRecord(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const session = await auth();
  if (session?.user?.id === id) {
    redirect("/admin/users");
  }

  await prisma.user.delete({ where: { id } }).catch(() => undefined);
  revalidatePath("/admin/users");
  redirect("/admin/users");
}
