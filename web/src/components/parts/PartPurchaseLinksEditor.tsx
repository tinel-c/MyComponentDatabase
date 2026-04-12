"use client";

import { buttonPrimaryClass } from "@/components/forms/field-classes";
import { inputClass, labelClass } from "@/components/forms/field-classes";
import { useState } from "react";

export type PurchaseLinkRow = { label: string; url: string };

type Props = {
  initialLinks: PurchaseLinkRow[];
};

export function PartPurchaseLinksEditor({ initialLinks }: Props) {
  const [rows, setRows] = useState<PurchaseLinkRow[]>(
    initialLinks.length > 0 ? initialLinks : [{ label: "", url: "" }],
  );

  const addRow = () => setRows((r) => [...r, { label: "", url: "" }]);
  const removeRow = (index: number) =>
    setRows((r) => (r.length <= 1 ? [{ label: "", url: "" }] : r.filter((_, i) => i !== index)));
  const update = (index: number, field: keyof PurchaseLinkRow, value: string) =>
    setRows((r) => r.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  return (
    <div className="sm:col-span-2 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={labelClass}>Where to buy</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Add links to distributors or shops (TME, Farnell, LCSC, etc.). Only URLs starting with{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">http://</code> or{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">https://</code> are saved.
          </p>
        </div>
        <button type="button" className={buttonPrimaryClass} onClick={addRow}>
          Add link
        </button>
      </div>
      <ul className="space-y-3">
        {rows.map((row, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <input type="hidden" name="purchaseLinkLabel" value={row.label} />
            <input type="hidden" name="purchaseLinkUrl" value={row.url} />
            <div>
              <label htmlFor={`pl-label-${i}`} className="sr-only">
                Label {i + 1}
              </label>
              <input
                id={`pl-label-${i}`}
                value={row.label}
                onChange={(e) => update(i, "label", e.target.value)}
                className={inputClass}
                placeholder="e.g. TME, Farnell"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor={`pl-url-${i}`} className="sr-only">
                URL {i + 1}
              </label>
              <input
                id={`pl-url-${i}`}
                type="url"
                value={row.url}
                onChange={(e) => update(i, "url", e.target.value)}
                className={inputClass}
                placeholder="https://…"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => removeRow(i)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
