"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteTransaction } from "@/app/(app)/transactions/actions";

export function DeleteTransactionButton({
  id,
  returnTo,
  label = "Delete",
  compact = false,
}: {
  id: string;
  returnTo: string;
  label?: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      title="Delete transaction"
      aria-label="Delete transaction"
      className={
        compact
          ? "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-danger/35 bg-danger-muted text-danger-fg transition-colors hover:bg-danger/20 disabled:opacity-50"
          : "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-danger/40 bg-danger-muted px-4 py-2.5 text-sm font-medium text-danger-fg transition-colors hover:bg-danger/20 disabled:opacity-50"
      }
      onClick={() => {
        if (
          !window.confirm(
            "Delete this transaction? This cannot be undone.",
          )
        ) {
          return;
        }
        const fd = new FormData();
        fd.set("id", id);
        fd.set("returnTo", returnTo);
        start(async () => {
          await deleteTransaction(fd);
        });
      }}
    >
      <Trash2 className="size-4" />
      {!compact && <span>{pending ? "Deleting…" : label}</span>}
    </button>
  );
}
