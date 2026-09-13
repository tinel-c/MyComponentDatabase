import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureAdminHouseholdBudget } from "@/lib/ensure-budget";
import { BNAB_BUDGET_COOKIE } from "@/lib/budget-preference";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") {
    redirect("/plan");
  }
  return session;
}

/**
 * Ensure user has membership; return budget + membership.
 * Honors `bnab_budget_id` cookie when the user is a member of that budget.
 * Cached per-request so layout + page share one DB round-trip.
 */
export const requireBudgetAccess = cache(async () => {
  const session = await requireSession();
  const cookieStore = await cookies();
  const preferredId = cookieStore.get(BNAB_BUDGET_COOKIE)?.value?.trim() || null;

  let membership = preferredId
    ? await prisma.budgetMember.findFirst({
        where: { userId: session.user.id, budgetId: preferredId },
        include: { budget: true },
      })
    : null;

  if (!membership) {
    membership = await prisma.budgetMember.findFirst({
      where: { userId: session.user.id },
      include: { budget: true },
      orderBy: { budget: { createdAt: "asc" } },
    });
  }

  if (!membership) {
    membership = await ensureAdminHouseholdBudget(
      prisma,
      session.user.id,
      session.user.role,
    );
  }
  if (!membership) {
    redirect("/login?error=no-budget");
  }
  return { session, membership, budget: membership.budget };
});
