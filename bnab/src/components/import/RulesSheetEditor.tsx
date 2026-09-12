"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  buttonCompactClass,
  buttonCompactDangerClass,
  cardCompactClass,
  denseTdClass,
  denseThClass,
  inputCompactClass,
} from "@/components/forms/field-classes";

export type RuleCategoryOption = {
  id: string;
  label: string;
};

export type RuleAccountOption = {
  id: string;
  label: string;
};

export type RuleRow = {
  id: string;
  matchText: string;
  categoryId: string | null;
  ignore: boolean;
  categoryLabel: string | null;
  transferAccountId?: string | null;
  transferAccountLabel?: string | null;
};

type KindFilter = "all" | "mapped" | "ignore" | "transfer" | "uncategorized";

type FormAction = (formData: FormData) => void | Promise<void>;

function RuleActionCluster({
  ruleId,
  updateFormId,
  onMove,
  onDelete,
}: {
  ruleId: string;
  updateFormId: string;
  onMove: FormAction;
  onDelete: FormAction;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <form action={onMove}>
        <input type="hidden" name="id" value={ruleId} />
        <input type="hidden" name="dir" value="up" />
        <button type="submit" className={buttonCompactClass} title="Move up" aria-label="Move up">
          ↑
        </button>
      </form>
      <form action={onMove}>
        <input type="hidden" name="id" value={ruleId} />
        <input type="hidden" name="dir" value="down" />
        <button type="submit" className={buttonCompactClass} title="Move down" aria-label="Move down">
          ↓
        </button>
      </form>
      <button type="submit" form={updateFormId} className={buttonCompactClass}>
        Save
      </button>
      <form action={onDelete}>
        <input type="hidden" name="id" value={ruleId} />
        <button type="submit" className={buttonCompactDangerClass}>
          Delete
        </button>
      </form>
    </div>
  );
}

