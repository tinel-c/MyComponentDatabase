"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type DragEvent,
} from "react";
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
        <input type="hidden" name="dir" value="top" />
        <button
          type="submit"
          className={buttonCompactClass}
          title="Move to top"
          aria-label="Move to top"
        >
          ⤒
        </button>
      </form>
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

function reorderIds(ids: string[], fromId: string, toId: string): string[] {
  if (fromId === toId) return ids;
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0) return ids;
  const next = [...ids];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function RulesSheetEditor({
  rules,
  categoryOptions,
  accountOptions,
  matchMinLength = 3,
  ignoreHint = "Ignore",
  initialQuery = "",
  initialRuleId = "",
  enableDragReorder = false,
  onUpdate,
  onMove,
  onDelete,
  onReorder,
}: {
  rules: RuleRow[];
  categoryOptions: RuleCategoryOption[];
  /** When set, shows a Transfer-to account column (import mappings). */
  accountOptions?: RuleAccountOption[];
  matchMinLength?: number;
  ignoreHint?: string;
  /** Prefill filter from URL (e.g. import preview deep-link). */
  initialQuery?: string;
  /** When set, only show this rule id (import preview deep-link). */
  initialRuleId?: string;
  /** Desktop HTML5 drag-and-drop (import mappings). */
  enableDragReorder?: boolean;
  onUpdate: FormAction;
  onMove: FormAction;
  onDelete: FormAction;
  onReorder?: (orderedIds: string[]) => void | Promise<void>;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [ruleIdFilter, setRuleIdFilter] = useState(initialRuleId ?? "");
  const [kind, setKind] = useState<KindFilter>("all");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const showTransfer = Boolean(accountOptions && accountOptions.length > 0);
  const [orderedRules, setOrderedRules] = useState(rules);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrderedRules(rules);
  }, [rules]);

  const filterActive = Boolean(
    ruleIdFilter || deferredQuery || kind !== "all",
  );
  const canDrag = Boolean(
    enableDragReorder && onReorder && !filterActive && !pending,
  );

  const filtered = useMemo(() => {
    return orderedRules.filter((rule) => {
      if (ruleIdFilter && rule.id !== ruleIdFilter) return false;
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
  }, [orderedRules, deferredQuery, kind, ruleIdFilter]);

  const colSpan = (showTransfer ? 5 : 4) + (canDrag || enableDragReorder ? 1 : 0);

  function commitReorder(fromId: string, toId: string) {
    if (!onReorder) return;
    const ids = orderedRules.map((r) => r.id);
    const nextIds = reorderIds(ids, fromId, toId);
    if (nextIds.join(",") === ids.join(",")) return;
    const byId = new Map(orderedRules.map((r) => [r.id, r]));
    setOrderedRules(nextIds.map((id) => byId.get(id)!).filter(Boolean));
    startTransition(async () => {
      await onReorder(nextIds);
    });
  }

  function onDragStart(e: DragEvent, id: string) {
    if (!canDrag) return;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDragOver(e: DragEvent, id: string) {
    if (!canDrag || !dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropId !== id) setDropId(id);
  }

  function onDrop(e: DragEvent, id: string) {
    if (!canDrag) return;
    e.preventDefault();
    const from = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setDropId(null);
    if (from) commitReorder(from, id);
  }

  function onDragEnd() {
    setDragId(null);
    setDropId(null);
  }

  return (
    <div className="space-y-3">
      <div className={`${cardCompactClass} p-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (ruleIdFilter) setRuleIdFilter("");
            }}
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
            {filtered.length}/{orderedRules.length}
            {ruleIdFilter ? " · linked rule" : ""}
            {deferredQuery ? ` · “${query.trim()}”` : ""}
            {enableDragReorder && filterActive
              ? " · clear filter to drag-reorder"
              : enableDragReorder
                ? " · drag rows to reorder"
                : ""}
          </p>
        </div>
      </div>

      <div className={`${cardCompactClass} hidden overflow-x-auto md:block`}>
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr>
              {enableDragReorder ? (
                <th className={`${denseThClass} w-8`} aria-label="Reorder" />
              ) : null}
              <th className={denseThClass}>Match</th>
              <th className={denseThClass}>Category</th>
              {showTransfer ? (
                <th className={denseThClass}>Transfer to</th>
              ) : null}
              <th className={`${denseThClass} w-20`}>Ignore</th>
              <th className={`${denseThClass} w-[13.5rem] text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rule) => {
              const formId = `rule-update-${rule.id}`;
              const isDragging = dragId === rule.id;
              const isDropTarget = dropId === rule.id && dragId !== rule.id;
              return (
                <tr
                  key={rule.id}
                  draggable={canDrag}
                  onDragStart={(e) => onDragStart(e, rule.id)}
                  onDragOver={(e) => onDragOver(e, rule.id)}
                  onDrop={(e) => onDrop(e, rule.id)}
                  onDragEnd={onDragEnd}
                  className={`hover:bg-accent-muted/25 focus-within:bg-accent-muted/30 ${
                    isDragging ? "opacity-50" : ""
                  } ${
                    isDropTarget
                      ? "outline outline-2 outline-offset-[-2px] outline-[var(--accent)]"
                      : ""
                  }`}
                >
                  {enableDragReorder ? (
                    <td className={`${denseTdClass} w-8 text-center`}>
                      <span
                        className={`select-none text-fg-subtle ${
                          canDrag ? "cursor-grab active:cursor-grabbing" : "opacity-40"
                        }`}
                        title={
                          canDrag
                            ? "Drag to reorder"
                            : "Clear filters to drag-reorder"
                        }
                        aria-hidden
                      >
                        ⋮⋮
                      </span>
                    </td>
                  ) : null}
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
                  {orderedRules.length === 0
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
            {orderedRules.length === 0
              ? "No rules yet."
              : "No rules match this filter."}
          </li>
        )}
      </ul>
    </div>
  );
}
