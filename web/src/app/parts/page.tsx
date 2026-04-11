import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parts",
};

export default function PartsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Parts</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        This list will load from the database once Prisma and the Part model
        are wired up. You can track implementation steps in{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">
          IMPLEMENTATION_PLAN.md
        </code>{" "}
        at the repository root.
      </p>
      <div className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        No parts yet — database integration pending (Phase A in the plan).
      </div>
    </main>
  );
}