export function RulesSheetEditor({
  rules,
  categoryOptions,
  accountOptions,
  matchMinLength = 3,
  ignoreHint = "Ignore",
  onUpdate,
  onMove,
  onDelete,
}: {
  rules: RuleRow[];
  categoryOptions: RuleCategoryOption[];
  /** When set, shows a Transfer-to account column (import mappings). */
  accountOptions?: RuleAccountOption[];
  matchMinLength?: number;
  ignoreHint?: string;
  onUpdate: FormAction;
  onMove: FormAction;
  onDelete: FormAction;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const showTransfer = Boolean(accountOptions && accountOptions.length > 0);

  const filtered = useMemo(() => {
    return rules.filter((rule) => {
      const isTransfer = Boolean(rule.transferAccountId);
      if (kind === "ignore" && !rule.ignore) return false;
      if (kind === "transfer" && !isTransfer) return false;
      if (
        kind === "mapped" &&
        (rule.ignore || isTransfer || !rule.categoryId)
      )
        return false;
      if (
        kind === "uncategorized" &&
        (rule.ignore || isTransfer || rule.categoryId)
      )
        return false;

      if (!deferredQuery) return true;
      const hay = [
        rule.matchText,
        rule.categoryLabel ?? "",
        rule.transferAccountLabel ?? "",
        rule.ignore ? "ignore" : "",
        isTransfer ? "transfer" : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(deferredQuery);
    });
  }, [rules, deferredQuery, kind]);

  const colSpan = showTransfer ? 5 : 4;

  return (
    <div className="space-y-3">
      <div className={`${cardCompactClass} p-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              showTransfer
                ? "Filter match, category, or account…"
                : "Filter match or category…"
            }
            className={`${inputCompactClass} min-w-[12rem] flex-1`}
            autoComplete="off"
            aria-label="Filter rules"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as KindFilter)}
            className={`${inputCompactClass} w-full sm:w-40`}
            aria-label="Rule type"
          >
            <option value="all">All</option>
            <option value="mapped">Mapped</option>
            {showTransfer ? <option value="transfer">Transfer</option> : null}
            <option value="ignore">Ignore</option>
            <option value="uncategorized">No category</option>
          </select>
          <p className="w-full text-xs text-fg-subtle sm:ml-auto sm:w-auto">
            {filtered.length}/{rules.length}
            {deferredQuery ? ` · “${query.trim()}”` : ""}
          </p>
        </div>
      </div>

      <div className={`${cardCompactClass} hidden overflow-x-auto md:block`}>
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr>
              <th className={denseThClass}>Match</th>
              <th className={denseThClass}>Category</th>
              {showTransfer ? (
                <th className={denseThClass}>Transfer to</th>
              ) : null}
              <th className={`${denseThClass} w-20`}>Ignore</th>
              <th className={`${denseThClass} w-[11.5rem] text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rule) => {
              const formId = `rule-update-${rule.id}`;
              return (
                <tr
                  key={rule.id}
                  className="hover:bg-accent-muted/25 focus-within:bg-accent-muted/30"
                >
                  <td className={denseTdClass}>
                    <form id={formId} action={onUpdate} className="contents">
                      <input type="hidden" name="id" value={rule.id} />
                      <input
                        name="matchText"
                        defaultValue={rule.matchText}
                        className={inputCompactClass}
                        required
                        minLength={matchMinLength}
                        aria-label="Match substring"
                      />
                    </form>
                  </td>
                  <td className={denseTdClass}>
                    <select
                      name="categoryId"
                      form={formId}
                      className={inputCompactClass}
                      defaultValue={rule.categoryId ?? ""}
                      aria-label="Category"
                    >
                      <option value="">—</option>
                      {categoryOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  {showTransfer ? (
                    <td className={denseTdClass}>
                      <select
                        name="transferAccountId"
                        form={formId}
                        className={inputCompactClass}
                        defaultValue={rule.transferAccountId ?? ""}
                        aria-label="Transfer to account"
                      >
                        <option value="">—</option>
                        {accountOptions!.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : null}
                  <td className={`${denseTdClass} text-center`}>
                    <input
                      type="checkbox"
                      name="ignore"
                      value="1"
                      form={formId}
                      defaultChecked={rule.ignore}
                      className="size-4 accent-[var(--accent)]"
                      title={ignoreHint}
                      aria-label={ignoreHint}
                    />
                  </td>
                  <td className={denseTdClass}>
                    <RuleActionCluster
                      ruleId={rule.id}
                      updateFormId={formId}
                      onMove={onMove}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-4 text-sm text-fg-muted">
                  {rules.length === 0
                    ? "No rules yet."
                    : "No rules match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ul className={`${cardCompactClass} divide-y divide-rim-subtle md:hidden`}>
        {filtered.map((rule) => {
          const formId = `rule-update-m-${rule.id}`;
          return (
            <li key={rule.id} className="space-y-2 p-3">
              <form id={formId} action={onUpdate} className="space-y-2">
                <input type="hidden" name="id" value={rule.id} />
                <input
                  name="matchText"
                  defaultValue={rule.matchText}
                  className={inputCompactClass}
                  required
                  minLength={matchMinLength}
                  aria-label="Match substring"
                  placeholder="Match substring"
                />
                <select
                  name="categoryId"
                  className={inputCompactClass}
                  defaultValue={rule.categoryId ?? ""}
                  aria-label="Category"
                >
                  <option value="">— Category</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {showTransfer ? (
                  <select
                    name="transferAccountId"
                    className={inputCompactClass}
                    defaultValue={rule.transferAccountId ?? ""}
                    aria-label="Transfer to account"
                  >
                    <option value="">— Transfer to account</option>
                    {accountOptions!.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    name="ignore"
                    value="1"
                    defaultChecked={rule.ignore}
                    className="size-4 accent-[var(--accent)]"
                  />
                  {ignoreHint}
                </label>
              </form>
              <RuleActionCluster
                ruleId={rule.id}
                updateFormId={formId}
                onMove={onMove}
                onDelete={onDelete}
              />
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="p-3 text-sm text-fg-muted">
            {rules.length === 0
              ? "No rules yet."
              : "No rules match this filter."}
          </li>
        )}
      </ul>
    </div>
  );
}
