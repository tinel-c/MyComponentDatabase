"use client";

import { updatePartDetailsInline } from "@/app/(dashboard)/parts/actions";
import {
  buttonPrimaryClass,
  inputClass,
  labelClass,
  buttonSecondaryClass,
} from "@/components/forms/field-classes";
import type { PartDetailModel } from "@/components/parts/PartDetailView";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonPrimaryClass}>
      {pending ? "Saving…" : "Save details"}
    </button>
  );
}

type Props = {
  part: PartDetailModel;
  canEdit: boolean;
  categoryOptions: { id: string; name: string }[];
  locationOptions: { id: string; name: string }[];
};

export function PartFieldsInline({ part, canEdit, categoryOptions, locationOptions }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [name, setName] = useState(part.name);
  const [internalSku, setInternalSku] = useState(part.internalSku ?? "");
  const [mpn, setMpn] = useState(part.mpn ?? "");
  const [manufacturer, setManufacturer] = useState(part.manufacturer ?? "");
  const [imageUrl, setImageUrl] = useState(part.imageUrl ?? "");
  const [quantityOnHand, setQuantityOnHand] = useState(String(part.quantityOnHand));
  const [reorderMin, setReorderMin] = useState(part.reorderMin == null ? "" : String(part.reorderMin));
  const [unit, setUnit] = useState(part.unit);
  const [categoryId, setCategoryId] = useState(part.categoryId ?? "");
  const [defaultLocationId, setDefaultLocationId] = useState(part.defaultLocationId ?? "");

  const reset = useCallback(() => {
    setName(part.name);
    setInternalSku(part.internalSku ?? "");
    setMpn(part.mpn ?? "");
    setManufacturer(part.manufacturer ?? "");
    setImageUrl(part.imageUrl ?? "");
    setQuantityOnHand(String(part.quantityOnHand));
    setReorderMin(part.reorderMin == null ? "" : String(part.reorderMin));
    setUnit(part.unit);
    setCategoryId(part.categoryId ?? "");
    setDefaultLocationId(part.defaultLocationId ?? "");
  }, [part]);

  if (!canEdit) return null;

  return (
    <section className="rounded-2xl border border-rim/60 bg-surface p-4 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Details</h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing(true);
            }}
            className="text-sm font-medium text-fg-muted hover:text-fg hover:underline"
          >
            Edit all fields
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {!editing ? (
        <p className="mt-3 text-sm text-fg-muted">Click &quot;Edit all fields&quot; to update this part inline.</p>
      ) : (
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          action={async (formData) => {
            setError(null);
            const result = await updatePartDetailsInline(formData);
            if (result.error) {
              setError(result.error);
              return;
            }
            setEditing(false);
            startTransition(() => router.refresh());
          }}
        >
          <input type="hidden" name="partId" value={part.id} />

          <label className={labelClass}>
            Name
            <input className={inputClass} name="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={labelClass}>
            SKU
            <input
              className={inputClass}
              name="internalSku"
              value={internalSku}
              onChange={(e) => setInternalSku(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            MPN
            <input className={inputClass} name="mpn" value={mpn} onChange={(e) => setMpn(e.target.value)} />
          </label>
          <label className={labelClass}>
            Manufacturer
            <input
              className={inputClass}
              name="manufacturer"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Image URL
            <input
              className={inputClass}
              name="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Quantity on hand
            <input
              type="number"
              min={0}
              className={inputClass}
              name="quantityOnHand"
              value={quantityOnHand}
              onChange={(e) => setQuantityOnHand(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Reorder minimum
            <input
              type="number"
              min={0}
              className={inputClass}
              name="reorderMin"
              value={reorderMin}
              onChange={(e) => setReorderMin(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Unit
            <input className={inputClass} name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <label className={labelClass}>
            Category
            <select
              className={inputClass}
              name="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Default location
            <select
              className={inputClass}
              name="defaultLocationId"
              value={defaultLocationId}
              onChange={(e) => setDefaultLocationId(e.target.value)}
            >
              <option value="">—</option>
              {locationOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
            <SaveButton />
            <button
              type="button"
              className={buttonSecondaryClass}
              onClick={() => {
                reset();
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
