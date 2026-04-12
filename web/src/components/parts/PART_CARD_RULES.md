# Part card (Parts grid) — specification

This document defines the **Hobby Warehouse** part cards shown on the dashboard **Parts** page in **Cards** view.  
**Any change** to `PartPokemonCard`, `PartsPokemonGrid`, `part-card-preview.ts`, or the card model mapping on `parts/page.tsx` must stay consistent with these rules.

---

## 0. Reference artwork

Visual reference: `Artwork/Part_card_artwork.png` — industrial datasheet / trading-card layout with:
- Bold **accent-colored header band** (yellow in artwork → theme `--accent` in code)
- **Part name strip** immediately below the header (white, bold name text)
- **Blueprint grid illustration** area (warm cream `#fef9e7`, 10px grid)
- **2-column meta strip** (Stock Status | Classification) — dark label strips + amber value wells
- **White description block**
- **2×2 spec grid** with the same dark/amber cell pattern
- **Footer** with copyright + QR code + unique DB ID

---

## 1. Equal card size and text (required)

- Every card uses the **same outer height** (`CARD_HEIGHT`, currently **`h-[52rem]`**).
- Inner cells use **fixed heights** so the 3-column meta and 2×2 spec cells **align across the grid** (`META_H`, `SPEC_HDR_H`, `SPEC_BODY_H`, `ILLUSTRATION_H`).
- All text uses **`line-clamp`** where needed; the description block uses **`flex-1`** so it grows to fill remaining space.
- **Grid:** `items-stretch`; link/cell wrappers use `h-full`.
- Icons in meta/spec cells: `ICON_BOX` (`h-5 w-5`), left-aligned in the value well, tinted with `var(--accent)` at 50–55% opacity.

---

## 2. Branding and copy (required)

- **Footer copyright:** `©2026 Hobby Warehouse`.
- **Illustration strip header:** `Component illustration` label only + category name (right-aligned) — no Hobby Shop logo.
- **Subtitle under entry code:** `Part catalog · warehouse inventory` (in header band).
- **Part name strip:** sits between the header band and the illustration; uses `bg-white`, `PART_NAME_H`; label `Part name` in 8px bold uppercase + value in 12–13px black bold, `line-clamp-2`.

---

## 3. Color model — light physical-card aesthetic

Cards are **always light-toned** (readable as printed datasheets) regardless of the UI theme.

| Area | Class / Value |
|---|---|
| Outer card mat | `bg-zinc-200` |
| Card border | inline `borderColor: var(--accent)` (3px) — changes with theme |
| Dark label strips | `bg-zinc-900 text-white` |
| Amber value wells (meta + spec) | `bg-amber-50` |
| Description area | `bg-white` |
| Blueprint grid bg | `#fef9e7` (warm cream) |
| Header band | gradient `var(--accent)` → `var(--accent-hover)` |
| Header text | `var(--accent-fg)` |
| Icon tint | `var(--accent)` at 50–55% opacity |
| Hover box-shadow | `var(--glow-accent)` |
| Footer hint text | `var(--accent)` |

Theme accent per theme:
`midnight-zinc` → emerald · `nebula` → violet · `aurora` → cyan · `carbon` → blue · `light` → violet

---

## 4. Header band

- Background: gradient `from var(--accent) to var(--accent-hover)` at 135°.
- Bottom border: `color-mix(in oklch, var(--accent) 55%, black)` 2px.
- Top hairline: white/50 gradient for depth.
- **Line 1** (8px, bold, uppercase, tracking-[0.13em], opacity 82%): `Component database entry`
- **Line 2** (20px, monospace, black/900, tabular-nums, `drop-shadow`): `C-XXX` (entry code)
- **Line 3** (8px, semibold, uppercase, tracking-[0.10em], opacity 75%): `Part catalog · warehouse inventory`
- All text: `var(--accent-fg)`.

---

## 5. Illustration panel

- Outer container: `rounded-xl border-2 border-zinc-800` (blueprint border).
- **Strip header** (`h-8 bg-zinc-900`): `Component illustration` on left + category name on right (if available), both 8px uppercase white.
- **Viewport** (`ILLUSTRATION_H = h-[7.5rem]`): warm cream `#fef9e7` background + 10px grid lines at `rgba(0,0,0,0.07)`.
- Image: `object-contain p-2`; placeholder: gear icon in accent color + "No photo" label.
- **Low stock** badge: top-left overlay, `bg-amber-100 border-amber-600 text-amber-900`, 9px bold uppercase.

