"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  buttonDangerClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import {
  deleteImportRule,
  moveImportRule,
  updateImportRule,
} from "@/app/(app)/more/import/actions";

export type ImportRuleCategoryOption = {
  id: string;
  label: string;
};

export type ImportRuleRow = {
  id: string;
  matchText: string;
  categoryId: string | null;
  ignore: boolean;
  categoryLabel: string | null;
};

type KindFilter = "all" | "mapped" | "ignore" | "uncategorized";

export function ImportRulesEditor({
  rules,
  categoryOptions,
}: {
  rules: ImportRuleRow[];
  categoryOptions: ImportRuleCategoryOption[];
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(() => {
    return rules.filter((rule) => {
      if (kind === "ignore" && !rule.ignore) return false;
      if (kind === "mapped" && (rule.ignore || !rule.categoryId)) return false;
      if (kind === "uncategorized" && (rule.ignore || rule.categoryId))
        return false;

      if (!deferredQuery) return true;
      const hay = [
        rule.matchText,
        rule.categoryLabel ?? "",
        rule.ignore ? "ignore" : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(deferredQuery);
    });
  }, [rules, deferredQuery, kind]);

  return (
    <div className="space-y-3">
      <div className={`${cardClass} space-y-3 p-4`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className={`${labelClass} min-w-[12rem] flex-1`}>
            Filter rules
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Match text or category…"
              className={inputClass}
              autoComplete="off"
            />
          </label>
          <label className={`${labelClass} w-full sm:w-44`}>
            Type
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as KindFilter)}
              className={inputClass}
            >
              <option value="all">All</option>
              <option value="mapped">Mapped</option>
              <option value="ignore">Ignore</option>
              <option value="uncategorized">No category</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-fg-subtle">
          Showing {filtered.length} of {rules.length} rules
          {deferredQuery ? ` matching “${query.trim()}”` : ""}
        </p>
      </div>

      <ul className={`${cardClass} divide-y divide-rim-subtle/60`}>
        {filtered.map((rule) => (
          <li key={rule.id} className="space-y-2 p-4">
            <form
              action={updateImportRule}
              className="grid gap-2 sm:grid-cols-3"
            >
              <input type="hidden" name="id" value={rule.id} />
              <label className={labelClass}>
                Match
                <input
                  name="matchText"
                  defaultValue={rule.matchText}
                  className={inputClass}
                  required
                  minLength={3}
                />
              </label>
              <label className={labelClass}>
                Category
                <select
                  name="categoryId"
                  className={inputClass}
                  defaultValue={rule.categoryId ?? ""}
                >
                  <option value="">—</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex items-center gap-2 pb-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    name="ignore"
                    value="1"
                    defaultChecked={rule.ignore}
                  />
                  Ignore
                </label>
                <button type="submit" className={buttonSecondaryClass}>
                  Save
                </button>
              </div>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action={moveImportRule}>
                <input type="hidden" name="id" value={rule.id} />
                <input type="hidden" name="dir" value="up" />
                <button type="submit" className={buttonSecondaryClass}>
                  ↑
                </button>
              </form>
              <form action={moveImportRule}>
                <input type="hidden" name="id" value={rule.id} />
                <input type="hidden" name="dir" value="down" />
                <button type="submit" className={buttonSecondaryClass}>
                  ↓
                </button>
              </form>
              <form action={deleteImportRule}>
                <input type="hidden" name="id" value={rule.id} />
                <button type="submit" className={buttonDangerClass}>
                  Delete
                </button>
              </form>
              <p className="self-center text-xs text-fg-subtle">
                {rule.ignore
                  ? "→ ignore"
                  : rule.categoryLabel
                    ? `→ ${rule.categoryLabel}`
                    : "→ (no category)"}
              </p>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="p-4 text-sm text-fg-muted">
            {rules.length === 0
              ? "No rules yet."
              : "No rules match this filter."}
          </li>
        )}
      </ul>
    </div>
  );
}
