"use client";

import { tdClass, thClass, tableClass } from "@/components/forms/field-classes";
import { updatePartFromTable } from "@/app/(dashboard)/parts/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { PartRowThumbnail } from "./PartRowThumbnail";

const inputInline =
  "w-full min-w-0 rounded border border-zinc-700/80 bg-zinc-950/50 px-2 py-1 text-sm text-zinc-50 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/40";

export type PartsTableRowModel = {
  id: string;
  partNumber: number;
  name: string;
  internalSku: string | null;
  quantityOnHand: number;
  unit: string;
  reorderMin: number | null;
  categoryId: string | null;
  defaultLocationId: string | null;
  thumbUrl: string | null;
  updatedAt: string;
};

type PartsEditableTableProps = {
  rows: PartsTableRowModel[];
  categoryOptions: { id: string; label: string }[];
  locationOptions: { id: string; label: string }[];
  unitOptions: string[];
  /** When true (typical USER), category cannot be cleared. */
  requireCategory: boolean;
  emptyMessage: string;
};

function serializeRow(r: {
  name: string;
  internalSku: string;
  quantityOnHand: number;
  unit: string;
  categoryId: string;
  defaultLocationId: string;
}) {
  return JSON.stringify({
    name: r.name.trim(),
    internalSku: r.internalSku.trim() === "" ? null : r.internalSku.trim(),
    quantityOnHand: r.quantityOnHand,
    unit: r.unit,
    categoryId: r.categoryId === "" ? null : r.categoryId,
    defaultLocationId: r.defaultLocationId === "" ? null : r.defaultLocationId,
  });
}

