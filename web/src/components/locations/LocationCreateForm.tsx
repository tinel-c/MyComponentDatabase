"use client";

import { createLocation } from "@/app/locations/actions";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/forms/field-classes";
import type { LocationFormState } from "@/lib/schemas";
import { useActionState } from "react";

type Option = { id: string; label: string };

export function LocationCreateForm({ parentOptions }: { parentOptions: Option[] }) {
  const [state, formAction, pending] = useActionState(
    async (_: LocationFormState, fd: FormData) => createLocation(_, fd),
    {},
  );

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">New storage location</h2>
      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <label htmlFor="loc-name" className={labelClass}>
          Name
        </label>
        <input
          id="loc-name"
          name="name"
          required
          autoComplete="off"
          className={inputClass}
          placeholder="e.g. Shelf A — Bin 3"
        />
      </div>
      <div>
        <label htmlFor="loc-parent" className={labelClass}>
          Parent (optional)
        </label>
        <select id="loc-parent" name="parentId" className={inputClass} defaultValue="">
          <option value="">— None —</option>
          {parentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className={buttonPrimaryClass}>
        {pending ? "Saving…" : "Create location"}
      </button>
    </form>
  );
}
