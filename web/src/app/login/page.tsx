import { loginLocalDev, loginWithGoogle } from "@/app/login/actions";
import { auth } from "@/auth";
import { isGoogleOAuthConfigured, isLocalDevAuthEnabled } from "@/lib/oauth-config";
import { ArrowRight, Shield, Warehouse } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  Configuration: {
    title: "Auth configuration error",
    body: "Usually AUTH_SECRET is missing or too short in production, or AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET are empty. Set them in your app .env (on the VPS: /opt/warehouse/shared/.env), then restart the server (e.g. sudo -u deploy pm2 restart warehouse-blue --update-env). Generate AUTH_SECRET with: openssl rand -base64 32",
  },
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
  OAuthAccountNotLinked: {
    title: "Google account could not be linked",
    body: "This is usually fixed by enabling email linking for OAuth (already on in current app versions). Restart the dev server and try again, or ask an admin to verify your user row in the database.",
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
  const localDevAuthEnabled = isLocalDevAuthEnabled();
  const showMissingOauth = !oauthConfigured;
  const authError = params.error
    ? (ERROR_COPY[params.error] ?? {
        title: "Sign-in error",
        body: `Something went wrong (code: ${params.error}). Check web/.env, restart the server, and ensure your Google email exists under Team.`,
      })
    : undefined;

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas text-fg">
      {/* Top glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -20%, var(--glow-top), transparent)",
        }}
        aria-hidden
      />
      {/* Side accent glows */}
      <div
        className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "var(--glow-accent)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full blur-3xl opacity-50"
        style={{ background: "var(--glow-accent)" }}
        aria-hidden
      />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-8">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-fg">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-rim/60"
            style={{ background: "var(--overlay)" }}
          >
            <Warehouse
              className="h-5 w-5"
              style={{ color: "var(--accent)" }}
              aria-hidden
            />
          </span>
          Hobby Warehouse
        </Link>
        <Link
          href="/"
          className="text-sm text-fg-muted transition-colors hover:text-fg"
        >
          Back home
        </Link>
      </header>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto flex max-w-5xl flex-col gap-12 px-6 pb-24 pt-4 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        {/* Left: info */}
        <section className="max-w-xl space-y-6">
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--accent)" }}
          >
            Secure sign-in
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
            Sign in with your{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--fg) 0%, var(--fg-muted) 100%)",
              }}
            >
              Google
            </span>{" "}
            workspace account
          </h1>
          <p className="text-lg leading-relaxed text-fg-muted">
            Access is invite-only: an administrator must create your account first.
            After that, use Google to authenticate — no separate password.
          </p>
          <ul className="space-y-3 text-sm text-fg">
            <li className="flex gap-3">
              <Shield
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: "var(--fg-muted)" }}
                aria-hidden
              />
              <span>
                <strong className="text-fg">Admins</strong>{" "}
                manage categories, locations, team members, and who can see which
                categories.
              </span>
            </li>
            <li className="flex gap-3">
              <ArrowRight
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: "var(--fg-muted)" }}
                aria-hidden
              />
              <span>
                <strong className="text-fg">Members</strong>{" "}
                see only the parts linked to categories assigned to them.
              </span>
            </li>
          </ul>
        </section>

        {/* Right: sign-in card */}
        <section className="w-full max-w-md">
          <div
            className="rounded-3xl border p-8 shadow-2xl backdrop-blur"
            style={{
              borderColor: "var(--rim)",
              background:
                "color-mix(in oklch, var(--surface) 70%, transparent)",
              boxShadow: `0 32px 80px rgba(0,0,0,0.3), inset 0 1px 0 var(--rim-subtle)`,
            }}
          >
            <h2 className="text-lg font-medium text-fg">Continue to the app</h2>
            <p className="mt-2 text-sm text-fg-muted">
              You will be redirected to Google, then back to your inventory.
            </p>

            {authError ? (
              <div
                className="mt-6 rounded-2xl border px-4 py-3 text-sm"
                role="alert"
                style={{
                  borderColor: "var(--danger)/40",
                  background: "var(--danger-muted)",
                  color: "var(--danger-fg)",
                }}
              >
                <p className="font-medium">{authError.title}</p>
                <p className="mt-2 opacity-90">{authError.body}</p>
              </div>
            ) : null}

            {showMissingOauth ? (
              <div
                className="mt-6 rounded-2xl border px-4 py-3 text-sm"
                role="alert"
                style={{
                  borderColor: "var(--rim)",
                  background: "var(--overlay)",
                  color: "var(--fg)",
                }}
              >
                <p className="font-medium">Google OAuth is not configured</p>
                <p className="mt-2 text-fg-muted">
                  Add your Web client ID and secret to{" "}
                  <code
                    className="rounded px-1 py-0.5 text-xs"
                    style={{ background: "var(--canvas)", color: "var(--accent)" }}
                  >
                    web/.env
                  </code>{" "}
                  and restart the dev server. Use either{" "}
                  <code className="text-xs text-accent">AUTH_GOOGLE_ID</code> /{" "}
                  <code className="text-xs text-accent">AUTH_GOOGLE_SECRET</code> or{" "}
                  <code className="text-xs text-accent">GOOGLE_CLIENT_ID</code> /{" "}
                  <code className="text-xs text-accent">GOOGLE_CLIENT_SECRET</code>. In
                  Google Cloud Console, set the authorized redirect URI to{" "}
                  <code className="break-all text-xs text-fg-muted">
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
                className="flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold shadow-lg transition-all duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: "var(--fg)",
                  color: "var(--canvas)",
                }}
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

            {localDevAuthEnabled ? (
              <form action={loginLocalDev} className="mt-3">
                <button
                  type="submit"
                  className="w-full rounded-2xl border border-rim bg-surface px-4 py-3 text-sm font-semibold text-fg transition-all duration-150 hover:bg-overlay"
                >
                  Local dev login (no Google)
                </button>
              </form>
            ) : null}

            <p
              className="mt-6 text-center text-xs"
              style={{ color: "var(--fg-subtle)" }}
            >
              Trouble signing in? Ask your admin to add your Google email to the
              team.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