---

## 6. 2-column meta strip

Columns (left → right): **Stock Status** | **Classification**

- Container: `grid grid-cols-2 gap-1.5 h-[5.5rem]` (`META_H`).
- Each `MetaCol`:
  - **Label header** (`META_HDR_H = h-7`, `bg-zinc-900`, white bold 8px uppercase tracking-[0.10em], centered, `truncate`).
  - **Value well** (`bg-amber-50`, `border-t-2 border-zinc-800`, flex-1):
    - **Icon** (`ICON_BOX = h-5 w-5`, left side, `var(--accent)` tinted, `opacity-55`) — monochrome SVG.
    - **Value** (10–11px, `font-bold`, `text-zinc-900`, `line-clamp-3`, `break-words`).

---

## 7. Description block

- Container: `min-h-[7rem] flex-1` so it **never collapses**.
- **Header strip** (`h-8 bg-zinc-900`): `Description` label (8px bold uppercase white).
- **Body** (`bg-white`, `px-3 py-3`): paragraph `text-[11px] sm:text-[12px] leading-[1.6] text-zinc-700`, `line-clamp-[14]`.

---

## 8. Spec grid 2×2

Fields: **MPN** | **Manufacturer** / **Warehouse loc.** | **SKU**; missing values show `—`.

Each `SpecCell`:
- **Label header** (`SPEC_HDR_H = h-7`, `bg-zinc-900`, same as MetaCol label header).
- **Body** (`SPEC_BODY_H = h-[3.25rem]`, `bg-amber-50`, `border-t-2 border-zinc-800`):
  - **Icon** (`ICON_BOX`, left side, `var(--accent)` tinted, `opacity-50`).
  - **Value** (10–11px, `font-bold`, `text-zinc-900`, `line-clamp-3`, `break-words`).

---

## 9. Footer

- Left: copyright line → `Unique database ID:` label → ID value (monospace, `break-all`), derived from entry code + part id fragment.
- Right: **QR code** (44px) in `bg-white border-2 border-zinc-800` container.
- Divider: `border-t-2 border-zinc-700/50`.
- Hint line below footer: `Tap card to open details` — `var(--accent)` color, 10px, bold uppercase.

---

## 10. Layout tokens (single source in `PartPokemonCard.tsx`)

| Token | Current value | Role |
|---|---|---|
| `CARD_HEIGHT` | `h-[52rem]` | Total card height — all cards equal |
| `PART_NAME_H` | `h-[3.25rem]` | Part name strip (below header band) |
| `ILLUSTRATION_H` | `h-[7.5rem]` | Illustration viewport height |
| `META_H` | `h-[5.5rem]` | 2-column meta strip total height |
| `META_HDR_H` | `h-7` | Meta label header row height |
| `SPEC_HDR_H` | `h-7` | Spec label header row height |
| `SPEC_BODY_H` | `h-[3.25rem]` | Spec value body height |
| `ICON_BOX` | `h-5 w-5 shrink-0` | Icon badge size in meta/spec cells |
| `CARD` | object | Full palette — shell, darkStrip, valueWell, descWell, border, illustBg, gridLine |
| `HDR` | object | Typography styles — onDark, onLight, stripH |
| `BODY` | object | value, prose styles |

**When changing any of these, update this document in the same commit.**

---

## 11. Data model (`PartCardModel`)

Fields: `id`, `partNumber`, `name`, `quantityOnHand`, `unit`, `reorderMin`, `locationLabel`, `imageUrl`, `lowStock`, `categoryName`, `descriptionPreview`, `mpn`, `manufacturer`, `internalSku`.

- Card mapping lives on the server (`parts/page.tsx`).
- Description preview generation: `part-card-preview.ts`.

---

## 12. Adding a new theme

When a new theme is added to `web/src/lib/themes.ts` and `globals.css`, cards automatically inherit the accent color — no changes needed to `PartPokemonCard.tsx`. The card border, header band, icon tint, hover glow, and hint text all respond to `var(--accent)` and related variables.
