import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isGoogleOAuthConfigured, isLocalDevAuthEnabled } from "@/lib/oauth-config";
import { prisma } from "@/lib/prisma";
import { ensureAdminHouseholdBudget } from "@/lib/ensure-budget";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { loginLocalDev, loginWithGoogle } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
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
    // Only bounce to the app when the user can actually open it — otherwise we
    // loop: /plan → no-budget → /login → /plan …
    if (membership) redirect("/plan");
  }

  const params = await searchParams;
  const googleOk = isGoogleOAuthConfigured();
  const localDev = isLocalDevAuthEnabled();

  let errorMsg: string | null = null;
  if (params.error === "no-invite") {
    errorMsg = "This Google account is not invited. Ask an admin to add your email.";
  } else if (params.error === "no-budget") {
    errorMsg = "No budget membership found. Ask an admin to invite you.";
  } else if (params.error) {
    errorMsg = "Sign-in failed. Try again.";
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="text-sm text-fg-muted hover:text-fg">
        ← BNAB
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-fg">Sign in</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Invite-only household access via Google.
      </p>

      {errorMsg ? (
        <div className="mt-6 rounded-xl border border-danger/40 bg-danger-muted px-4 py-3 text-sm text-danger-fg">
          {errorMsg}
        </div>
      ) : null}

      <div className="mt-8 space-y-4">
        {googleOk ? (
          <form action={loginWithGoogle}>
            <button type="submit" className={`${buttonPrimaryClass} w-full`}>
              Continue with Google
            </button>
          </form>
        ) : (
          <p className="text-sm text-fg-muted">
            Google OAuth is not configured. Set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
          </p>
        )}

        {localDev ? (
          <form action={loginLocalDev} className="rounded-2xl border border-rim/60 bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
              Local dev
            </p>
            <label className={`${labelClass} mt-3`}>
              Email
              <input
                name="email"
                type="email"
                defaultValue={process.env.ADMIN_EMAIL ?? ""}
                className={inputClass}
                required
              />
            </label>
            <button type="submit" className={`${buttonSecondaryClass} mt-4 w-full`}>
              Dev sign-in
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
