import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-16 sm:px-6">
        <section className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-widest text-amber-700 dark:text-amber-400">
            Parts & components
          </p>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Know what you own, where it lives, and when to reorder.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            A warehouse-style inventory for hobbyists: categories, storage
            locations, stock levels, projects, and BOMs — without spreadsheet
            chaos.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
              Planned capabilities
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <li>Parts master data and multi-location stock</li>
              <li>Movements, audit trail, low-stock alerts</li>
              <li>Suppliers, BOMs, barcodes — see the implementation plan</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
              Next step
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Backend persistence (Prisma + database) and a real parts list
              will connect here. Until then, use the Parts page as a UI
              placeholder.
            </p>
            <Link
              href="/parts"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Open Parts
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        See repository root <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">IMPLEMENTATION_PLAN.md</code> for
        the full roadmap.
      </footer>
    </div>
  );
}
