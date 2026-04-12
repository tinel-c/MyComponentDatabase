"use client";

import { updatePartDescription } from "@/app/(dashboard)/parts/actions";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/forms/field-classes";
import { PartMarkdown } from "@/components/parts/PartMarkdown";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

function SaveDescriptionButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonPrimaryClass}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

type Props = {
  partId: string;
  initialDescription: string | null;
  canEdit: boolean;
  /** When set, photos appear under the Description heading (above Markdown). */
  imageGallery?: ReactNode;
};

export function PartDescriptionInline({ partId, initialDescription, canEdit, imageGallery }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDescription ?? "");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [error, setError] = useState<string | null>(null);
  const [, startNavTransition] = useTransition();

  const beginEdit = useCallback(() => {
    setDraft(initialDescription ?? "");
    setMode("write");
    setError(null);
    setEditing(true);
  }, [initialDescription]);

  const cancel = useCallback(() => {
    setDraft(initialDescription ?? "");
    setEditing(false);
    setError(null);
  }, [initialDescription]);

  const showSection = Boolean(canEdit || initialDescription?.trim() || imageGallery);

  if (!showSection) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Description
        </h2>
        {canEdit && !editing ? (
          <button
            type="button"
            onClick={beginEdit}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:underline"
          >
            {initialDescription?.trim() ? "Edit" : "Add description"}
          </button>
        ) : null}
      </div>

      {imageGallery}

      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {!editing ? (
        <div className="mt-3">
          {initialDescription?.trim() ? (
            <PartMarkdown markdown={initialDescription} />
          ) : canEdit ? (
            <p className="text-sm italic text-zinc-500 dark:text-zinc-400">
              No description yet. Use &quot;Add description&quot; to write Markdown.
            </p>
          ) : null}
        </div>
      ) : (
        <form
          className="mt-3 space-y-3"
          action={async (formData) => {
            setError(null);
            const result = await updatePartDescription(formData);
            if (result.error) {
              setError(result.error);
              return;
            }
            setEditing(false);
            startNavTransition(() => {
              router.refresh();
            });
          }}
        >
          <input type="hidden" name="partId" value={partId} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={labelClass}>Markdown</span>
            <div className="flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-600">
              <button
                type="button"
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  mode === "write"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
                onClick={() => setMode("write")}
              >
                Write
              </button>
              <button
                type="button"
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  mode === "preview"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
                onClick={() => setMode("preview")}
              >
                Preview
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Headings, lists, links, tables, and fenced code blocks (GFM).
          </p>
          {mode === "write" ? (
            <textarea
              name="description"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={14}
              className={`${inputClass} font-mono text-sm`}
              placeholder={"## Overview\n\n- …\n- [Datasheet](https://…)"}
            />
          ) : (
            <div className="min-h-[18rem] rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
              {draft.trim() ? (
                <PartMarkdown markdown={draft} />
              ) : (
                <p className="text-sm italic text-zinc-500 dark:text-zinc-400">Nothing to preview yet.</p>
              )}
            </div>
          )}
          {mode === "preview" ? <input type="hidden" name="description" value={draft} readOnly /> : null}
          <div className="flex flex-wrap gap-2">
            <SaveDescriptionButton />
            <button
              type="button"
              onClick={cancel}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
