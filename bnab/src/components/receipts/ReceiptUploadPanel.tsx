"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import {
  confirmReceiptDetail,
  previewReceiptDetail,
  type ReceiptDetailActionState,
} from "@/app/(app)/more/receipts/actions";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { formatMoney } from "@/lib/money";

const initial: ReceiptDetailActionState = { ok: false };

export function ReceiptUploadPanel({
  transactionId,
  currency,
  disabled,
}: {
  transactionId: string;
  currency: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [preview, previewAction, previewPending] = useActionState(
    previewReceiptDetail,
    initial,
  );
  const [confirm, confirmAction, confirmPending] = useActionState(
    confirmReceiptDetail,
    initial,
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (confirm.ok) router.refresh();
  }, [confirm.ok, router]);

  if (disabled) {
    return (
      <div className={`${cardClass} p-4 text-sm text-fg-muted`}>
        Receipt detailing is not available for transfers.
      </div>
    );
  }

  const splits = confirm.ok
    ? confirm.proposedSplits
    : preview.ok
      ? preview.proposedSplits
      : undefined;
  const lines = preview.ok ? preview.lines : undefined;
  const scanId = preview.scanId;
  const error =
    localError ||
    (!preview.ok && preview.error) ||
    (!confirm.ok && confirm.error) ||
    null;
  const applied = confirm.ok && Boolean(confirm.proposedSplits?.length);

  return (
    <div className={`${cardClass} space-y-4 p-4`}>
      <div>
        <h2 className="text-sm font-semibold text-fg">Detail from bill</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Upload a Lidl (or other) receipt photo. Gemini reads the lines; rules
          map them to categories and split this bank entry.
        </p>
      </div>

      <form
        action={previewAction}
        className="space-y-3"
        onSubmit={() => setLocalError(null)}
      >
        <input type="hidden" name="transactionId" value={transactionId} />
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
          disabled={previewPending}
          className={`${buttonSecondaryClass} inline-flex w-full items-center justify-center gap-2 sm:w-auto`}
        >
          <Upload className="h-4 w-4" aria-hidden />
          {previewPending ? "Scanning…" : "Scan with Gemini"}
        </button>
      </form>

      {error ? (
        <p className="rounded-lg bg-danger-muted px-3 py-2 text-sm text-danger-fg">
          {error}
        </p>
      ) : null}

      {applied ? (
        <p className="rounded-lg bg-accent-muted px-3 py-2 text-sm text-accent">
          Splits applied. Plan and Reflect now use the detailed categories.
        </p>
      ) : null}

      {splits && splits.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Proposed splits
          </h3>
          <ul className="divide-y divide-rim-subtle rounded-lg border border-rim-subtle">
            {splits.map((s) => (
              <li
                key={s.categoryId}
                className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium text-fg">{s.categoryName}</div>
                  {s.notes ? (
                    <div className="truncate text-fg-muted">{s.notes}</div>
                  ) : null}
                </div>
                <div className="shrink-0 tabular-nums text-fg">
                  {formatMoney(-Math.abs(s.amountCents), currency)}
                </div>
              </li>
            ))}
          </ul>

          {!applied && scanId ? (
            <form action={confirmAction}>
              <input type="hidden" name="transactionId" value={transactionId} />
              <input type="hidden" name="scanId" value={scanId} />
              <button
                type="submit"
                disabled={confirmPending}
                className={`${buttonPrimaryClass} w-full sm:w-auto`}
              >
                {confirmPending ? "Applying…" : "Confirm & apply splits"}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {lines && lines.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-fg-muted hover:text-fg">
            {lines.length} scanned lines
          </summary>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-fg-muted">
            {lines.map((l, i) => (
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
