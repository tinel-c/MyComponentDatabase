"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Upload } from "lucide-react";
import {
  importBillConfirmAction,
  importBillMapAction,
  importBillScanAction,
  type BillImportActionState,
} from "@/app/(app)/more/receipts/actions";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { formatMoney } from "@/lib/money";

const initial: BillImportActionState = { ok: false, phase: "upload" };

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

export function ImportBillClient({ currency }: { currency: string }) {
  const router = useRouter();
  const [scan, scanAction, scanPending] = useActionState(
    importBillScanAction,
    initial,
  );
  const [mapped, mapAction, mapPending] = useActionState(
    importBillMapAction,
    initial,
  );
  const [confirmed, confirmAction, confirmPending] = useActionState(
    importBillConfirmAction,
    initial,
  );

  const state =
    confirmed.phase === "done"
      ? confirmed
      : mapped.ok || mapped.phase === "preview" || mapped.phase === "mapping"
        ? { ...scan, ...mapped }
        : scan;

  useEffect(() => {
    if (confirmed.phase === "done" && confirmed.transactionId) {
      router.refresh();
    }
  }, [confirmed.phase, confirmed.transactionId, router]);

  const pending = scanPending || mapPending || confirmPending;
  const error =
    (!confirmed.ok && confirmed.error) ||
    (!mapped.ok && mapped.error) ||
    (!scan.ok && scan.error) ||
    null;

  return (
    <div className="space-y-4">
      <div className={`${cardClass} space-y-4 p-4`}>
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
            <Receipt className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-fg">Upload a bill</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Gemini reads date and total, then matches an ING transaction. If
              nothing matches, you pick one.
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
            className={`${buttonPrimaryClass} inline-flex w-full items-center justify-center gap-2 sm:w-auto`}
          >
            <Upload className="h-4 w-4" aria-hidden />
            {scanPending ? "Scanning…" : "Import bill"}
          </button>
        </form>
      </div>

      {error ? (
        <p className="rounded-lg bg-danger-muted px-3 py-2 text-sm text-danger-fg">
          {error}
        </p>
      ) : null}

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

      {state.phase === "mapping" && state.scanId ? (
        <div className={`${cardClass} space-y-4 p-4`}>
          <div>
            <h2 className="text-sm font-semibold text-fg">
              Map to a transaction
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              No single date+amount match. Choose the bank line this bill
              belongs to.
            </p>
          </div>
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
              No outflows found. Import the ING CSV first, then try again.
            </p>
          ) : null}
        </div>
      ) : null}

      {(state.phase === "preview" || state.phase === "done") &&
      state.proposedSplits &&
      state.proposedSplits.length > 0 ? (
        <div className={`${cardClass} space-y-3 p-4`}>
          <h2 className="text-sm font-semibold text-fg">
            {state.phase === "done" ? "Applied splits" : "Proposed splits"}
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

          {state.phase === "done" && state.transactionId ? (
            <p className="text-sm text-accent">
              Done.{" "}
              <Link
                href={`/transactions/${state.transactionId}`}
                className="underline hover:text-fg"
              >
                Open transaction
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {state.lines && state.lines.length > 0 ? (
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
    </div>
  );
}
