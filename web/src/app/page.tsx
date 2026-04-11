import { ArrowRight, Sparkles, Warehouse } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-50">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(251,191,36,0.18),transparent)]"
        aria-hidden
      />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-400/25">
            <Warehouse className="h-5 w-5 text-amber-300" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight">Hobby Warehouse</span>
        </div>
        <Link
          href="/login"
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-lg shadow-amber-500/10 transition hover:bg-zinc-100"
        >
          Sign in
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-8">
        <div className="max-w-3xl space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-amber-200/90">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Invite-only workspace
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl sm:leading-[1.05]">
            Every part,{" "}
            <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-400 bg-clip-text text-transparent">
              one source of truth
            </span>
            .
          </h1>
          <p className="text-lg leading-relaxed text-zinc-400 sm:text-xl">
            Track components across your hobby warehouse with categories, storage
            locations, and role-based visibility — so the right people see the right
            stock.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/25 transition hover:bg-amber-300"
            >
              Open app
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              href="https://github.com/tinel-c/MyComponentDatabase"
              className="inline-flex items-center rounded-2xl border border-white/15 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
              rel="noopener noreferrer"
              target="_blank"
            >
              View on GitHub
            </a>
          </div>
        </div>

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
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 ring-1 ring-white/5"
            >
              <h2 className="text-sm font-semibold text-white">{card.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{card.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-xs text-zinc-500">
        See <code className="rounded bg-white/5 px-1.5 py-0.5">IMPLEMENTATION_PLAN.md</code> in the
        repository for the full roadmap.
      </footer>
    </div>
  );
}
