"use client";

import {
  deleteUserRecord,
  updateUserRecord,
  type UserAdminState,
} from "@/app/(dashboard)/admin/users/actions";
import { buttonDangerClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/forms/field-classes";
import { useActionState, useId } from "react";

type Option = { id: string; label: string };

export function UserEditForm({
  user,
  categoryOptions,
}: {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    role: "ADMIN" | "USER";
    categoryIds: string[];
  };
  categoryOptions: Option[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_: UserAdminState, fd: FormData) => updateUserRecord(_, fd),
    {},
  );
  const roleId = useId();

  return (
    <div className="space-y-8">
      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input type="hidden" name="id" value={user.id} />
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Edit user</h2>
        {state?.error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.error}
          </p>
        ) : null}
        <div>
          <label className={labelClass} htmlFor="edit-email">
            Email
          </label>
          <input
            id="edit-email"
            name="email"
            type="email"
            required
            defaultValue={user.email ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-name">
            Display name
          </label>
          <input
            id="edit-name"
            name="name"
            defaultValue={user.name ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={roleId}>
            Role
          </label>
          <select
            id={roleId}
            name="role"
            className={inputClass}
            defaultValue={user.role}
          >
            <option value="USER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <fieldset className="space-y-2 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
          <legend className={`${labelClass} px-1`}>Visible categories</legend>
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1 text-sm">
            {categoryOptions.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
              >
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={c.id}
                  defaultChecked={user.categoryIds.includes(c.id)}
                  className="mt-1"
                />
                <span className="text-zinc-800 dark:text-zinc-100">{c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <form
        action={deleteUserRecord}
        onSubmit={(e) => {
          if (!confirm("Delete this user? They will no longer be able to sign in.")) {
            e.preventDefault();
          }
        }}
        className="rounded-2xl border border-red-100 bg-red-50/40 p-6 dark:border-red-900/50 dark:bg-red-950/30"
      >
        <input type="hidden" name="id" value={user.id} />
        <button type="submit" className={buttonDangerClass}>
          Delete user
        </button>
      </form>
    </div>
  );
}
