"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Info, Receipt, Upload } from "lucide-react";
import {
  importBillConfirmAction,
  importBillCreateAction,
  importBillMapAction,
  importBillScanAction,
  type BillImportActionState,
} from "@/app/(app)/more/receipts/actions";
import {
  buttonPrimaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { formatMoney } from "@/lib/money";

const initial: BillImportActionState = { ok: false, phase: "upload" };

function StatusBanner({
  kind,
  title,
  detail,
  transactionId,
  showBillsLink,
}: {
  kind: "success" | "error" | "info";
  title: string;
  detail?: string | null;
  transactionId?: string | null;
  showBillsLink?: boolean;
}) {
  const styles =
    kind === "success"
      ? "border-ok/40 bg-ok/10 text-fg"
      : kind === "error"
        ? "border-danger/40 bg-danger-muted text-danger-fg"
        : "border-rim bg-overlay/60 text-fg";
  const Icon =
    kind === "success" ? CheckCircle2 : kind === "error" ? AlertCircle : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border px-4 py-3 ${styles}`}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={`mt-0.5 size-5 shrink-0 ${
            kind === "success"
              ? "text-ok"
              : kind === "error"
                ? "text-danger"
                : "text-accent"
          }`}
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-snug">{title}</p>
          {detail ? (
            <p
              className={`text-sm leading-snug ${
                kind === "error" ? "text-danger-fg/90" : "text-fg-muted"
              }`}
            >
              {detail}
            </p>
          ) : null}
          {kind === "success" ? (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {transactionId ? (
                <Link
                  href={`/transactions/${transactionId}`}
                  className="font-medium text-accent underline hover:text-fg"
                >
                  Open transaction
                </Link>
              ) : null}
              {showBillsLink ? (
                <Link
                  href="/more/bills"
                  className="font-medium text-accent underline hover:text-fg"
                >
                  View imported bills
                </Link>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TxnPickList({
  title,
  rows,
  currency,
  scanId,
  action,
  pending,
}: {
  title: string;
  rows: NonNullable<BillImportActionState["candidates"]>;
  currency: string;
  scanId: string;
  action: (payload: FormData) => void;
  pending: boolean;
}) {
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        {title}
      </h3>
      <ul className="divide-y divide-rim-subtle rounded-lg border border-rim-subtle">
        {rows.map((row) => (
          <li key={row.id}>
            <form action={action}>
              <input type="hidden" name="scanId" value={scanId} />
              <input type="hidden" name="transactionId" value={row.id} />
              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left hover:bg-overlay/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">
                    {row.payee || "—"}
                    {row.alreadySplit ? " · already split" : ""}
                  </p>
                  <p className="truncate text-xs text-fg-muted">
                    {row.date} · {row.accountName}
                    {row.notes ? ` · ${row.notes.slice(0, 40)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-sm text-fg">
                  {formatMoney(row.amount, currency)}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ImportBillClient({
  currency,
  accounts,
}: {
  currency: string;
  accounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [scan, scanAction, scanPending] = useActionState(
    importBillScanAction,
    initial,
  );
  const [mapped, mapAction, mapPending] = useActionState(
    importBillMapAction,
    initial,
  );
  const [created, createAction, createPending] = useActionState(
    importBillCreateAction,
    initial,
  );
  const [confirmed, confirmAction, confirmPending] = useActionState(
    importBillConfirmAction,
    initial,
  );

  const scanTouched = Boolean(scan.ok || scan.error || scan.scanId);
  const finished =
    confirmed.phase === "done" &&
    (!scanTouched || confirmed.scanId === scan.scanId)
      ? confirmed
      : created.phase === "done" &&
          (!scanTouched || created.scanId === scan.scanId)
        ? created
        : null;

  // Prefer the most recently failed action that belongs to the current scan
  const failure = (() => {
    const candidates = [confirmed, created, mapped, scan].filter(
      (s) => s.error && !s.ok,
    );
    if (candidates.length === 0) return null;
    if (!scan.scanId) return candidates[0];
    return (
      candidates.find((s) => !s.scanId || s.scanId === scan.scanId) ??
      candidates[0]
    );
  })();

  const state =
    finished ??
    (mapped.ok || mapped.phase === "preview" || mapped.phase === "mapping"
      ? { ...scan, ...mapped }
      : scan);

  useEffect(() => {
    if (finished?.transactionId) {
      router.refresh();
    }
  }, [finished?.transactionId, router]);

  const pending =
    scanPending || mapPending || confirmPending || createPending;
  const defaultAccountId = accounts[0]?.id ?? "";

  const statusBanner = (() => {
    if (pending) return null;
    if (finished?.ok) {
      return (
        <StatusBanner
          kind="success"
          title={
            finished.createdAsNew
              ? "Bill import succeeded"
              : "Bill detailing succeeded"
          }
          detail={
            finished.message ??
            (finished.createdAsNew
              ? "Entry created from the bill."
              : "Splits applied to the bank transaction.")
          }
          transactionId={finished.transactionId}
          showBillsLink
        />
      );
    }
    if (failure) {
      return (
        <StatusBanner
          kind="error"
          title="Bill import failed"
          detail={failure.message ?? failure.error ?? "Something went wrong"}
        />
      );
    }
    if (state.ok && state.message && state.phase !== "upload") {
      return (
        <StatusBanner
          kind="info"
          title={
            state.phase === "preview"
              ? "Ready to confirm"
              : state.phase === "mapping"
                ? "Action needed"
                : "Bill scanned"
          }
          detail={state.message}
        />
      );
    }
    return null;
  })();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 lg:mx-0 lg:max-w-none lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      <div className={`${cardClass} space-y-4 p-4 sm:p-5 lg:sticky lg:top-6`}>
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
            <Receipt className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-fg">Upload a bill</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Gemini reads merchant, date, total, and lines. Match an existing
              ING row, or create a new entry now and link it when you import the
              statement.
            </p>
          </div>
        </div>

        <form action={scanAction} className="space-y-3">
          <label className={labelClass}>
            Bill photo
            <input
              type="file"
              name="bill"
              accept="image/jpeg,image/png,image/webp"
              required
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className={`${buttonPrimaryClass} inline-flex w-full items-center justify-center gap-2`}
          >
            <Upload className="h-4 w-4" aria-hidden />
            {scanPending ? "Scanning…" : "Import bill"}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {statusBanner}

        {state.ok && (state.receiptTotalCents || state.receiptDate) ? (
          <div className={`${cardClass} space-y-1 p-4 text-sm`}>
            <p className="font-medium text-fg">
              {state.merchant || "Receipt"}
              {state.receiptDate ? ` · ${state.receiptDate}` : ""}
            </p>
            {state.receiptTotalCents != null ? (
              <p className="tabular-nums text-fg-muted">
                Total {formatMoney(state.receiptTotalCents, currency)}
              </p>
            ) : null}
          </div>
        ) : null}

        {!finished && state.phase === "mapping" && state.scanId ? (
          <div className={`${cardClass} space-y-4 p-4`}>
            <div>
              <h2 className="text-sm font-semibold text-fg">
                Map or create entry
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                Link an existing bank outflow, or create a categorized entry now
                — ING import will offer to link it later.
              </p>
            </div>

            <form
              action={createAction}
              className="space-y-3 rounded-xl border border-accent/30 bg-accent-muted/20 p-3"
            >
              <input type="hidden" name="scanId" value={state.scanId} />
              <input
                type="hidden"
                name="merchant"
                value={state.merchant ?? ""}
              />
              <input
                type="hidden"
                name="receiptTotalCents"
                value={state.receiptTotalCents ?? ""}
              />
              <p className="text-sm font-medium text-fg">Create new entry</p>
              <label className={labelClass}>
                Account
                <select
                  name="accountId"
                  className={inputClass}
                  required
                  defaultValue={defaultAccountId}
                >
                  {accounts.length === 0 ? (
                    <option value="">No on-budget accounts</option>
                  ) : (
                    accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className={labelClass}>
                Date
                <input
                  name="date"
                  type="date"
                  className={inputClass}
                  defaultValue={state.receiptDate ?? ""}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={pending || accounts.length === 0}
                className={`${buttonPrimaryClass} w-full`}
              >
                {createPending
                  ? "Creating…"
                  : "Create entry & apply categories"}
              </button>
              <p className="text-xs text-fg-subtle">
                Saves merchant, date, total, and category splits. Left uncleared
                until an ING CSV import links the statement line.
              </p>
            </form>

            <TxnPickList
              title="Amount matches (±3 days)"
              rows={state.candidates ?? []}
              currency={currency}
              scanId={state.scanId}
              action={mapAction}
              pending={pending}
            />
            <TxnPickList
              title="Recent outflows"
              rows={state.nearby ?? []}
              currency={currency}
              scanId={state.scanId}
              action={mapAction}
              pending={pending}
            />
            {(state.candidates?.length ?? 0) === 0 &&
            (state.nearby?.length ?? 0) === 0 ? (
              <p className="text-sm text-fg-muted">
                No bank outflows to map yet — create a new entry above, then
                import the ING CSV when it arrives.
              </p>
            ) : null}
          </div>
        ) : null}

        {(state.phase === "preview" || state.phase === "done") &&
        state.proposedSplits &&
        state.proposedSplits.length > 0 ? (
          <div className={`${cardClass} space-y-3 p-4`}>
            <h2 className="text-sm font-semibold text-fg">
              {state.phase === "done" ? "Applied categories" : "Proposed splits"}
            </h2>
            <ul className="divide-y divide-rim-subtle rounded-lg border border-rim-subtle">
              {state.proposedSplits.map((s) => (
                <li
                  key={s.categoryId}
                  className="flex justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-fg">{s.categoryName}</div>
                    {s.notes ? (
                      <div className="truncate text-fg-muted">{s.notes}</div>
                    ) : null}
                  </div>
                  <div className="shrink-0 tabular-nums">
                    {formatMoney(-Math.abs(s.amountCents), currency)}
                  </div>
                </li>
              ))}
            </ul>

            {state.phase === "preview" && state.scanId && state.transactionId ? (
              <form action={confirmAction}>
                <input type="hidden" name="scanId" value={state.scanId} />
                <input
                  type="hidden"
                  name="transactionId"
                  value={state.transactionId}
                />
                <button
                  type="submit"
                  disabled={pending}
                  className={`${buttonPrimaryClass} w-full sm:w-auto`}
                >
                  {confirmPending ? "Applying…" : "Confirm & apply splits"}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        {state.lines && state.lines.length > 0 && !finished ? (
          <details className={`${cardClass} p-4 text-sm`}>
            <summary className="cursor-pointer text-fg-muted hover:text-fg">
              {state.lines.length} scanned lines
            </summary>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-fg-muted">
              {state.lines.map((l, i) => (
                <li
                  key={`${l.description}-${i}`}
                  className="flex justify-between gap-2"
                >
                  <span className="truncate">
                    {l.ignored ? "(ignore) " : ""}
                    {l.description}
                    {l.categoryName ? ` · ${l.categoryName}` : ""}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {(l.amountCents / 100).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {!statusBanner && !pending && state.phase === "upload" && !state.ok ? (
          <div className={`${cardClass} border-dashed p-6 text-center sm:p-8`}>
            <p className="text-sm text-fg-muted">
              Results appear here after you scan a bill.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
