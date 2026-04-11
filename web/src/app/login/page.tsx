import { loginWithGoogle } from "@/app/login/actions";
import { auth } from "@/auth";
import { isGoogleOAuthConfigured } from "@/lib/oauth-config";
import { ArrowRight, Shield, Warehouse } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  "no-invite": {
    title: "Your email is not registered yet",
    body: "This app is invite-only for non-admin accounts. Ask an administrator to add your Google email under Team. (The address in ADMIN_EMAIL in web/.env can sign in without that — it becomes admin on first login.)",
  },
  AccessDenied: {
    title: "Sign-in was not allowed",
    body: "Usually this means your Google email is not in the team list yet. Ask an admin to create your user, or align ADMIN_EMAIL with your account and re-seed the database.",
  },
  OAuthSignin: {
    title: "Could not start Google sign-in",
    body: "Check that Google OAuth credentials in web/.env are correct and the dev server was restarted.",
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/parts");
  }

  const params = await searchParams;
  const oauthConfigured = isGoogleOAuthConfigured();
  const showMissingOauth = !oauthConfigured;
  const authError = params.error
    ? (ERROR_COPY[params.error] ?? {
        title: "Sign-in error",
        body: `Something went wrong (code: ${params.error}). Check web/.env, restart the server, and ensure your Google email exists under Team.`,
      })
    : undefined;

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-50">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(251,191,36,0.22),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-8">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/30">
            <Warehouse className="h-5 w-5 text-amber-300" aria-hidden />
          </span>
          Hobby Warehouse
        </Link>
        <Link
          href="/"
          className="text-sm text-zinc-400 transition hover:text-white"
        >
          Back home
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex max-w-5xl flex-col gap-12 px-6 pb-24 pt-4 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <section className="max-w-xl space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90">
            Secure sign-in
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Sign in with your{" "}
            <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
              Google
            </span>{" "}
            workspace account
          </h1>
          <p className="text-lg leading-relaxed text-zinc-400">
            Access is invite-only: an administrator must create your account first.
            After that, use Google to authenticate — no separate password.
          </p>
          <ul className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-400/90" aria-hidden />
              <span>
                <strong className="text-white">Admins</strong> manage categories, locations, team
                members, and who can see which categories.
              </span>
            </li>
            <li className="flex gap-3">
              <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-amber-400/90" aria-hidden />
              <span>
                <strong className="text-white">Members</strong> see only the parts linked to
                categories assigned to them.
              </span>
            </li>
          </ul>
        </section>

        <section className="w-full max-w-md">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur">
            <h2 className="text-lg font-medium text-white">Continue to the app</h2>
            <p className="mt-2 text-sm text-zinc-400">
              You will be redirected to Google, then back to your inventory.
            </p>
            {authError ? (
              <div
                className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100"
                role="alert"
              >
                <p className="font-medium text-red-50">{authError.title}</p>
                <p className="mt-2 text-red-100/90">{authError.body}</p>
              </div>
            ) : null}
            {showMissingOauth ? (
              <div
                className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                role="alert"
              >
                <p className="font-medium text-amber-50">Google OAuth is not configured</p>
                <p className="mt-2 text-amber-100/90">
                  Add your Web client ID and secret to{" "}
                  <code className="rounded bg-black/20 px-1 py-0.5 text-xs">web/.env</code> and restart
                  the dev server. Use either{" "}
                  <code className="text-xs">AUTH_GOOGLE_ID</code> /{" "}
                  <code className="text-xs">AUTH_GOOGLE_SECRET</code> or{" "}
                  <code className="text-xs">GOOGLE_CLIENT_ID</code> /{" "}
                  <code className="text-xs">GOOGLE_CLIENT_SECRET</code>. In Google Cloud Console, set
                  the authorized redirect URI to{" "}
                  <code className="break-all text-xs">
                    {(process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}
                    /api/auth/callback/google
                  </code>
                  .
                </p>
              </div>
            ) : null}
            <form action={loginWithGoogle} className="mt-8">
              <button
                type="submit"
                disabled={!oauthConfigured}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg shadow-amber-500/10 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>
            </form>
            <p className="mt-6 text-center text-xs text-zinc-500">
              Trouble signing in? Ask your admin to add your Google email to the team.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
