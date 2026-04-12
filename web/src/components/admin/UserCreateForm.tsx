"use client";

import {
  createUserRecord,
  type UserAdminState,
} from "@/app/(dashboard)/admin/users/actions";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/forms/field-classes";
import { useActionState, useId } from "react";

type Option = { id: string; label: string };

export function UserCreateForm({ categoryOptions }: { categoryOptions: Option[] }) {
  const [state, formAction, pending] = useActionState(
    async (_: UserAdminState, fd: FormData) => createUserRecord(_, fd),
    {},
  );
  const roleId = useId();

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Invite user</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          They must sign in with Google using this exact email after you save.
        </p>
      </div>
      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <label className={labelClass} htmlFor="user-email">
          Email
        </label>
        <input
          id="user-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          className={inputClass}
          placeholder="name@company.com"
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="user-name">
          Display name (optional)
        </label>
        <input id="user-name" name="name" className={inputClass} placeholder="Ada Lovelace" />
      </div>
      <div>
        <label className={labelClass} htmlFor={roleId}>
          Role
        </label>
        <select id={roleId} name="role" className={inputClass} defaultValue="USER">
          <option value="USER">Member (category visibility)</option>
          <option value="ADMIN">Admin (full access)</option>
        </select>
      </div>
      <fieldset className="space-y-2 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
        <legend className={`${labelClass} px-1`}>Visible categories (members)</legend>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Admins ignore this list. Members only see parts in these categories (including
          subcategories).
        </p>
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1 text-sm">
          {categoryOptions.length === 0 ? (
            <p className="text-zinc-500">Create categories first.</p>
          ) : (
            categoryOptions.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
              >
                <input type="checkbox" name="categoryIds" value={c.id} className="mt-1" />
                <span className="text-zinc-800 dark:text-zinc-100">{c.label}</span>
              </label>
            ))
          )}
        </div>
      </fieldset>
      <button type="submit" disabled={pending} className={buttonPrimaryClass}>
        {pending ? "Saving…" : "Create user"}
      </button>
    </form>
  );
}
