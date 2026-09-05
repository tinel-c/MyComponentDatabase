import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

/** Ensure user has membership; return budget + membership. Creates default budget for admin if none. */
export async function requireBudgetAccess() {
  const session = await requireSession();
  const membership = await prisma.budgetMember.findFirst({
    where: { userId: session.user.id },
    include: { budget: true },
    orderBy: { budget: { createdAt: "asc" } },
  });
  if (!membership) {
    redirect("/login?error=no-budget");
  }
  return { session, membership, budget: membership.budget };
}
