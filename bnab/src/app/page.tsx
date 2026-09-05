import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { buttonPrimaryClass } from "@/components/forms/field-classes";
import { prisma } from "@/lib/prisma";
import { ensureAdminHouseholdBudget } from "@/lib/ensure-budget";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.id) {
    let membership = await prisma.budgetMember.findFirst({
      where: { userId: session.user.id },
    });
    if (!membership) {
      membership = await ensureAdminHouseholdBudget(
        prisma,
        session.user.id,
        session.user.role,
      );
    }
    if (membership) redirect("/plan");
  }
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, var(--glow-top), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, var(--glow-accent), transparent)",
        }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-fg-muted">
          bogza.ro
        </p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight text-fg sm:text-6xl">
          BNAB
        </h1>
        <p className="mt-2 text-lg text-fg-muted">Bogza Needs A Budget</p>
        <p className="mt-6 max-w-md text-base leading-relaxed text-fg-muted">
          Zero-based envelope budgeting for two. Give every leu a job — plan,
          spend, and reflect together from your phone.
        </p>
        <div className="mt-10">
          <Link href="/login" className={buttonPrimaryClass}>
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
