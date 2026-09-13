"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import {
  importBillFinishScanAction,
  importBillScanAction,
  type BillImportActionState,
} from "@/app/(app)/more/receipts/actions";
import {
  buttonCompactClass,
  buttonCompactDangerClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
} from "@/components/forms/field-classes";
import { usePendingActionsOptional } from "@/components/providers/PendingActionsProvider";

const MAX_FILES = 20;
const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPT = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export type BillQueueStatus =
  | "queued"
  | "scanning"
  | "done"
  | "failed"
  | "canceled";

export type BillQueueItem = {
  id: string;
  file: File;
  name: string;
  sizeLabel: string;
  status: BillQueueStatus;
  error?: string;
  scanId?: string;
};

const scanInitial: BillImportActionState = { ok: false, phase: "upload" };

function sizeLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1
    ? `${mb.toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function statusChip(status: BillQueueStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "queued":
      return { label: "Queued", className: "bg-overlay text-fg-muted" };
    case "scanning":
      return { label: "Scanning", className: "bg-accent-muted text-accent" };
    case "done":
      return { label: "Done", className: "bg-ok/15 text-ok" };
    case "failed":
      return { label: "Failed", className: "bg-danger-muted text-danger-fg" };
    case "canceled":
      return { label: "Canceled", className: "bg-overlay text-fg-subtle" };
  }
}

export function validateBillFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: { name: string; reason: string }[];
} {
  const list = Array.from(files);
  const accepted: File[] = [];
  const rejected: { name: string; reason: string }[] = [];
  for (const file of list) {
    const mime = (file.type || "").toLowerCase();
    if (!ACCEPT.has(mime) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      rejected.push({ name: file.name, reason: "Not JPEG, PNG, or WebP" });
      continue;
    }
    if (file.size > MAX_BYTES) {
      rejected.push({ name: file.name, reason: "Over 12 MB" });
      continue;
    }
    if (file.size === 0) {
      rejected.push({ name: file.name, reason: "Empty file" });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function filesToQueueItems(files: File[]): BillQueueItem[] {
  return files.map((file) => ({
    id: `bq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    file,
    name: file.name,
    sizeLabel: sizeLabel(file.size),
    status: "queued" as const,
  }));
}

