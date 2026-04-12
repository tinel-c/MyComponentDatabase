"use client";

/**
 * Read-only parts table — compact row layout that mirrors the card visual style.
 * Uses the same palette tokens (--card-accent, --card-well, --accent) so it
 * stays theme-reactive just like the Pokemon cards.
 *
 * No editing capabilities — every row links to the part detail page.
 */

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { PartCardModel } from "./PartPokemonCard";

/* ─── Shared visual constants (mirrors PartPokemonCard) ──────────────────── */
const THUMB_BORDER = "border-2 border-zinc-800";
const HDR_TEXT = "text-[9px] font-bold uppercase tracking-[0.10em] leading-none";
const GRID_LINE = "rgba(0,0,0,0.07)";

function formatEntryCode(n: number) {
  return `C-${String(n).padStart(3, "0")}`;
}

/* ─── Blueprint thumbnail (mirrors the illustration panel) ───────────────── */
function BlueprintThumb({ imageUrl }: { imageUrl: string | null }) {
  return (
    <div
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg ${THUMB_BORDER}`}
      style={{
        background: "#ffffff",
        backgroundImage: `
          linear-gradient(${GRID_LINE} 1px, transparent 1px),
          linear-gradient(90deg, ${GRID_LINE} 1px, transparent 1px)
        `,
        backgroundSize: "8px 8px",
      }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-contain p-0.5" />
      ) : (
        <span
          className="text-lg leading-none opacity-30"
          style={{ color: "var(--accent)" }}
          aria-hidden
        >
          ⚙
        </span>
      )}
    </div>
  );
}


/* ─── Simple label + value stack ────────────────────────────────────────── */
function DataCell({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className={`${HDR_TEXT} text-zinc-500 mb-0.5`}>{label}</p>
      <p className="truncate text-[11px] font-bold text-zinc-900 leading-tight">{value}</p>
      {sub && <p className="truncate text-[10px] text-zinc-500 leading-tight">{sub}</p>}
    </div>
  );
}

/* ─── Sort types ─────────────────────────────────────────────────────────── */
type SortKey = "entry" | "name" | "stock" | "category" | "mpn" | "location";
type SortDir = "asc" | "desc";

function sortParts(parts: PartCardModel[], key: SortKey, dir: SortDir): PartCardModel[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...parts].sort((a, b) => {
    let av: string | number;
    let bv: string | number;
    switch (key) {
      case "entry":    av = a.partNumber;            bv = b.partNumber;            break;
      case "name":     av = a.name.toLowerCase();    bv = b.name.toLowerCase();    break;
      case "stock":    av = a.quantityOnHand;        bv = b.quantityOnHand;        break;
      case "category": av = (a.categoryName ?? "").toLowerCase(); bv = (b.categoryName ?? "").toLowerCase(); break;
      case "mpn":      av = (a.mpn ?? "").toLowerCase();          bv = (b.mpn ?? "").toLowerCase();          break;
      case "location": av = (a.locationLabel ?? "").toLowerCase(); bv = (b.locationLabel ?? "").toLowerCase(); break;
    }
    if (av < bv) return -1 * mul;
    if (av > bv) return  1 * mul;
    return 0;
  });
}

/* ─── Sort indicator arrow ───────────────────────────────────────────────── */
function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-0.5 opacity-30">↕</span>;
  return <span className="ml-0.5">{dir === "asc" ? "↑" : "↓"}</span>;
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export type PartsReadOnlyTableProps = {
  parts: PartCardModel[];
  emptyMessage: string;
};

export function PartsReadOnlyTable({ parts, emptyMessage }: PartsReadOnlyTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("entry");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => sortParts(parts, sortKey, sortDir), [parts, sortKey, sortDir]);

  if (parts.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border-[3px] bg-zinc-200 py-16 text-sm text-zinc-500"
        style={{ borderColor: "#4b4b4b" }}
      >
        {emptyMessage}
      </div>
    );
  }

  const hdr = (label: string, key: SortKey, extraClass = "") => (
    <button
      type="button"
      onClick={() => handleSort(key)}
      className={`flex items-center gap-0 select-none cursor-pointer transition-opacity hover:opacity-100 ${sortKey === key ? "opacity-100" : "opacity-75"} ${HDR_TEXT} ${extraClass}`}
      style={{ color: "var(--accent)" }}
    >
      {label}
      <SortArrow active={sortKey === key} dir={sortDir} />
    </button>
  );

  return (
    <div
      className="overflow-hidden rounded-2xl border-[3px] bg-zinc-200 shadow-[0_6px_24px_-8px_rgba(0,0,0,0.22)]"
      style={{ borderColor: "#4b4b4b" }}
    >
      {/* Column header band — dark with accent text */}
      <div
        className="hidden sm:grid sm:grid-cols-[3.5rem_5rem_1fr_9rem_9rem_9rem_9rem] items-center gap-x-2 px-3 py-1.5"
        style={{ background: "#111111", borderBottom: "2px solid color-mix(in oklch, var(--accent) 40%, #000)" }}
      >
        {/* Subtle accent glow line at the very top */}
        <div
          className="col-span-full -mt-1.5 h-px pointer-events-none mb-1"
          style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }}
          aria-hidden
        />
        <p className={`${HDR_TEXT} opacity-40`} style={{ color: "var(--accent)" }}>Photo</p>
        {hdr("Entry",     "entry")}
        {hdr("Part name", "name")}
        {hdr("Stock",     "stock")}
        {hdr("Category",  "category")}
        {hdr("MPN / Mfr", "mpn",      "hidden lg:flex")}
        {hdr("Loc / SKU", "location", "hidden xl:flex")}
      </div>

      {/* Rows */}
      <div className="divide-y-2 divide-zinc-300">
        {sorted.map((part, i) => {
          const entry = formatEntryCode(part.partNumber);
          const qtyLine =
            part.reorderMin != null
              ? `${part.quantityOnHand} ${part.unit} · min ${part.reorderMin}`
              : `${part.quantityOnHand} ${part.unit}`;
          const mpn = part.mpn?.trim() || "—";
          const mfr = part.manufacturer?.trim() || "—";
          const loc = part.locationLabel?.trim() || "—";
          const sku = part.internalSku?.trim() || "—";
          const cat = part.categoryName?.trim() || "—";

          return (
            <Link
              key={part.id}
              href={`/parts/${part.id}`}
              className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-offset-0"
              style={{ "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
            >
              <div
                className="grid grid-cols-[3.5rem_1fr] sm:grid-cols-[3.5rem_5rem_1fr_9rem_9rem_9rem_9rem] items-center gap-x-2 gap-y-2 px-3 py-2 transition-colors duration-150"
                style={{
                  background: i % 2 === 0 ? "#ffffff" : "var(--card-well)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "color-mix(in oklch, var(--card-well) 60%, #e5e7eb)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "#ffffff" : "var(--card-well)";
                }}
              >
                {/* Thumbnail */}
                <div className="flex items-center justify-center">
                  <BlueprintThumb imageUrl={part.imageUrl} />
                </div>

                {/* Entry code pill */}
                <div className="flex items-center sm:justify-start">
                  <div
                    className="inline-block rounded px-1.5 py-0.5 font-mono text-[11px] font-black leading-none"
                    style={{ background: "#111111", color: "var(--accent)" }}
                  >
                    {entry}
                  </div>
                </div>

                {/* Part name + low-stock badge */}
                <div className="col-span-2 sm:col-span-1 min-w-0">
                  <p className="truncate text-[13px] font-black leading-tight tracking-tight text-zinc-900 group-hover:underline decoration-1 underline-offset-2">
                    {part.name}
                  </p>
                  {part.lowStock && (
                    <span className="mt-0.5 inline-block rounded border border-amber-600 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900">
                      Low stock
                    </span>
                  )}
                </div>

                {/* Stock */}
                <DataCell label="Stock" value={qtyLine} />

                {/* Category */}
                <DataCell label="Category" value={cat} className="hidden sm:block" />

                {/* MPN / Manufacturer */}
                <DataCell label="MPN / Mfr" value={mpn} sub={mfr} className="hidden lg:block" />

                {/* Location / SKU */}
                <DataCell label="Loc / SKU" value={loc} sub={sku} className="hidden xl:block" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer strip */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-t-2 border-zinc-700/50"
        style={{ background: "#111111" }}
      >
        <p
          className="text-[9px] font-semibold uppercase tracking-[0.10em]"
          style={{ color: "var(--accent)", opacity: 0.75 }}
        >
          Component database · {sorted.length} {sorted.length === 1 ? "entry" : "entries"}
        </p>
        <p className="font-mono text-[9px] text-zinc-600">©2026 Hobby Warehouse</p>
      </div>
    </div>
  );
}
