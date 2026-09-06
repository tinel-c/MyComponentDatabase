import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { cardClass, buttonSecondaryClass, buttonPrimaryClass } from "@/components/forms/field-classes";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link2, Link2Off, AlertCircle, Clock, CheckCircle2, Receipt } from "lucide-react";

function parseReceiptMeta(rawJson: string | null): {
  merchant: string | null;
  date: string | null;
  totalCents: number | null;
} {
  if (!rawJson) return { merchant: null, date: null, totalCents: null };
  try {
    const obj = JSON.parse(rawJson) as Record<string, unknown>;
    const merchant =
      typeof obj.merchant === "string" ? obj.merchant.trim() || null : null;
    const date =
      typeof obj.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.date)
        ? obj.date
        : null;
    const totalCents =
      typeof obj.total === "number" && obj.total > 0
        ? Math.round(obj.total * 100)
        : null;
    return { merchant, date, totalCents };
  } catch {
    return { merchant: null, date: null, totalCents: null };
  }
}

function statusMeta(status: string): {
  label: string;
  className: string;
  Icon: typeof CheckCircle2;
} {
  switch (status) {
    case "ok":
      return {
        label: "Applied",
        className: "bg-ok/15 text-ok",
        Icon: CheckCircle2,
      };
    case "preview":
      return {
        label: "Preview",
        className: "bg-accent-muted text-accent",
        Icon: Clock,
      };
    case "needs_mapping":
      return {
        label: "Needs mapping",
        className: "bg-overlay text-fg-muted",
        Icon: Clock,
      };
    case "error":
      return {
        label: "Failed",
        className: "bg-danger-muted text-danger-fg",
        Icon: AlertCircle,
      };
    default:
      return {
        label: status || "Pending",
        className: "bg-overlay text-fg-muted",
        Icon: Clock,
      };
  }
}

export default async function BillsPage() {
  const { budget } = await requireBudgetAccess();

  const scans = await prisma.receiptScan.findMany({
    where: { budgetId: budget.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      lines: { select: { id: true, amountCents: true } },
      transaction: {
        include: {
          payee: { select: { name: true } },
          account: { select: { name: true } },
          importBatch: { select: { id: true, sourceLabel: true, createdAt: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/more" className="text-sm text-fg-muted hover:text-fg md:hidden">
            ← More
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
            Imported bills
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Bill scans and how they link to ING / register transactions.{" "}
            <Link href="/more/import-bill" className="text-accent hover:underline">
              Import another bill
            </Link>
          </p>
        </div>
        <Link
          href="/more/import-bill"
          className={`${buttonSecondaryClass} w-full shrink-0 sm:w-auto`}
        >
          Import bill
        </Link>
      </div>

      {scans.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={Receipt}
            title="No bills imported yet"
            description="Scan a receipt to categorize spend before the ING statement arrives."
            action={
              <Link href="/more/import-bill" className={buttonPrimaryClass}>
                Scan a receipt
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {scans.map((scan) => {
            const meta = parseReceiptMeta(scan.rawJson);
            const lineSum = scan.lines.reduce((s, l) => s + l.amountCents, 0);
            const totalCents =
              meta.totalCents ?? (lineSum > 0 ? lineSum : null);
            const st = statusMeta(scan.status);
            const StatusIcon = st.Icon;
            const txn = scan.transaction;
            const pendingIng =
              Boolean(txn) &&
              !txn!.importFingerprint &&
              (txn!.notes?.includes("Bill import") ?? false);
            const linkedIng = Boolean(txn?.importFingerprint);

            return (
              <li key={scan.id} className={`${cardClass} overflow-hidden`}>
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}
                      >
                        <StatusIcon className="size-3.5" aria-hidden />
                        {st.label}
                      </span>
                      <span className="text-xs text-fg-subtle">
                        {scan.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                    <p className="text-base font-semibold text-fg">
                      {meta.merchant || txn?.payee?.name || "Receipt"}
                      {meta.date || txn?.date
                        ? ` · ${meta.date ?? txn?.date}`
                        : ""}
                    </p>
                    <p className="text-sm text-fg-muted">
                      {totalCents != null
                        ? formatMoney(-Math.abs(totalCents), budget.currency)
                        : "—"}
                      {scan.lines.length > 0
                        ? ` · ${scan.lines.length} line${scan.lines.length === 1 ? "" : "s"}`
                        : ""}
                      {scan.model ? ` · ${scan.model}` : ""}
                    </p>
                    {scan.errorText ? (
                      <p className="text-sm text-danger-fg">{scan.errorText}</p>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-rim-subtle bg-overlay/30 px-4 py-3">
                  {!txn ? (
                    <div className="flex items-start gap-2 text-sm text-fg-muted">
                      <Link2Off className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                      <div>
                        <p className="font-medium text-fg">No transaction linked</p>
                        <p className="text-fg-muted">
                          Finish mapping on{" "}
                          <Link
                            href="/more/import-bill"
                            className="text-accent hover:underline"
                          >
                            Import bill
                          </Link>{" "}
                          or create a new entry from the scan.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        {linkedIng ? (
                          <Link2 className="mt-0.5 size-4 shrink-0 text-ok" />
                        ) : pendingIng ? (
                          <Clock className="mt-0.5 size-4 shrink-0 text-accent" />
                        ) : (
                          <Link2 className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-fg">
                            {linkedIng
                              ? "Linked to ING statement"
                              : pendingIng
                                ? "Awaiting ING statement link"
                                : "Linked to register entry"}
                          </p>
                          <p className="mt-0.5 text-fg-muted">
                            {txn.date} · {txn.account.name}
                            {txn.payee?.name ? ` · ${txn.payee.name}` : ""} ·{" "}
                            {formatMoney(txn.amount, budget.currency)}
                            {txn.isParent ? " · split" : ""}
                            {txn.cleared ? " · cleared" : " · uncleared"}
                          </p>
                          {linkedIng && txn.importBatch ? (
                            <p className="mt-1 text-xs text-fg-subtle">
                              ING batch: {txn.importBatch.sourceLabel} ·{" "}
                              <Link
                                href={`/more/import-history?batch=${txn.importBatch.id}`}
                                className="text-accent hover:underline"
                              >
                                View import history
                              </Link>
                            </p>
                          ) : null}
                          {pendingIng ? (
                            <p className="mt-1 text-xs text-fg-subtle">
                              When you import the ING CSV, choose{" "}
                              <span className="font-medium text-fg">Link</span> on
                              the matching row.
                            </p>
                          ) : null}
                          <Link
                            href={`/transactions/${txn.id}`}
                            className="mt-2 inline-block text-accent underline hover:text-fg"
                          >
                            Open transaction
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
