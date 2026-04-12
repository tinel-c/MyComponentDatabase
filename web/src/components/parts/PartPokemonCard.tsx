"use client";

/**
 * Part cards for the Parts grid (Cards view).
 * Specification: `PART_CARD_RULES.md` in this directory.
 *
 * Layout (top → bottom, matching Artwork/Part_card_artwork.png):
 *   1. Accent header band  — entry code + subtitle
 *   2. Illustration panel  — blueprint grid + component image
 *   3. 3-column meta strip — Part Name | Stock Status | Classification
 *   4. Description box     — white, flex-1
 *   5. Spec grid 2×2       — MPN | Manufacturer / Location | SKU
 *   6. Footer              — copyright + QR code + DB ID
 *
 * Color model: the card is always "light / physical card" style (readable as a
 * printed datasheet) regardless of the active UI theme.  Only the accent
 * color (card border, header band, icon tint, hover glow) comes from the
 * current theme via CSS variable var(--accent) so every theme gets its own
 * card accent:
 *   Midnight Zinc → emerald    Nebula → violet
 *   Aurora        → cyan       Carbon → blue    Light → violet
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

export type PartCardModel = {
  /** Stable list key (cuid) */
  id: string;
  partNumber: number;
  name: string;
  quantityOnHand: number;
  unit: string;
  reorderMin: number | null;
  locationLabel: string | null;
  imageUrl: string | null;
  lowStock: boolean;
  categoryName: string | null;
  descriptionPreview: string;
  mpn: string | null;
  manufacturer: string | null;
  internalSku: string | null;
};

type PartPokemonCardProps = {
  part: PartCardModel;
  /** Absolute URL encoded in the QR code */
  absolutePartUrl: string;
};

/* ─── Card palette (light physical-card style) ──────────────────────────── */
const CARD = {
  /** Medium gray card mat / outer shell */
  shell: "bg-zinc-200",
  /** Accent-colored strip headers — theme color as background */
  darkStrip: "",
  /** Theme-tinted value wells — pale accent tint, always light (see --card-well in globals.css) */
  valueWell: "",
  /** Pure white description area */
  descWell: "bg-white",
  /** Heavy dark inner borders — blueprint style */
  border: "border-2 border-zinc-800",
  /** Thinner inner separator */
  borderThin: "border border-zinc-700",
  /** White blueprint grid background (illustration viewport) */
  illustBg: "#ffffff",
  /** Blueprint grid line color */
  gridLine: "rgba(0,0,0,0.07)",
} as const;

/* ─── Layout tokens (single source of truth — update PART_CARD_RULES.md too) */
/** Total card height — all cards equal (PART_CARD_RULES.md §1) */
const CARD_HEIGHT = "h-[52rem]";
/** Part name strip (directly below header band) */
const PART_NAME_H = "h-[3.25rem]";
/** Blueprint illustration image viewport */
const ILLUSTRATION_H = "h-[7.5rem]";
/** 2-column meta strip total height */
const META_H = "h-[5.5rem]";
/** Meta strip label header row */
const META_HDR_H = "h-7";
/** Spec cell label header row */
const SPEC_HDR_H = "h-7";
/** Spec cell value body */
const SPEC_BODY_H = "h-[3.25rem]";
/** Watermark icon size — small square, same in every value well */
const WATERMARK_BOX = "size-5";
/** Equal inset from bottom and right — same distance on both edges */
const WATERMARK_INSET = "bottom-1 right-1";

/* ─── Typography ─────────────────────────────────────────────────────────── */
const HDR = {
  /** Strip section labels — on accent-colored strips */
  onDark:
    "text-[8px] font-bold uppercase tracking-[0.10em] leading-none",
  /** Labels on light / white panels */
  onLight:
    "text-[8px] font-semibold uppercase tracking-[0.07em] text-zinc-600",
  /** Single-line header row */
  stripH: "flex h-8 shrink-0 items-center px-2 sm:px-3",
} as const;

const BODY = {
  value: "text-zinc-900",
  prose: "text-zinc-700 antialiased leading-[1.6] [text-wrap:pretty]",
} as const;

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function formatEntryCode(n: number) {
  return `C-${String(n).padStart(3, "0")}`;
}

/* ─── Watermark / icon SVGs (monochrome, currentColor) ──────────────────── */
function IconWarehouse({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20V10l8-6 8 6v10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconPcb({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" className="opacity-20" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" className="opacity-50" />
      <circle cx="15" cy="15" r="1.5" fill="currentColor" className="opacity-50" />
      <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.2" className="opacity-70" />
    </svg>
  );
}
function IconBolt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M13 2L4 14h7l-1 8 10-14h-7l0-6z" fill="currentColor" className="opacity-30" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    </svg>
  );
}
function IconFactory({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20h16M6 20V11l3-1.5V11l3-1.5V11l3-1.5V20" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 15h1.5M13.5 15H15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={0.8} />
    </svg>
  );
}
function IconBoxWrench({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="10" width="10" height="8" rx="1" fill="currentColor" className="opacity-25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14 14l7-7M18 7h3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12l9-9h6v6l-9 9-6-6z" fill="currentColor" className="opacity-20" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="14.5" cy="9.5" r="1.2" fill="currentColor" className="opacity-60" />
    </svg>
  );
}

