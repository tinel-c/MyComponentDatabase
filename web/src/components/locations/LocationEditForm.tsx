"use client";

import { deleteLocation, updateLocation } from "@/app/locations/actions";
import { buttonDangerClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/forms/field-classes";
import type { LocationFormState } from "@/lib/schemas";
import { useActionState } from "react";

type Option = { id: string; label: string };

export function LocationEditForm({
  location,
  parentOptions,
}: {
  location: { id: string; name: string; parentId: string | null };
  parentOptions: Option[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_: LocationFormState, fd: FormData) => updateLocation(_, fd),
    {},
  );

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <input type="hidden" name="id" value={location.id} />
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Edit location</h2>
        {state?.error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.error}
          </p>
        ) : null}
        <div>
          <label htmlFor="edit-loc-name" className={labelClass}>
            Name
          </label>
          <input
            id="edit-loc-name"
            name="name"
            required
            defaultValue={location.name}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="edit-loc-parent" className={labelClass}>
            Parent
          </label>
          <select
            id="edit-loc-parent"
            name="parentId"
            className={inputClass}
            defaultValue={location.parentId ?? ""}
          >
            <option value="">— None —</option>
            {parentOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <form
        action={deleteLocation}
        onSubmit={(e) => {
          if (!confirm("Delete this location? Parts lose their default location link.")) {
            e.preventDefault();
          }
        }}
        className="rounded-xl border border-red-100 bg-red-50/50 p-6 dark:border-red-900/40 dark:bg-red-950/20"
      >
        <input type="hidden" name="id" value={location.id} />
        <button type="submit" className={buttonDangerClass}>
          Delete location
        </button>
      </form>
    </div>
  );
}
