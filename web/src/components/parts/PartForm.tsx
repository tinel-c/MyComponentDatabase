"use client";

import { createPart, deletePart, updatePart } from "@/app/(dashboard)/parts/actions";
import { buttonDangerClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/forms/field-classes";
import { PartDescriptionWikiField } from "@/components/parts/PartDescriptionWikiField";
import { PartImagePicker } from "@/components/parts/PartImagePicker";
import { PartImagesManager, type PartImageRow } from "@/components/parts/PartImagesManager";
import { PartPurchaseLinksEditor } from "@/components/parts/PartPurchaseLinksEditor";
import { PartSupplierLinks } from "@/components/parts/PartSupplierLinks";
import { buildSupplierSearchQuery } from "@/lib/supplier-links";
import type { PartFormState } from "@/lib/schemas";
import Link from "next/link";
import { useActionState, useCallback, useState } from "react";

type SelectOption = { id: string; label: string };

type PartValues = {
  id?: string;
  /** Shown on edit form as link to /p/{partNumber} */
  partNumber?: number;
  internalSku: string | null;
  name: string;
  mpn: string | null;
  manufacturer: string | null;
  description: string | null;
  imageUrl: string | null;
  quantityOnHand: number;
  reorderMin: number | null;
  unit: string;
  categoryId: string | null;
  defaultLocationId: string | null;
  purchaseLinks?: { label: string; url: string }[];
};

export function PartCreateForm({
  categoryOptions,
  locationOptions,
  requireCategory = false,
}: {
  categoryOptions: SelectOption[];
  locationOptions: SelectOption[];
  requireCategory?: boolean;
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
      requireCategory={requireCategory}
      defaultValues={{
        internalSku: null,
        name: "",
        mpn: null,
        manufacturer: null,
        description: null,
        imageUrl: null,
        quantityOnHand: 0,
        reorderMin: null,
        unit: "pcs",
        categoryId: null,
        defaultLocationId: null,
        purchaseLinks: [],
      }}
    />
  );
}

export function PartEditForm({
  part,
  partImages,
  categoryOptions,
  locationOptions,
  requireCategory = false,
}: {
  part: PartValues & { id: string };
  partImages: PartImageRow[];
  categoryOptions: SelectOption[];
  locationOptions: SelectOption[];
  requireCategory?: boolean;
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
        requireCategory={requireCategory}
        defaultValues={part}
      />
      <PartImagesManager
        partId={part.id}
        cardImageUrl={part.imageUrl}
        images={partImages}
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
  requireCategory,
  defaultValues,
}: {
  mode: "create" | "edit";
  state: PartFormState;
  formAction: (payload: FormData) => void;
  pending: boolean;
  categoryOptions: SelectOption[];
  locationOptions: SelectOption[];
  requireCategory: boolean;
  defaultValues: PartValues;
}) {
  const [name, setName] = useState(defaultValues.name);
  const [mpn, setMpn] = useState(defaultValues.mpn ?? "");
  const [manufacturer, setManufacturer] = useState(defaultValues.manufacturer ?? "");
  const [imageUrl, setImageUrl] = useState(defaultValues.imageUrl ?? "");

  const getSearchQuery = useCallback(
    () => buildSupplierSearchQuery({ mpn: mpn || null, manufacturer: manufacturer || null, name }),
    [mpn, manufacturer, name],
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {mode === "edit" && defaultValues.id ? (
        <input type="hidden" name="id" value={defaultValues.id} />
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          {mode === "create" ? "New part" : "Edit part"}
        </h2>
        {mode === "edit" && defaultValues.id ? (
          <Link
            href={`/parts/${defaultValues.id}`}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:underline"
          >
            Open part page →
          </Link>
        ) : null}
      </div>
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
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            value={mpn}
            onChange={(e) => setMpn(e.target.value)}
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
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
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
            {requireCategory ? <span className="text-red-600"> *</span> : null}
          </label>
          <select
            id="part-cat"
            name="categoryId"
            className={inputClass}
            defaultValue={defaultValues.categoryId ?? ""}
            required={requireCategory}
          >
            {!requireCategory ? <option value="">— None —</option> : null}
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
        <PartDescriptionWikiField
          id="part-desc"
          name="description"
          defaultValue={defaultValues.description ?? ""}
        />
        <PartPurchaseLinksEditor initialLinks={defaultValues.purchaseLinks ?? []} />
        <div className="sm:col-span-2">
          <PartSupplierLinks mpn={mpn || null} manufacturer={manufacturer || null} name={name} />
        </div>

        <div className="sm:col-span-2">
          <PartImagePicker
            imageUrl={imageUrl}
            setImageUrl={setImageUrl}
            getSearchQuery={getSearchQuery}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="part-image" className={labelClass}>
            Image URL (pinned picture for cards)
          </label>
          <input
            id="part-image"
            name="imageUrl"
            type="url"
            inputMode="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className={inputClass}
            placeholder="https://…"
          />
        </div>
      </div>

      <button type="submit" disabled={pending} className={buttonPrimaryClass}>
        {pending ? "Saving…" : mode === "create" ? "Create part" : "Save changes"}
      </button>
    </form>
  );
}