/* ─── Card component ─────────────────────────────────────────────────────── */
export function PartPokemonCard({ part, absolutePartUrl }: PartPokemonCardProps) {
  const href = `/parts/${part.id}`;
  const entry = formatEntryCode(part.partNumber);
  const typeLine = part.categoryName?.trim() || "—";
  const qtyLine =
    part.reorderMin != null
      ? `${part.quantityOnHand} ${part.unit} · min ${part.reorderMin}`
      : `${part.quantityOnHand} ${part.unit}`;

  const mpn = part.mpn?.trim() || "—";
  const mfr = part.manufacturer?.trim() || "—";
  const loc = part.locationLabel?.trim() || "—";
  const sku = part.internalSku?.trim() || "—";

  const uniqueId = `${entry}-${part.id.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 20)}`;

  return (
    <Link
      href={href}
      className="group flex h-full min-h-0 w-full min-w-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      style={{ "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
    >
      <article
        className={`group/card flex ${CARD_HEIGHT} w-full min-w-0 min-h-0 flex-col overflow-hidden rounded-2xl border-[3px] ${CARD.shell} p-2 font-sans text-zinc-900 shadow-[0_6px_24px_-8px_rgba(0,0,0,0.22)] transition-all duration-200`}
        style={{ borderColor: "#4b4b4b" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow =
            `0 12px 36px -8px var(--glow-accent), 0 0 0 1px #6b6b6b`;
          (e.currentTarget as HTMLElement).style.borderColor = "#6b6b6b";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 6px 24px -8px rgba(0,0,0,0.22)";
          (e.currentTarget as HTMLElement).style.borderColor = "#4b4b4b";
        }}
      >
        {/* ── 1. Header band ─────────────────────────────────────────── */}
        <header
          className="relative shrink-0 overflow-hidden rounded-t-[10px] px-3 py-2.5"
          style={{
            background: "#111111",
            borderBottom: "2px solid color-mix(in oklch, var(--accent) 40%, #000)",
          }}
        >
          {/* Subtle accent glow across the top edge */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }}
            aria-hidden
          />
          <p
            className="truncate text-[8px] font-bold uppercase tracking-[0.13em] leading-none"
            style={{ color: "var(--accent)", opacity: 0.9 }}
          >
            Component database entry
          </p>
          <p
            className="mt-1 font-mono text-xl font-black tabular-nums leading-none tracking-tight"
            style={{ color: "#ffffff" }}
          >
            {entry}
          </p>
        </header>

        {/* ── 2. Part name strip ──────────────────────────────────────── */}
        <div
          className={`flex ${PART_NAME_H} shrink-0 flex-col justify-center border-b-2 border-zinc-300 bg-white px-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)]`}
        >
          <p className="text-[8px] font-bold uppercase tracking-[0.10em] text-zinc-500">
            Part name
          </p>
          <p className="mt-0.5 line-clamp-2 text-[12px] font-black leading-tight tracking-tight text-zinc-900 sm:text-[13px]">
            {part.name}
          </p>
        </div>

        {/* ── 3. Illustration panel ───────────────────────────────────── */}
        <div className={`relative mt-2 shrink-0 overflow-hidden rounded-xl ${CARD.border}`}>
          {/* Strip header */}
          <div
            className={`flex ${HDR.stripH} items-center ${CARD.darkStrip}`}
            style={{ background: "var(--card-accent)", color: "var(--accent-fg)" }}
          >
            <p className={HDR.onDark}>Component illustration</p>
          </div>
          {/* Viewport */}
          <div
            className={`relative flex ${ILLUSTRATION_H} w-full items-center justify-center overflow-hidden`}
            style={{
              background: CARD.illustBg,
              backgroundImage: `
                linear-gradient(${CARD.gridLine} 1px, transparent 1px),
                linear-gradient(90deg, ${CARD.gridLine} 1px, transparent 1px)
              `,
              backgroundSize: "10px 10px",
            }}
          >
            {part.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={part.imageUrl}
                alt=""
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 opacity-40">
                <span className="text-4xl" style={{ color: "var(--accent)" }} aria-hidden>⚙</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
                  No photo
                </span>
              </div>
            )}
            {part.lowStock ? (
              <span className="absolute left-2 top-2 rounded border border-amber-600 bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900 shadow-sm">
                Low stock
              </span>
            ) : null}
          </div>
        </div>

        {/* ── 4. Meta strip — 2 columns: Stock Status | Classification ── */}
        <div className={`mt-2 ${META_H} grid shrink-0 grid-cols-2 gap-1.5`}>
          <MetaCol
            label="Stock Status"
            icon={<IconWarehouse className="h-full w-full" />}
            value={qtyLine}
          />
          <MetaCol
            label="Classification"
            icon={<IconPcb className="h-full w-full" />}
            value={typeLine}
          />
        </div>

        {/* ── 5. Description ──────────────────────────────────────────── */}
        <div
          className={`mt-2 flex min-h-[7rem] min-w-0 flex-1 flex-col overflow-hidden rounded-xl ${CARD.border}`}
        >
          <div
            className={`shrink-0 ${CARD.darkStrip} ${HDR.stripH}`}
            style={{ background: "var(--card-accent)", color: "var(--accent-fg)" }}
          >
            <p className={HDR.onDark}>Description</p>
          </div>
          <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${CARD.descWell} px-3 py-3`}>
            <p
              className={`line-clamp-[14] w-full min-w-0 break-words text-[11px] sm:text-[12px] ${BODY.prose}`}
            >
              {part.descriptionPreview}
            </p>
          </div>
        </div>

        {/* ── 6. Spec grid 2×2 ────────────────────────────────────────── */}
        <div className="mt-2 grid shrink-0 grid-cols-2 gap-1.5">
          <SpecCell icon={<IconBolt className="h-full w-full" />} label="MPN" value={mpn} />
          <SpecCell icon={<IconFactory className="h-full w-full" />} label="Manufacturer" value={mfr} />
          <SpecCell icon={<IconBoxWrench className="h-full w-full" />} label="Warehouse loc." value={loc} />
          <SpecCell icon={<IconTag className="h-full w-full" />} label="SKU" value={sku} />
        </div>

        {/* ── 7. Footer ───────────────────────────────────────────────── */}
        <footer
          className="mt-2 flex shrink-0 items-end justify-between gap-2 border-t-2 border-zinc-700/50 pt-2"
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-[10px] font-medium leading-snug text-zinc-600 sm:text-[11px]">
              ©2026 Hobby Warehouse
            </p>
            <p className="text-[9px] leading-snug text-zinc-500 sm:text-[10px]">
              Unique database ID:
            </p>
            <p className="break-all font-mono text-[9px] leading-snug text-zinc-700 sm:text-[10px]">
              {uniqueId}
            </p>
          </div>
          <div
            className="shrink-0 rounded-lg border-2 border-zinc-800 bg-white p-1 shadow-sm"
            title="Scan to open this part"
          >
            <QRCodeSVG value={absolutePartUrl} size={44} level="M" includeMargin={false} className="block" />
          </div>
        </footer>

        <p
          className="mt-2 shrink-0 text-center text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--accent)", opacity: 0.85 }}
        >
          Tap card to open details
        </p>
      </article>
    </Link>
  );
}

/* ─── MetaCol — 3-column meta strip ─────────────────────────────────────── */
function MetaCol({
  label,
  icon,
  value,
}: {
  label: string;
  icon: ReactNode;
  value: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col overflow-hidden rounded-lg ${CARD.border}`}>
      {/* Accent label strip */}
      <div
        className={`flex ${META_HDR_H} shrink-0 items-center justify-center px-1 ${CARD.darkStrip}`}
        style={{ background: "var(--card-accent)", color: "var(--accent-fg)" }}
      >
        <span className={`block w-full truncate text-center ${HDR.onDark}`}>
          {label}
        </span>
      </div>
      {/* Theme-tinted value well */}
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-t-2 border-zinc-800 px-2 py-1.5"
        style={{ background: "var(--card-well)" }}
      >
        {/* Watermark icon — bottom-right, dark neutral */}
        <div
          className={`pointer-events-none absolute ${WATERMARK_INSET} z-0 flex ${WATERMARK_BOX} items-center justify-center opacity-40`}
          style={{ color: "#1e293b" }}
          aria-hidden
        >
          {icon}
        </div>
        <p
          className={`relative z-[1] line-clamp-3 min-w-0 w-full break-words pr-[28%] text-[10px] font-bold leading-tight sm:text-[11px] ${BODY.value}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/* ─── SpecCell — 2×2 spec grid ──────────────────────────────────────────── */
function SpecCell({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className={`flex shrink-0 flex-col overflow-hidden rounded-lg ${CARD.border}`}>
      {/* Accent label strip */}
      <div
        className={`flex ${SPEC_HDR_H} shrink-0 items-center justify-center px-1 ${CARD.darkStrip}`}
        style={{ background: "var(--card-accent)", color: "var(--accent-fg)" }}
      >
        <span className={`block max-w-full truncate text-center ${HDR.onDark}`}>
          {label}
        </span>
      </div>
      {/* Theme-tinted value well */}
      <div
        className={`relative flex ${SPEC_BODY_H} shrink-0 flex-col overflow-hidden border-t-2 border-zinc-800 px-2 py-1.5`}
        style={{ background: "var(--card-well)" }}
      >
        {/* Watermark icon — bottom-right, dark neutral */}
        <div
          className={`pointer-events-none absolute ${WATERMARK_INSET} z-0 flex ${WATERMARK_BOX} items-center justify-center opacity-40`}
          style={{ color: "#1e293b" }}
          aria-hidden
        >
          {icon}
        </div>
        <p
          className={`relative z-[1] line-clamp-3 min-w-0 w-full break-words pr-[28%] text-[10px] font-bold leading-tight sm:text-[11px] ${BODY.value}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
