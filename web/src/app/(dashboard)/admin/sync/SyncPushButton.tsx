"use client";

import { buttonPrimaryClass } from "@/components/forms/field-classes";
import { useState, useTransition } from "react";

type PushResult =
  | { ok: true; summary: Record<string, number>; assets: { files: number } }
  | { ok: false; error: string };

export function SyncPushButton({ pushAction }: { pushAction: () => Promise<PushResult> }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      const r = await pushAction();
      if (r.ok) {
        const lines = Object.entries(r.summary)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
        setMessage({
          kind: "ok",
          text: `${lines ? `Imported counts:\n${lines}\n` : ""}Uploaded asset files: ${r.assets.files}`,
        });
      } else {
        setMessage({ kind: "err", text: r.error });
      }
    });
  }

  return (
    <div className="space-y-3">
      <button type="button" className={buttonPrimaryClass} disabled={pending} onClick={run}>
        {pending ? "Pushing…" : "Push inventory to production"}
      </button>
      {message ? (
        <pre
          className={
            message.kind === "ok"
              ? "whitespace-pre-wrap rounded-lg border border-rim/60 bg-surface px-3 py-2 text-sm text-fg"
              : "whitespace-pre-wrap rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-sm text-danger-fg"
          }
        >
          {message.text}
        </pre>
      ) : null}
    </div>
  );
}
