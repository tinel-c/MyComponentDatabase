"use client";

import { createPart, deletePart, updatePart } from "@/app/parts/actions";
import { buttonDangerClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/forms/field-classes";
import type { PartFormState } from "@/lib/schemas";
import { useActionState } from "react";

type SelectOption = { id: string; label: string };

type PartValues = {
  id?: string;
  internalSku: string | null;
  name: string;
  mpn: string | null;
  manufacturer: string | null;
  description: string | null;
  quantityOnHand: number;
  reorderMin: number | null;
  unit: string;
  categoryId: string | null;
  defaultLocationId: string | null;
};

export function PartCreateForm({
  categoryOptions,
  locationOptions,
}: {
  categoryOptions: SelectOption[];
  locationOptions: SelectOption[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_: PartFormState, fd: FormData) => createPart(_, fd),
    {},
  );

  return (
    <PartFormInner
      mode="create"
      state={state}
      formAction={formAction}
      pending={pending}
      categoryOptions={categoryOptions}
      locationOptions={locationOptions}
      defaultValues={{
        internalSku: null,
        name: "",
        mpn: null,
        manufacturer: null,
        description: null,
        quantityOnHand: 0,
        reorderMin: null,
        unit: "pcs",
        categoryId: null,
        defaultLocationId: null,
      }}
    />
  );
}

export function PartEditForm({
  part,
  categoryOptions,
  locationOptions,
}: {
  part: PartValues & { id: string };
  categoryOptions: SelectOption[];
  locationOptions: SelectOption[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_: PartFormState, fd: FormData) => updatePart(_, fd),
    {},
  );

  return (
    <div className="space-y-6">
      <PartFormInner
        mode="edit"
        state={state}
        formAction={formAction}
        pending={pending}
        categoryOptions={categoryOptions}
        locationOptions={locationOptions}
        defaultValues={part}
      />
      <form
        action={deletePart}
        onSubmit={(e) => {
          if (!confirm("Delete this part permanently?")) e.preventDefault();
        }}
        className="rounded-xl border border-red-100 bg-red-50/50 p-6 dark:border-red-900/40 dark:bg-red-950/20"
      >
        <input type="hidden" name="id" value={part.id} />
        <button type="submit" className={buttonDangerClass}>
          Delete part
        </button>
      </form>
    </div>
  );
}

function PartFormInner({
  mode,
  state,
  formAction,
  pending,
  categoryOptions,
  locationOptions,
  defaultValues,
}: {
  mode: "create" | "edit";
  state: PartFormState;
  formAction: (payload: FormData) => void;
  pending: boolean;
  categoryOptions: SelectOption[];
  locationOptions: SelectOption[];
  defaultValues: PartValues;
}) {
  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {mode === "edit" && defaultValues.id ? (
        <input type="hidden" name="id" value={defaultValues.id} />
      ) : null}
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        {mode === "create" ? "New part" : "Edit part"}
      </h2>
      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="part-name" className={labelClass}>
            Name <span className="text-red-600">*</span>
          </label>
          <input
            id="part-name"
            name="name"
            required
            defaultValue={defaultValues.name}
            className={inputClass}
            placeholder="e.g. 10k 0603 1%"
          />
        </div>
        <div>
          <label htmlFor="part-sku" className={labelClass}>
            Internal SKU
          </label>
          <input
            id="part-sku"
            name="internalSku"
            defaultValue={defaultValues.internalSku ?? ""}
            className={inputClass}
            placeholder="Optional unique code"
          />
        </div>
        <div>
          <label htmlFor="part-mpn" className={labelClass}>
            MPN
          </label>
          <input
            id="part-mpn"
            name="mpn"
            defaultValue={defaultValues.mpn ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="part-mfg" className={labelClass}>
            Manufacturer
          </label>
          <input
            id="part-mfg"
            name="manufacturer"
            defaultValue={defaultValues.manufacturer ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="part-qty" className={labelClass}>
            Quantity on hand
          </label>
          <input
            id="part-qty"
            name="quantityOnHand"
            type="number"
            min={0}
            required
            defaultValue={defaultValues.quantityOnHand}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="part-unit" className={labelClass}>
            Unit
          </label>
          <input
            id="part-unit"
            name="unit"
            defaultValue={defaultValues.unit}
            className={inputClass}
            placeholder="pcs"
          />
        </div>
        <div>
          <label htmlFor="part-reorder" className={labelClass}>
            Reorder at (optional)
          </label>
          <input
            id="part-reorder"
            name="reorderMin"
            type="number"
            min={0}
            defaultValue={defaultValues.reorderMin ?? ""}
            className={inputClass}
            placeholder="Alert when at or below"
          />
        </div>
        <div>
          <label htmlFor="part-cat" className={labelClass}>
            Category
          </label>
          <select
            id="part-cat"
            name="categoryId"
            className={inputClass}
            defaultValue={defaultValues.categoryId ?? ""}
          >
            <option value="">— None —</option>
            {categoryOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="part-loc" className={labelClass}>
            Default location
          </label>
          <select
            id="part-loc"
            name="defaultLocationId"
            className={inputClass}
            defaultValue={defaultValues.defaultLocationId ?? ""}
          >
            <option value="">— None —</option>
            {locationOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="part-desc" className={labelClass}>
            Description
          </label>
          <textarea
            id="part-desc"
            name="description"
            rows={4}
            defaultValue={defaultValues.description ?? ""}
            className={inputClass}
            placeholder="Notes, parameters, substitutes…"
          />
        </div>
      </div>

      <button type="submit" disabled={pending} className={buttonPrimaryClass}>
        {pending ? "Saving…" : mode === "create" ? "Create part" : "Save changes"}
      </button>
    </form>
  );
}
