"use client";

import { inputClass, labelClass } from "@/components/forms/field-classes";
import {
  hasActiveFilters,
  parsePartsFiltersFromSearchParams,
  partsFiltersToSearchParams,
  type PartsFilterState,
} from "@/lib/parts-filters";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

type Opt = { id: string; name: string };

export function PartsFiltersSidebar({
  categories,
  locations,
  manufacturers,
  units,
}: {
  categories: Opt[];
  locations: Opt[];
  manufacturers: string[];
  units: string[];
}) {
  const router = useRouter();
  const raw = useSearchParams();
  const [pending, startTransition] = useTransition();

  const f = useMemo(() => {
    const o: Record<string, string> = {};
    raw.forEach((v, k) => {
      o[k] = v;
    });
    return parsePartsFiltersFromSearchParams(o);
  }, [raw]);

  const push = useCallback(
    (next: PartsFilterState) => {
      const qs = partsFiltersToSearchParams(next).toString();
      startTransition(() => {
        router.push(qs ? `/parts?${qs}` : "/parts");
      });
    },
    [router],
  );

  const toggleId = (list: string[], id: string, checked: boolean) => {
    const set = new Set(list);
    if (checked) set.add(id);
    else set.delete(id);
    return [...set];
  };

  const active = hasActiveFilters(f);

  return (
    <aside className="space-y-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 shadow-sm shadow-black/20 lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-50">Filters</h2>
        {active ? (
          <button
            type="button"
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:underline"
            disabled={pending}
            onClick={() =>
              push({
                ...f,
                categoryIds: [],
                locationIds: [],
                manufacturer: null,
                unit: null,
                hasImage: false,
                lowOnly: false,
                qtyMin: null,
                qtyMax: null,
                pnMin: null,
                pnMax: null,
              })
            }
          >
            Clear filters
          </button>
        ) : null}
      </div>
      {active ? (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Narrow the list by category, location, stock, and other fields.
        </p>
      ) : null}

      {categories.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className={labelClass}>Category</legend>
          <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {categories.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  className="rounded border-zinc-600 text-zinc-500 focus:ring-zinc-500"
                  checked={f.categoryIds.includes(c.id)}
                  disabled={pending}
                  onChange={(e) =>
                    push({
                      ...f,
                      categoryIds: toggleId(f.categoryIds, c.id, e.target.checked),
                    })
                  }
                />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {locations.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className={labelClass}>Location</legend>
          <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {locations.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  className="rounded border-zinc-600 text-zinc-500 focus:ring-zinc-500"
                  checked={f.locationIds.includes(c.id)}
                  disabled={pending}
                  onChange={(e) =>
                    push({
                      ...f,
                      locationIds: toggleId(f.locationIds, c.id, e.target.checked),
                    })
                  }
                />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {manufacturers.length > 0 ? (
        <div>
          <label htmlFor="filter-mfg" className={labelClass}>
            Manufacturer
          </label>
          <select
            id="filter-mfg"
            className={inputClass}
            value={f.manufacturer ?? ""}
            disabled={pending}
            onChange={(e) =>
              push({
                ...f,
                manufacturer: e.target.value || null,
              })
            }
          >
            <option value="">Any</option>
            {manufacturers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {units.length > 0 ? (
        <div>
          <label htmlFor="filter-unit" className={labelClass}>
            Unit
          </label>
          <select
            id="filter-unit"
            className={inputClass}
            value={f.unit ?? ""}
            disabled={pending}
            onChange={(e) =>
              push({
                ...f,
                unit: e.target.value || null,
              })
            }
          >
            <option value="">Any</option>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <fieldset className="space-y-2">
        <legend className={labelClass}>Flags</legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            className="rounded border-zinc-600 text-zinc-500 focus:ring-zinc-500"
            checked={f.hasImage}
            disabled={pending}
            onChange={(e) => push({ ...f, hasImage: e.target.checked })}
          />
          Has image URL
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            className="rounded border-zinc-600 text-zinc-500 focus:ring-zinc-500"
            checked={f.lowOnly}
            disabled={pending}
            onChange={(e) => push({ ...f, lowOnly: e.target.checked })}
          />
          Low stock only
        </label>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="filter-qty-min" className={labelClass}>
            Qty min
          </label>
          <input
            id="filter-qty-min"
            type="number"
            min={0}
            className={inputClass}
            placeholder="—"
            value={f.qtyMin ?? ""}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              push({
                ...f,
                qtyMin: v === "" ? null : Number.parseInt(v, 10) || null,
              });
            }}
          />
        </div>
        <div>
          <label htmlFor="filter-qty-max" className={labelClass}>
            Qty max
          </label>
          <input
            id="filter-qty-max"
            type="number"
            min={0}
            className={inputClass}
            placeholder="—"
            value={f.qtyMax ?? ""}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              push({
                ...f,
                qtyMax: v === "" ? null : Number.parseInt(v, 10) || null,
              });
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="filter-pn-min" className={labelClass}>
            Part # min
          </label>
          <input
            id="filter-pn-min"
            type="number"
            min={1}
            className={inputClass}
            placeholder="—"
            value={f.pnMin ?? ""}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              push({
                ...f,
                pnMin: v === "" ? null : Number.parseInt(v, 10) || null,
              });
            }}
          />
        </div>
        <div>
          <label htmlFor="filter-pn-max" className={labelClass}>
            Part # max
          </label>
          <input
            id="filter-pn-max"
            type="number"
            min={1}
            className={inputClass}
            placeholder="—"
            value={f.pnMax ?? ""}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              push({
                ...f,
                pnMax: v === "" ? null : Number.parseInt(v, 10) || null,
              });
            }}
          />
        </div>
      </div>

      {pending ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Updating…</p>
      ) : null}
    </aside>
  );
}
