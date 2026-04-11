"use client";

import { createCategory } from "@/app/categories/actions";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/forms/field-classes";
import type { CategoryFormState } from "@/lib/schemas";
import { useActionState } from "react";

type Option = { id: string; label: string };

export function CategoryCreateForm({ parentOptions }: { parentOptions: Option[] }) {
  const [state, formAction, pending] = useActionState(
    async (_: CategoryFormState, fd: FormData) => createCategory(_, fd),
    {},
  );

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">New category</h2>
      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <label htmlFor="cat-name" className={labelClass}>
          Name
        </label>
        <input
          id="cat-name"
          name="name"
          required
          autoComplete="off"
          className={inputClass}
          placeholder="e.g. Resistors"
        />
      </div>
      <div>
        <label htmlFor="cat-parent" className={labelClass}>
          Parent (optional)
        </label>
        <select id="cat-parent" name="parentId" className={inputClass} defaultValue="">
          <option value="">— None —</option>
          {parentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className={buttonPrimaryClass}>
        {pending ? "Saving…" : "Create category"}
      </button>
    </form>
  );
}