export function BillImportQueue({
  items,
  onChange,
}: {
  items: BillQueueItem[];
  onChange: (next: BillQueueItem[]) => void;
}) {
  const pendingCtx = usePendingActionsOptional();
  const [cancelRemaining, setCancelRemaining] = useState(false);
  const [running, setRunning] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const cancelRef = useRef(false);
  cancelRef.current = cancelRemaining;
  const runningRef = useRef(false);

  const counts = {
    total: items.length,
    queued: items.filter((i) => i.status === "queued").length,
    scanning: items.filter((i) => i.status === "scanning").length,
    done: items.filter((i) => i.status === "done").length,
    failed: items.filter((i) => i.status === "failed").length,
    canceled: items.filter((i) => i.status === "canceled").length,
  };
  const scanned = counts.done + counts.failed + counts.canceled;
  const summaryText = `${scanned} of ${counts.total} scanned · ${counts.done} done · ${counts.failed} failed · ${counts.queued} queued`;

  const commit = useCallback(
    (next: BillQueueItem[]) => {
      itemsRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const runQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    try {
      // Concurrency 1 — mutate a local copy so awaits don't race React state
      let local = [...itemsRef.current];
      for (;;) {
        if (cancelRef.current) {
          local = local.map((row) =>
            row.status === "queued"
              ? { ...row, status: "canceled" as const }
              : row,
          );
          commit(local);
          setCancelRemaining(false);
          break;
        }
        const idx = local.findIndex((row) => row.status === "queued");
        if (idx < 0) break;

        const item = local[idx];
        local = local.map((row, i) =>
          i === idx
            ? { ...row, status: "scanning" as const, error: undefined }
            : row,
        );
        commit(local);

        const pendingId = pendingCtx?.trackPending(`Scanning ${item.name}`);
        try {
          const fd = new FormData();
          fd.set("bill", item.file);
          const scannedResult = await importBillScanAction(scanInitial, fd);
          if (!scannedResult.ok || !scannedResult.scanId) {
            local = local.map((row) =>
              row.id === item.id
                ? {
                    ...row,
                    status: "failed" as const,
                    error:
                      scannedResult.message ??
                      scannedResult.error ??
                      "Scan failed",
                  }
                : row,
            );
            commit(local);
            continue;
          }
          const finishFd = new FormData();
          finishFd.set("scanId", scannedResult.scanId);
          const finished = await importBillFinishScanAction(
            scanInitial,
            finishFd,
          );
          if (!finished.ok) {
            local = local.map((row) =>
              row.id === item.id
                ? {
                    ...row,
                    status: "failed" as const,
                    scanId: scannedResult.scanId,
                    error:
                      finished.message ??
                      finished.error ??
                      "Could not save scan",
                  }
                : row,
            );
            commit(local);
            continue;
          }
          local = local.map((row) =>
            row.id === item.id
              ? {
                  ...row,
                  status: "done" as const,
                  scanId: scannedResult.scanId,
                  error: undefined,
                }
              : row,
          );
          commit(local);
        } catch (err) {
          local = local.map((row) =>
            row.id === item.id
              ? {
                  ...row,
                  status: "failed" as const,
                  error: err instanceof Error ? err.message : "Scan failed",
                }
              : row,
          );
          commit(local);
        } finally {
          if (pendingId) pendingCtx?.clearPending(pendingId);
        }

        // Merge any items added while we were scanning
        const byId = new Map(local.map((r) => [r.id, r]));
        for (const row of itemsRef.current) {
          if (!byId.has(row.id)) {
            byId.set(row.id, row);
            local = [...local, row];
          }
        }
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [commit, pendingCtx]);

  useEffect(() => {
    if (
      !runningRef.current &&
      items.some((i) => i.status === "queued") &&
      !cancelRemaining
    ) {
      void runQueue();
    }
  }, [items, cancelRemaining, runQueue]);

  const retryFailed = () => {
    setCancelRemaining(false);
    commit(
      itemsRef.current.map((row) =>
        row.status === "failed"
          ? { ...row, status: "queued" as const, error: undefined }
          : row,
      ),
    );
  };

  const removeItem = (id: string) => {
    const row = itemsRef.current.find((i) => i.id === id);
    if (!row || row.status === "scanning") return;
    commit(itemsRef.current.filter((i) => i.id !== id));
  };

  const clearFinished = () => {
    commit(
      itemsRef.current.filter(
        (i) =>
          i.status !== "done" &&
          i.status !== "canceled" &&
          i.status !== "failed",
      ),
    );
  };

  if (items.length === 0) return null;

  return (
    <div className={`${cardClass} space-y-3 p-3 sm:p-4`}>
      <div
        className="sticky top-0 z-10 -mx-3 -mt-3 space-y-2 border-b border-rim-subtle bg-surface/95 px-3 py-3 backdrop-blur-sm sm:-mx-4 sm:-mt-4 sm:px-4"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-fg">Bill queue</h2>
          <p className="text-xs text-fg-muted tabular-nums">{summaryText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonCompactDangerClass}
            disabled={!running && counts.queued === 0}
            onClick={() => setCancelRemaining(true)}
          >
            <Square className="size-3" aria-hidden />
            Cancel remaining
          </button>
          <button
            type="button"
            className={buttonCompactClass}
            disabled={running || counts.failed === 0}
            onClick={retryFailed}
          >
            <RotateCcw className="size-3" aria-hidden />
            Retry failed
          </button>
          {(counts.done > 0 || counts.canceled > 0 || counts.failed > 0) &&
          counts.queued === 0 &&
          !running ? (
            <button
              type="button"
              className={buttonCompactClass}
              onClick={clearFinished}
            >
              Clear finished
            </button>
          ) : null}
        </div>
      </div>

      <ul className="max-h-72 space-y-1.5 overflow-y-auto">
        {items.map((item) => {
          const chip = statusChip(item.status);
          return (
            <li
              key={item.id}
              className="flex items-start gap-2 rounded-lg border border-rim-subtle px-2.5 py-2"
            >
              <span className="mt-0.5 shrink-0">
                {item.status === "scanning" ? (
                  <Loader2
                    className="size-4 animate-spin text-accent"
                    aria-hidden
                  />
                ) : item.status === "done" ? (
                  <CheckCircle2 className="size-4 text-ok" aria-hidden />
                ) : item.status === "failed" ? (
                  <AlertCircle className="size-4 text-danger" aria-hidden />
                ) : (
                  <span className="block size-4 rounded-full border border-rim" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-fg">
                    {item.name}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${chip.className}`}
                  >
                    {chip.label}
                  </span>
                  <span className="text-[10px] text-fg-subtle">
                    {item.sizeLabel}
                  </span>
                </div>
                {item.error ? (
                  <p className="mt-0.5 text-xs text-danger-fg">{item.error}</p>
                ) : null}
              </div>
              {item.status !== "scanning" ? (
                <button
                  type="button"
                  className="shrink-0 rounded-md p-1 text-fg-subtle hover:bg-overlay hover:text-fg"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => removeItem(item.id)}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {counts.done > 0 && counts.queued === 0 && !running ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-rim-subtle pt-3">
          <p className="text-sm text-fg-muted">
            {counts.done} bill scan{counts.done === 1 ? "" : "s"} saved for
            Reflect.
          </p>
          <Link href="/more/bills" className={`${buttonPrimaryClass} text-sm`}>
            View imported bills
          </Link>
          {counts.failed > 0 ? (
            <button
              type="button"
              className={buttonSecondaryClass}
              onClick={retryFailed}
            >
              Retry failed
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { MAX_FILES };
