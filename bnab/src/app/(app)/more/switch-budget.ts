"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  BNAB_BUDGET_COOKIE,
  BNAB_BUDGET_COOKIE_MAX_AGE,
} from "@/lib/budget-preference";

export async function switchBudgetAction(formData: FormData) {
  const session = await requireSession();
  const budgetId = String(formData.get("budgetId") ?? "").trim();
  if (!budgetId) {
    redirect("/more");
  }

  const membership = await prisma.budgetMember.findFirst({
    where: { userId: session.user.id, budgetId },
    select: { id: true },
  });
  if (!membership) {
    redirect("/more?error=budget");
  }

  const cookieStore = await cookies();
  cookieStore.set(BNAB_BUDGET_COOKIE, budgetId, {
    path: "/",
    maxAge: BNAB_BUDGET_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });

  revalidatePath("/", "layout");
  redirect("/plan");
}
