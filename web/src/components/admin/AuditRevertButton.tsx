"use client";

import {
  revertAuditEntry,
  undoCreateAuditEntry,
} from "@/app/(dashboard)/admin/audit/actions";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Rows use light `bg-white` / `--card-well`; use solid accent + accent-fg so text never disappears on white. */
const btnActive =
  "inline-flex items-center justify-center rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-fg shadow-sm " +
  "transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";

const btnMuted =
  "inline-flex items-center justify-center rounded-lg border border-rim bg-overlay px-2.5 py-1.5 text-xs font-medium text-fg shadow-sm " +
  "ring-1 ring-rim/40";

/**
 * Every audit row gets a control: revert update, undo create, or disabled with reason.
 */
export function AuditLogRevertControl({
  auditId,
  action,
  reverted,
  hasBefore,
}: {
  auditId: string;
  action: string;
  reverted: boolean;
  hasBefore: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (reverted) {
    return (
      <button type="button" disabled className={`${btnMuted} cursor-not-allowed opacity-70`}>
        Reverted
      </button>
    );
  }

  if (action === "DELETE") {
    return (
      <button
        type="button"
        disabled
        title="Rows removed by a delete cannot be restored from this log."
        className={`${btnMuted} cursor-not-allowed opacity-70`}
      >
        Revert
      </button>
    );
  }

  if (action === "CREATE") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "Remove the record that was created by this change? This deletes the current row.",
            )
          ) {
            return;
          }
          startTransition(async () => {
            const res = await undoCreateAuditEntry(auditId);
            if (res.error) {
              window.alert(res.error);
              return;
            }
            router.refresh();
          });
        }}
        className={btnActive}
      >
        {pending ? "Working…" : "Undo create"}
      </button>
    );
  }

  if (action === "UPDATE" && hasBefore) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const res = await revertAuditEntry(auditId);
            if (res.error) {
              window.alert(res.error);
              return;
            }
            router.refresh();
          });
        }}
        className={btnActive}
      >
        {pending ? "Reverting…" : "Revert"}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled
      title="No snapshot available to revert to."
      className={`${btnMuted} cursor-not-allowed opacity-70`}
    >
      Revert
    </button>
  );
}
