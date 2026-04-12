import { ArrowRight, Sparkles, Warehouse } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas text-fg">
      {/* Top glow blob */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, var(--glow-top), transparent)",
        }}
        aria-hidden
      />
      {/* Accent glow */}
      <div
        className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "var(--glow-accent)" }}
        aria-hidden
      />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <div className="flex items-center gap-2">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ring-rim/60"
            style={{ background: "var(--overlay)" }}
          >
            <Warehouse
              className="h-5 w-5"
              style={{ color: "var(--accent)" }}
              aria-hidden
            />
          </span>
          <span className="text-sm font-semibold tracking-tight text-fg">
            Hobby Warehouse
          </span>
        </div>
        <Link
          href="/login"
          className="rounded-full px-4 py-2 text-sm font-semibold text-accent-fg shadow-lg transition-all duration-150 hover:opacity-90"
          style={{ background: "var(--accent)" }}
        >
          Sign in
        </Link>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-8">
        <div className="max-w-3xl space-y-6">
          <p
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-widest"
            style={{
              borderColor: "var(--rim)",
              background:
                "color-mix(in oklch, var(--surface) 60%, transparent)",
              color: "var(--fg-muted)",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} aria-hidden />
            Invite-only workspace
          </p>

          <h1 className="text-4xl font-semibold tracking-tight text-fg sm:text-6xl sm:leading-[1.05]">
            Every part,{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--fg) 0%, var(--fg-muted) 100%)",
              }}
            >
              one source of truth
            </span>
            .
          </h1>

          <p className="text-lg leading-relaxed text-fg-muted sm:text-xl">
            Track components across your hobby warehouse with categories, storage
            locations, and role-based visibility — so the right people see the
            right stock.
          </p>

          <div className="flex flex-wrap gap-4 pt-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-accent-fg shadow-lg transition-all duration-150 hover:opacity-90"
              style={{ background: "var(--accent)" }}
            >
              Open app
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              href="https://github.com/tinel-c/MyComponentDatabase"
              className="inline-flex items-center rounded-2xl border px-6 py-3 text-sm font-medium text-fg transition-all duration-150 hover:bg-surface"
              style={{ borderColor: "var(--rim)" }}
              rel="noopener noreferrer"
              target="_blank"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Google sign-in",
              body: "Secure OAuth with your existing Google account — no extra passwords.",
            },
            {
              title: "Admin & members",
              body: "Admins manage the catalog; members see only categories assigned to them.",
            },
            {
              title: "Local-first data",
              body: "SQLite by default — your inventory stays on your machine, under your control.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border p-6 transition-all duration-150 hover:border-rim"
              style={{
                borderColor: "var(--rim-subtle)",
                background:
                  "color-mix(in oklch, var(--surface) 50%, transparent)",
              }}
            >
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--accent)" }}
              >
                {card.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer
        className="relative z-10 border-t py-8 text-center text-xs"
        style={{ borderTopColor: "var(--rim-subtle)", color: "var(--fg-subtle)" }}
      >
        See{" "}
        <code
          className="rounded px-1.5 py-0.5"
          style={{ background: "var(--overlay)", color: "var(--fg-muted)" }}
        >
          IMPLEMENTATION_PLAN.md
        </code>{" "}
        in the repository for the full roadmap.
      </footer>
    </div>
  );
}
