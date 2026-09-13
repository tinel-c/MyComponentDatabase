import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  buttonCompactClass,
  buttonCompactDangerClass,
  cardCompactClass,
  denseTdClass,
  denseThClass,
  inputCompactClass,
  pageStackClass,
  sectionSubheadingClass,
  tableClass,
} from "@/components/forms/field-classes";
import {
  createImportRuleAction,
  reapplyRulesToBatch,
  revertImportBatch,
} from "../import/actions";

/** Import batch outcomes — docs/import-vocabulary.md */
const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  created_transfer_twin: "Transfer twin",
  linked_manual: "Linked existing",
  linked_receipt_scan: "Linked bill scan",
  skipped_duplicate: "Skipped duplicate",
};

/** IdentifiedAs — docs/import-vocabulary.md */
const CLASS_LABELS: Record<string, string> = {
  new: "New ledger entry",
  linked_existing: "Linked existing payment",
  duplicate: "Already imported",
  rule_category: "Categorized by import rule",
  rule_transfer: "Transfer by import rule",
  rule_hybrid: "Income + transfer twin",
  rule_ignore: "Ignore-rule (RTA excluded)",
  planned_match: "Matched planned payment",
  unmatched: "No rule / no plan",
};

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
          items: { orderBy: { id: "asc" } },
        },
      })
    : null;

  const ruleIds = [
    ...new Set(
      (selected?.items ?? [])
        .map((i) => i.importRuleId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const scheduleIds = [
    ...new Set(
      (selected?.items ?? [])
        .map((i) => i.scheduledTransactionId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [rules, schedules] = await Promise.all([
    ruleIds.length
      ? prisma.importCategoryRule.findMany({
          where: { id: { in: ruleIds }, budgetId: budget.id },
          select: { id: true, matchText: true },
        })
      : Promise.resolve([]),
    scheduleIds.length
      ? prisma.scheduledTransaction.findMany({
          where: { id: { in: scheduleIds }, budgetId: budget.id },
          select: {
            id: true,
            notes: true,
            amount: true,
            payee: { select: { name: true } },
            category: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const ruleById = new Map(rules.map((r) => [r.id, r.matchText]));
  const scheduleLabelById = new Map(
    schedules.map((s) => {
      const label =
        s.payee?.name ??
        s.category?.name ??
        s.notes?.slice(0, 40) ??
        "Planned payment";
      return [s.id, label] as const;
    }),
  );

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
    <div className={pageStackClass}>
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-fg md:text-2xl">
          Import history
        </h1>
        <p className={sectionSubheadingClass}>
          Revert a batch or create rules for leftovers.{" "}
          <Link href="/more/import" className="text-accent hover:underline">
            New import
          </Link>
        </p>
      </div>

      <ul className={`${cardCompactClass} divide-y divide-rim-subtle/60`}>
        {batches.map((b) => {
          const stats = b.statsJson ? JSON.parse(b.statsJson) : {};
          const active = b.id === selectedId;
          return (
            <li key={b.id}>
              <Link
                href={`/more/import-history?batch=${b.id}`}
                className={`block px-3 py-2 hover:bg-overlay/50 ${active ? "bg-accent-muted/40" : ""}`}
              >
                <p className="truncate text-sm font-medium text-fg">
                  {b.sourceLabel}
                </p>
                <p className="text-xs text-fg-muted">
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
          <li className="p-3 text-sm text-fg-muted">No imports yet.</li>
        )}
      </ul>

      {selected && (
        <section className={`${cardCompactClass} space-y-3 p-3`}>
          <h2 className="text-base font-semibold text-fg">{selected.sourceLabel}</h2>
          <div className="flex flex-wrap gap-1.5">
            <form action={revertImportBatch}>
              <input type="hidden" name="batchId" value={selected.id} />
              <button type="submit" className={buttonCompactDangerClass}>
                Revert import
              </button>
            </form>
            <form action={reapplyRulesToBatch}>
              <input type="hidden" name="batchId" value={selected.id} />
              <button type="submit" className={buttonCompactClass}>
                Re-apply rules
              </button>
            </form>
          </div>
          {selected.snapshotPath && (
            <p className="text-xs text-fg-subtle">
              Snapshot: {selected.snapshotPath}. Full DB restore needs{" "}
              <code className="text-accent">ALLOW_DB_RESTORE=1</code>.
            </p>
          )}

          {selected.items.length > 0 && (
            <div className="overflow-x-auto">
              <h3 className="mb-2 text-sm font-semibold text-fg">
                Batch items ({selected.items.length})
              </h3>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={denseThClass}>Memo</th>
                    <th className={denseThClass}>Outcome</th>
                    <th className={denseThClass}>Rule hit</th>
                    <th className={denseThClass}>Planned payment</th>
                    <th className={denseThClass}>Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr key={item.id}>
                      <td
                        className={`${denseTdClass} max-w-[14rem] truncate font-mono text-[11px] text-fg-muted`}
                        title={item.memoPreview ?? undefined}
                      >
                        {item.memoPreview || "—"}
                      </td>
                      <td className={denseTdClass}>
                        {ACTION_LABELS[item.action] ?? item.action}
                      </td>
                      <td className={denseTdClass}>
                        {item.importRuleId
                          ? (ruleById.get(item.importRuleId) ?? "Rule hit")
                          : "—"}
                      </td>
                      <td className={denseTdClass}>
                        {item.scheduledTransactionId
                          ? (scheduleLabelById.get(item.scheduledTransactionId) ??
                            "Planned match")
                          : "—"}
                      </td>
                      <td className={denseTdClass}>
                        {item.classification
                          ? (CLASS_LABELS[item.classification] ??
                            item.classification)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {uncategorized.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-fg">
                Uncategorized in this batch
              </h3>
              {uncategorized.map((txn) => (
                <form
                  key={txn.id}
                  action={createImportRuleAction}
                  className="grid gap-1.5 rounded-lg border border-rim-subtle p-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center"
                >
                  <p className="font-mono text-[11px] text-fg-muted line-clamp-1 sm:col-span-4">
                    {txn.notes}
                  </p>
                  <input
                    name="matchText"
                    className={inputCompactClass}
                    required
                    minLength={3}
                    aria-label="Match"
                    placeholder="Match"
                    defaultValue={
                      (txn.notes ?? "")
                        .match(/(?:Terminal:|Tranzactie la:)\s*([^\s].{2,40})/i)?.[1]
                        ?.trim()
                        .split(/\s{2,}/)[0]
                        ?.slice(0, 40) ?? ""
                    }
                  />
                  <select
                    name="categoryId"
                    className={inputCompactClass}
                    aria-label="Category"
                  >
                    {groups.map((g) =>
                      g.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {g.name}: {c.name}
                        </option>
                      )),
                    )}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-fg">
                    <input type="checkbox" name="ignore" value="1" className="size-4" />
                    Ignore
                  </label>
                  <button type="submit" className={buttonCompactClass}>
                    Save rule
                  </button>
                </form>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
