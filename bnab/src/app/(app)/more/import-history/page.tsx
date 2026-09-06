import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  buttonDangerClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import {
  createImportRuleAction,
  reapplyRulesToBatch,
  revertImportBatch,
} from "../import/actions";

export default async function ImportHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const batches = await prisma.importBatch.findMany({
    where: { budgetId: budget.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const accounts = await prisma.financeAccount.findMany({
    where: { budgetId: budget.id },
    select: { id: true, name: true },
  });
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const selectedId = sp.batch ?? batches[0]?.id;
  const selected = selectedId
    ? await prisma.importBatch.findFirst({
        where: { id: selectedId, budgetId: budget.id },
        include: {
          items: { orderBy: { id: "asc" }, take: 500 },
        },
      })
    : null;

  const uncategorized =
    selected
      ? await prisma.transaction.findMany({
          where: {
            importBatchId: selected.id,
            categoryId: null,
          },
          orderBy: { date: "desc" },
          take: 80,
        })
      : [];

  const groups = await prisma.categoryGroup.findMany({
    where: { budgetId: budget.id, hidden: false },
    include: {
      categories: { where: { hidden: false }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-fg">Import history</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Revert a batch (deletes created transactions) or create rules for leftovers.{" "}
          <Link href="/more/import" className="text-accent hover:underline">
            New import
          </Link>
        </p>
      </div>

      <ul className={`${cardClass} divide-y divide-rim-subtle/60`}>
        {batches.map((b) => {
          const stats = b.statsJson ? JSON.parse(b.statsJson) : {};
          const active = b.id === selectedId;
          return (
            <li key={b.id}>
              <Link
                href={`/more/import-history?batch=${b.id}`}
                className={`block px-4 py-3 hover:bg-overlay/50 ${active ? "bg-accent-muted/40" : ""}`}
              >
                <p className="font-medium text-fg">{b.sourceLabel}</p>
                <p className="text-sm text-fg-muted">
                  {b.createdAt.toISOString().slice(0, 19).replace("T", " ")} ·{" "}
                  {accountName.get(b.accountId) ?? "account"} · created{" "}
                  {stats.created ?? "?"}
                  {stats.reverted ? " · reverted" : ""}
                  {b.snapshotPath ? " · snapshot" : ""}
                </p>
              </Link>
            </li>
          );
        })}
        {batches.length === 0 && (
          <li className="p-4 text-sm text-fg-muted">No imports yet.</li>
        )}
      </ul>

      {selected && (
        <section className={`${cardClass} space-y-4 p-4`}>
          <h2 className="text-lg font-semibold text-fg">{selected.sourceLabel}</h2>
          <div className="flex flex-wrap gap-2">
            <form action={revertImportBatch}>
              <input type="hidden" name="batchId" value={selected.id} />
              <button type="submit" className={buttonDangerClass}>
                Revert this import
              </button>
            </form>
            <form action={reapplyRulesToBatch}>
              <input type="hidden" name="batchId" value={selected.id} />
              <button type="submit" className={buttonSecondaryClass}>
                Re-apply rules to uncategorized
              </button>
            </form>
          </div>
          {selected.snapshotPath && (
            <p className="text-xs text-fg-subtle">
              Snapshot file: {selected.snapshotPath}. Full DB restore requires{" "}
              <code className="text-accent">ALLOW_DB_RESTORE=1</code> on the server
              (ops script).
            </p>
          )}

          {uncategorized.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-fg">
                Uncategorized in this batch
              </h3>
              {uncategorized.map((txn) => (
                <form
                  key={txn.id}
                  action={createImportRuleAction}
                  className="grid gap-2 rounded-lg border border-rim-subtle p-3 sm:grid-cols-4"
                >
                  <p className="sm:col-span-4 font-mono text-xs text-fg-muted line-clamp-2">
                    {txn.notes}
                  </p>
                  <label className={labelClass}>
                    Match
                    <input
                      name="matchText"
                      className={inputClass}
                      required
                      minLength={3}
                      defaultValue={
                        (txn.notes ?? "")
                          .match(/(?:Terminal:|Tranzactie la:)\s*([^\s].{2,40})/i)?.[1]
                          ?.trim()
                          .split(/\s{2,}/)[0]
                          ?.slice(0, 40) ?? ""
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    Category
                    <select name="categoryId" className={inputClass}>
                      {groups.map((g) =>
                        g.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {g.name}: {c.name}
                          </option>
                        )),
                      )}
                    </select>
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm text-fg">
                    <input type="checkbox" name="ignore" value="1" />
                    Ignore
                  </label>
                  <div className="flex items-end">
                    <button type="submit" className={buttonSecondaryClass}>
                      Save rule
                    </button>
                  </div>
                </form>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
