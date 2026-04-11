"use client";

import { deleteCategory, updateCategory } from "@/app/categories/actions";
import { buttonDangerClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/forms/field-classes";
import type { CategoryFormState } from "@/lib/schemas";
import { useActionState } from "react";

type Option = { id: string; label: string };

export function CategoryEditForm({
  category,
  parentOptions,
}: {
  category: { id: string; name: string; parentId: string | null };
  parentOptions: Option[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_: CategoryFormState, fd: FormData) => updateCategory(_, fd),
    {},
  );

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <input type="hidden" name="id" value={category.id} />
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Edit category</h2>
        {state?.error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.error}
          </p>
        ) : null}
        <div>
          <label htmlFor="edit-cat-name" className={labelClass}>
            Name
          </label>
          <input
            id="edit-cat-name"
            name="name"
            required
            defaultValue={category.name}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="edit-cat-parent" className={labelClass}>
            Parent
          </label>
          <select
            id="edit-cat-parent"
            name="parentId"
            className={inputClass}
            defaultValue={category.parentId ?? ""}
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

      <ConfirmDeleteForm
        action={deleteCategory}
        id={category.id}
        message="Delete this category? Sub-categories become top-level; parts lose this category link."
      />
    </div>
  );
}

function ConfirmDeleteForm({
  action,
  id,
  message,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  message: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className="rounded-xl border border-red-100 bg-red-50/50 p-6 dark:border-red-900/40 dark:bg-red-950/20"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={buttonDangerClass}>
        Delete category
      </button>
    </form>
  );
}