function EditablePartRow({
  initial,
  categoryOptions,
  locationOptions,
  unitOptions,
  requireCategory,
}: {
  initial: PartsTableRowModel;
  categoryOptions: { id: string; label: string }[];
  locationOptions: { id: string; label: string }[];
  unitOptions: string[];
  requireCategory: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [internalSku, setInternalSku] = useState(initial.internalSku ?? "");
  const [quantityOnHand, setQuantityOnHand] = useState(initial.quantityOnHand);
  const [unit, setUnit] = useState(initial.unit);
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const [defaultLocationId, setDefaultLocationId] = useState(initial.defaultLocationId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const baseline = useRef(
    serializeRow({
      name: initial.name,
      internalSku: initial.internalSku ?? "",
      quantityOnHand: initial.quantityOnHand,
      unit: initial.unit,
      categoryId: initial.categoryId ?? "",
      defaultLocationId: initial.defaultLocationId ?? "",
    }),
  );

  const unitChoices = Array.from(new Set([...unitOptions, unit])).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  const categorySelectOptions = useMemo(() => {
    if (categoryId && !categoryOptions.some((c) => c.id === categoryId)) {
      return [{ id: categoryId, label: categoryId }, ...categoryOptions];
    }
    return categoryOptions;
  }, [categoryId, categoryOptions]);

  const locationSelectOptions = useMemo(() => {
    if (defaultLocationId && !locationOptions.some((l) => l.id === defaultLocationId)) {
      return [{ id: defaultLocationId, label: defaultLocationId }, ...locationOptions];
    }
    return locationOptions;
  }, [defaultLocationId, locationOptions]);

  const commit = useCallback(async () => {
    const next = serializeRow({
      name,
      internalSku,
      quantityOnHand,
      unit,
      categoryId,
      defaultLocationId,
    });
    if (next === baseline.current) return;

    if (requireCategory && !categoryId) {
      setError("Choose a category.");
      return;
    }

    setSaving(true);
    setError(null);
    const res = await updatePartFromTable({
      partId: initial.id,
      name: name.trim(),
      internalSku: internalSku.trim() === "" ? null : internalSku.trim(),
      quantityOnHand,
      unit,
      categoryId: categoryId === "" ? null : categoryId,
      defaultLocationId: defaultLocationId === "" ? null : defaultLocationId,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    baseline.current = next;
    router.refresh();
  }, [
    categoryId,
    defaultLocationId,
    initial.id,
    internalSku,
    name,
    quantityOnHand,
    requireCategory,
    router,
    unit,
  ]);

  const low =
    initial.reorderMin != null && quantityOnHand <= initial.reorderMin;

  return (
    <tr className={saving ? "opacity-80" : undefined}>
      <td className={`${tdClass} w-14 pl-3 align-middle`}>
        <Link
          href={`/parts/${initial.id}`}
          className="inline-block"
          aria-label={`Open part: ${name}`}
        >
          <PartRowThumbnail imageUrl={initial.thumbUrl} />
        </Link>
      </td>
      <td className={tdClass}>
        <div className="flex min-w-[8rem] flex-col gap-1">
          <input
            type="text"
            className={inputInline}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void commit()}
            aria-label="Name"
          />
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            #{initial.partNumber}
          </span>
          {low ? (
            <span className="w-fit rounded-full bg-zinc-900/80 px-2 py-0.5 text-xs font-medium text-zinc-200 ring-1 ring-zinc-600/40">
              Low stock
            </span>
          ) : null}
          {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
          {saving ? (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Saving…</span>
          ) : null}
        </div>
      </td>
      <td className={`${tdClass} hidden sm:table-cell`}>
        <input
          type="text"
          className={inputInline}
          value={internalSku}
          onChange={(e) => setInternalSku(e.target.value)}
          onBlur={() => void commit()}
          aria-label="Internal SKU"
        />
      </td>
      <td className={tdClass}>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <input
            type="number"
            min={0}
            className={`${inputInline} max-w-[4.5rem]`}
            value={quantityOnHand}
            onChange={(e) => setQuantityOnHand(Number.parseInt(e.target.value, 10) || 0)}
            onBlur={() => void commit()}
            aria-label="Quantity on hand"
          />
          <select
            className={`${inputInline} max-w-[7rem]`}
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
            }}
            onBlur={() => void commit()}
            aria-label="Unit"
          >
            {unitChoices.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className={`${tdClass} hidden min-w-[10rem] md:table-cell`}>
        <select
          className={inputInline}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          onBlur={() => void commit()}
          aria-label="Category"
        >
          {!requireCategory ? <option value="">—</option> : null}
          {categorySelectOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </td>
      <td className={`${tdClass} hidden min-w-[10rem] lg:table-cell`}>
        <select
          className={inputInline}
          value={defaultLocationId}
          onChange={(e) => setDefaultLocationId(e.target.value)}
          onBlur={() => void commit()}
          aria-label="Default location"
        >
          <option value="">—</option>
          {locationSelectOptions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </td>
      <td className={`${tdClass} text-right`}>
        <Link
          href={`/parts/${initial.id}/edit`}
          className="font-medium text-zinc-400 hover:text-zinc-200 hover:underline"
        >
          Edit
        </Link>
      </td>
    </tr>
  );
}

export function PartsEditableTable({
  rows,
  categoryOptions,
  locationOptions,
  unitOptions,
  requireCategory,
  emptyMessage,
}: PartsEditableTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-900/40 shadow-sm shadow-black/20">
      <table className={`${tableClass} min-w-[640px]`}>
        <thead>
          <tr>
            <th className={`${thClass} w-14 pl-3`} scope="col">
              <span className="sr-only">Photo</span>
            </th>
            <th className={thClass}>Name</th>
            <th className={`${thClass} hidden sm:table-cell`}>SKU</th>
            <th className={thClass}>Qty</th>
            <th className={`${thClass} hidden md:table-cell`}>Category</th>
            <th className={`${thClass} hidden lg:table-cell`}>Location</th>
            <th className={`${thClass} w-20 text-right`} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className={`${tdClass} text-zinc-500`}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <EditablePartRow
                key={`${r.id}-${r.updatedAt}`}
                initial={r}
                categoryOptions={categoryOptions}
                locationOptions={locationOptions}
                unitOptions={unitOptions}
                requireCategory={requireCategory}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
