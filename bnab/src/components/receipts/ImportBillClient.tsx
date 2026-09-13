"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  Info,
  Receipt,
  ScanLine,
  Upload,
} from "lucide-react";
import {
  importBillConfirmAction,
  importBillCreateAction,
  importBillFinishScanAction,
  importBillMapAction,
  importBillScanAction,
  type BillImportActionState,
} from "@/app/(app)/more/receipts/actions";
import {
  BillImportQueue,
  filesToQueueItems,
  MAX_FILES,
  validateBillFiles,
  type BillQueueItem,
} from "@/components/receipts/BillImportQueue";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    sizeLabel: string;
  } | null>(null);
  const [queue, setQueue] = useState<BillQueueItem[]>([]);
  const [pickErrors, setPickErrors] = useState<string[]>([]);
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
  const [finishedScan, finishScanAction, finishPending] = useActionState(
    importBillFinishScanAction,
    initial,
  );
  const [confirmed, confirmAction, confirmPending] = useActionState(
    importBillConfirmAction,
    initial,
  );
  const [createPendingLedger, setCreatePendingLedger] = useState(false);

  const batchMode = queue.length > 0;

  const scanTouched = Boolean(scan.ok || scan.error || scan.scanId);
  const finished =
    confirmed.phase === "done" &&
    (!scanTouched || confirmed.scanId === scan.scanId)
      ? confirmed
      : created.phase === "done" &&
          (!scanTouched || created.scanId === scan.scanId)
        ? created
        : finishedScan.phase === "done" &&
            (!scanTouched || finishedScan.scanId === scan.scanId)
          ? finishedScan
          : null;

  // Prefer the most recently failed action that belongs to the current scan
  const failure = (() => {
    const candidates = [confirmed, created, finishedScan, mapped, scan].filter(
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
    if (finished?.ok) {
      router.refresh();
    }
  }, [finished?.ok, finished?.transactionId, router]);

  const pending =
    scanPending ||
    mapPending ||
    confirmPending ||
    createPending ||
    finishPending;
  const defaultAccountId = accounts[0]?.id ?? "";

  const ingestFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      setSelectedFile(null);
      setPickErrors([]);
      return;
    }
    const { accepted, rejected } = validateBillFiles(fileList);
    const errors = rejected.map((r) => `${r.name}: ${r.reason}`);

    if (accepted.length === 0) {
      setSelectedFile(null);
      setPickErrors(errors.length ? errors : ["No valid bill photos"]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Single file → keep existing mapping flow (form submit)
    if (accepted.length === 1 && queue.length === 0) {
      const file = accepted[0];
      const mb = file.size / (1024 * 1024);
      setSelectedFile({
        name: file.name,
        sizeLabel:
          mb >= 0.1
            ? `${mb.toFixed(1)} MB`
            : `${Math.max(1, Math.round(file.size / 1024))} KB`,
      });
      setPickErrors(errors);
      return;
    }

    // Multi-file (or add to existing queue) → scan-only batch
    setSelectedFile(null);
    const room = MAX_FILES - queue.length;
    if (room <= 0) {
      setPickErrors([...errors, `Queue full (max ${MAX_FILES} files).`]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const slice = accepted.slice(0, room);
    const nextErrors =
      accepted.length > room
        ? [
            ...errors,
            `Only ${room} more file${room === 1 ? "" : "s"} fit (max ${MAX_FILES}).`,
          ]
        : errors;
    setPickErrors(nextErrors);
    setQueue((prev) => [...prev, ...filesToQueueItems(slice)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const statusBanner = (() => {
    if (batchMode || pending) return null;
    if (finished?.ok) {
      return (
        <StatusBanner
          kind="success"
          title={
            finished.createdAsNew
              ? "Bill import succeeded"
              : finished.transactionId
                ? "Bill detailing succeeded"
                : "Bill saved for Reflect"
          }
          detail={
            finished.message ??
            (finished.createdAsNew
              ? "Entry created from the bill."
              : finished.transactionId
                ? "Splits applied to the bank transaction."
                : "Scan kept without a ledger entry.")
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
      <div className={`${cardClass} space-y-3 p-3 sm:p-4 lg:sticky lg:top-6`}>
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
            <Receipt className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-fg">Upload a bill</h2>
            <p className="mt-1 text-sm text-fg-muted">
              One photo opens mapping. Multiple photos scan for Reflect only
              (up to {MAX_FILES}). JPEG, PNG, or WebP · max 12 MB each.
            </p>
          </div>
        </div>

        {batchMode ? (
          <div className="space-y-3">
            <label
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors border-rim bg-accent-muted/20 hover:border-accent hover:bg-accent-muted/35 ${
                pending ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent-muted text-accent">
                <ScanLine className="size-6" aria-hidden />
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-semibold text-fg">
                  Add more bill photos
                </span>
                <span className="block text-xs text-fg-muted">
                  Queue has {queue.length} / {MAX_FILES}
                </span>
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={pending || queue.length >= MAX_FILES}
                className="sr-only"
                onChange={(e) => ingestFiles(e.target.files)}
              />
            </label>
            {pickErrors.length > 0 ? (
              <ul className="space-y-1 text-xs text-danger-fg">
                {pickErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <form action={scanAction} className="space-y-3">
            <label
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-10 text-center transition-colors ${
                selectedFile
                  ? "border-accent bg-accent-muted/40 hover:bg-accent-muted/50"
                  : "border-rim bg-accent-muted/20 hover:border-accent hover:bg-accent-muted/35"
              } ${scanPending ? "animate-pulse" : ""}`}
            >
              <span
                className={`inline-flex size-14 items-center justify-center rounded-2xl ${
                  selectedFile
                    ? "bg-accent text-accent-fg"
                    : "bg-accent-muted text-accent"
                }`}
              >
                {selectedFile ? (
                  <FileImage className="size-7" aria-hidden />
                ) : (
                  <ScanLine className="size-7" aria-hidden />
                )}
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-semibold text-fg">
                  {scanPending
                    ? "Scanning bill…"
                    : selectedFile
                      ? "Photo selected — tap to change"
                      : "Drop or choose bill photo(s)"}
                </span>
                {selectedFile ? (
                  <span className="mx-auto flex max-w-full items-center justify-center gap-1.5 text-xs text-fg">
                    <CheckCircle2
                      className="size-3.5 shrink-0 text-ok"
                      aria-hidden
                    />
                    <span className="min-w-0 truncate font-medium">
                      {selectedFile.name}
                    </span>
                    <span className="shrink-0 text-fg-muted">
                      · {selectedFile.sizeLabel}
                    </span>
                  </span>
                ) : (
                  <span className="block text-xs text-fg-muted">
                    JPEG, PNG, or WebP · max 12 MB · up to {MAX_FILES} files
                  </span>
                )}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                name="bill"
                accept="image/jpeg,image/png,image/webp"
                multiple
                required={!selectedFile}
                disabled={pending}
                className="sr-only"
                onChange={(e) => ingestFiles(e.target.files)}
              />
            </label>
            {pickErrors.length > 0 ? (
              <ul className="space-y-1 text-xs text-danger-fg">
                {pickErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : null}
            <button
              type="submit"
              disabled={pending || !selectedFile}
              className={`${buttonPrimaryClass} inline-flex w-full items-center justify-center gap-2`}
            >
              <Upload className="h-4 w-4" aria-hidden />
              {scanPending
                ? "Scanning…"
                : selectedFile
                  ? "Import bill"
                  : "Choose a photo first"}
            </button>
          </form>
        )}
      </div>

      <div className="space-y-4">
        {batchMode ? (
          <BillImportQueue items={queue} onChange={setQueue} />
        ) : null}

        {statusBanner}

        {!batchMode &&
        state.ok &&
        (state.receiptTotalCents || state.receiptDate) ? (
          <div className={`${cardClass} space-y-1 p-3 text-sm`}>
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

        {!batchMode && !finished && state.phase === "mapping" && state.scanId ? (
          <div className={`${cardClass} space-y-3 p-3`}>
            <div>
              <h2 className="text-sm font-semibold text-fg">Bill scanned</h2>
              <p className="mt-1 text-sm text-fg-muted">
                Categories are ready for Reflect. Map an existing outflow,
                finish without a ledger entry, or optionally create a pending
                entry to link on ING import later.
              </p>
            </div>

            {state.lines && state.lines.length > 0 ? (
              <ul className="max-h-48 divide-y divide-rim-subtle overflow-y-auto rounded-lg border border-rim-subtle text-sm">
                {state.lines
                  .filter((l) => !l.ignored)
                  .map((l, i) => (
                    <li
                      key={`${l.description}-${i}`}
                      className="flex justify-between gap-2 px-3 py-1.5"
                    >
                      <span className="min-w-0 truncate text-fg">
                        {l.description}
                        <span className="text-fg-subtle">
                          {" "}
                          · {l.categoryName ?? "—"}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-fg-muted">
                        {formatMoney(l.amountCents, currency)}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : null}

            <form action={finishScanAction}>
              <input type="hidden" name="scanId" value={state.scanId} />
              <button
                type="submit"
                disabled={pending}
                className={`${buttonPrimaryClass} w-full`}
              >
                {finishPending ? "Saving…" : "Done — keep for Reflect"}
              </button>
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

            <label className="flex cursor-pointer items-start gap-2 text-sm text-fg">
              <input
                type="checkbox"
                className="mt-1"
                checked={createPendingLedger}
                onChange={(e) => setCreatePendingLedger(e.target.checked)}
              />
              <span>
                Also create as pending ledger entry
                <span className="mt-0.5 block text-xs text-fg-muted">
                  Writes a categorized transaction now; ING import can link it
                  later. Off by default — Reflect does not need this.
                </span>
              </span>
            </label>

            {createPendingLedger ? (
              <form
                action={createAction}
                className="space-y-3 rounded-xl border border-rim bg-overlay/40 p-3"
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
                <p className="text-sm font-medium text-fg">
                  Create pending entry
                </p>
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
                  className={`${buttonSecondaryClass} w-full`}
                >
                  {createPending
                    ? "Creating…"
                    : "Create pending entry & apply categories"}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        {!batchMode &&
        (state.phase === "preview" || state.phase === "done") &&
        state.proposedSplits &&
        state.proposedSplits.length > 0 ? (
          <div className={`${cardClass} space-y-2 p-3`}>
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

        {!batchMode && state.lines && state.lines.length > 0 && !finished ? (
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

        {!batchMode &&
        !statusBanner &&
        !pending &&
        state.phase === "upload" &&
        !state.ok ? (
          <div className={`${cardClass} border-dashed p-4 text-center sm:p-6`}>
            <p className="text-sm text-fg-muted">
              Results appear here after you scan a bill.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
