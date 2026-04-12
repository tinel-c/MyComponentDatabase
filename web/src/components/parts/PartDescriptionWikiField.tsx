"use client";

import { inputClass, labelClass } from "@/components/forms/field-classes";
import { PartMarkdown } from "@/components/parts/PartMarkdown";
import { useState } from "react";

type Props = {
  id: string;
  name: string;
  defaultValue: string;
};

export function PartDescriptionWikiField({ id, name, defaultValue }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<"write" | "preview">("write");

  return (
    <div className="sm:col-span-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className={labelClass}>
          Description (Markdown wiki)
        </label>
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
      <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
        Use Markdown: headings, lists, links, tables, and fenced code blocks.
      </p>
      <input type="hidden" name={name} value={value} readOnly />
      {mode === "write" ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={14}
          className={`${inputClass} font-mono text-sm`}
          placeholder={"## Overview\n\n- Param A: …\n- [Datasheet](https://…)"}
        />
      ) : (
        <div className="min-h-[18rem] rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
          {value.trim() ? (
            <PartMarkdown markdown={value} />
          ) : (
            <p className="text-sm italic text-zinc-500 dark:text-zinc-400">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
