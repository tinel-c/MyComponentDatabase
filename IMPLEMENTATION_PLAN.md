# Hobby Warehouse — Parts & Components Tracker

This document is the **initial project charter**: researched feature ideas, proposed technology, and **implementation phases** for a web application that registers and tracks parts and components in a hobby warehouse (electronics, mechanical fasteners, filament, tools, etc.).

---

## 1. Research summary — features worth integrating

Industry and open-source tools (e.g. [InvenTree](https://inventree.org/), [Part-DB](https://docs.part-db.de/)) and commercial workshop inventory products converge on a similar set of high-value capabilities. The list below distills those into a realistic roadmap for a **focused hobbyist** product (lighter than full ERP, richer than a spreadsheet).

### 1.1 Core inventory

| Feature | Why it matters |
|--------|----------------|
| **Hierarchical categories** | Navigate resistors → SMD → 0603 without flat lists exploding. |
| **Part master record** | One logical part (MPN, description, parameters, footprint/package, manufacturer). |
| **Stock / quantity** | On-hand count, optional minimum reorder level, **low-stock alerts**. |
| **Multi-location storage** | Room → shelf → bin; parts can span bins (split stock). Finding parts physically is the #1 hobby pain. |
| **Stock movements** | Receive, consume, adjust, transfer between locations — each with timestamp and optional note. |
| **Audit trail** | Who changed what and when (reduces “mystery quantity” bugs). |

### 1.2 Identification and speed

| Feature | Why it matters |
|--------|----------------|
| **Barcodes / QR on parts and locations** | Scan to pull up a part or confirm a bin; matches patterns from [Part-DB](https://docs.part-db.de/) and commercial spare-parts systems. |
| **Label printing** | PDF or browser print for bin labels and part labels. |
| **Quick search** | By MPN, description, parameters, tags; **parametric filters** (e.g. resistance, voltage) for electronics. |

### 1.3 Sourcing and cost

| Feature | Why it matters |
|--------|----------------|
| **Suppliers and supplier part numbers** | Link the same logical part to DigiKey, LCSC, Mouser, etc. |
| **Price history / last paid** | Enough for hobby budgeting; optional **distributor API** enrichment later (datasheets, pricing — common in tools like Part-DB). |
| **Multi-currency** | Optional if ordering internationally. |

### 1.4 Projects and builds (high value for makers)

| Feature | Why it matters |
|--------|----------------|
| **Projects / builds** | A project lists required parts (BOM). |
| **BOM management** | Quantities per build; **“how many units can I build?”** from current stock. |
| **Build consumption** | Reserve or deduct stock when you finish a build (ties inventory to real usage). |

Inspired by [InvenTree](https://inventree.org/) (parts, stock items, locations, suppliers, BOM) and [Part-DB](https://www.hackaday.io/project/18803-part-db-open-source-inventory-software) (projects, BOM, KiCad-oriented workflows).

### 1.5 Files and knowledge

| Feature | Why it matters |
|--------|----------------|
| **Attachments** | Datasheets, photos, 3D STEP — stored locally or in object storage. |
| **Rich text notes** | Gotchas, substitute parts, where you bought the last reel. |

### 1.6 Collaboration and access

| Feature | Why it matters |
|--------|----------------|
| **User accounts** | Multi-user for shared maker spaces or family. |
| **Roles / permissions** | e.g. viewer vs editor vs admin. |
| **Optional API** | Scripts, future **ECAD integration** (see below). |

### 1.7 Integrations (later phases)

| Integration | Notes |
|-------------|--------|
| **REST/JSON API** | Enables automation and external tools. |
| **KiCad / ECAD HTTP library** | Part-DB-style: central library in the app, KiCad pulls symbols/footprints/metadata ([Hackaday.io — Part-DB](https://www.hackaday.io/project/18803-part-db-open-source-inventory-software)). |
| **CSV import/export** | Migration from spreadsheets; backup. |
| **Mobile-friendly UI or PWA** | Phone on the bench for lookup and scanning. |

### 1.8 Optional niches (if scope expands)

- **3D filament** (spool weight, color, brand) — analogy: [Spoolman](https://github.com/Donkie/Spoolman)-style dedicated tracking.
- **Tool / loan tracking** | Who borrowed the scope or dev board.

---

## 2. Proposed technology stack

Choices favor **one cohesive TypeScript codebase**, fast iteration, and easy deployment (VPS, home server, or cloud).

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | **Next.js** (App Router), **React**, **TypeScript** | Full-stack in one repo; API routes and server components; already scaffolded in `web/`. |
| **Styling** | **Tailwind CSS** | Consistent UI; matches current setup. |
| **Database** | **PostgreSQL** (production) / **SQLite** (local dev) via **Prisma** | Relational model fits parts, locations, movements, BOM lines; Prisma migrations and type-safe queries. |
| **Validation** | **Zod** | Shared schemas for forms and API payloads. |
| **Authentication** | **Auth.js (NextAuth v5)** or **Clerk** | Email login + optional OAuth; pick Auth.js for self-hosting without vendor lock-in. |
| **Background jobs** (optional later) | **BullMQ** + **Redis** | Distributor sync, heavy imports, thumbnail generation. |
| **File storage** | Local disk or **S3-compatible** (MinIO, Cloudflare R2) | Datasheets and images. |
| **Barcode scanning** | **html5-qrcode** or **@zxing/browser** | Camera-based scanning in the browser; no native app required for v1. |
| **Deployment** | **Docker Compose** | App + Postgres (+ optional Redis) for reproducible hobby-server installs. |
| **CI** | **GitHub Actions** | Lint, typecheck, test, build on push/PR. |

**Alternatives considered:** Django + React ([InvenTree](https://inventree.org/) style) is excellent but splits Python/JS; a single Next.js stack keeps the project smaller for one maintainer. For “database only + existing UI,” self-hosting [Part-DB](https://docs.part-db.de/) or [InvenTree](https://github.com/inventree/InvenTree) is valid — this project is a **custom, slim** alternative with full control over UX and schema.

---

## 3. Repository layout

| Path | Purpose |
|------|---------|
| `web/` | Next.js application (package name `web`; npm forbids uppercase package names at repo root — app lives here). |
| `IMPLEMENTATION_PLAN.md` | This document — plan, stack, phases. |

Future additions (as implemented): `docker-compose.yml`, `prisma/schema.prisma`, GitHub Actions under `.github/workflows/`.

---

## 4. Data model (conceptual)

High-level entities to implement in order:

1. **User** — authentication identity; links to audit log.
2. **Category** — tree (parent_id).
3. **StorageLocation** — tree (e.g. building → room → shelf → bin).
4. **Part** — master: SKU/internal id, MPN, manufacturer, description, attributes (JSON or EAV for parametric search), category, default location, reorder min, unit.
5. **PartStock** — quantity per part per location (or single row with location splits).
6. **StockMovement** — type (receive/consume/adjust/transfer), quantity, part, location, user, timestamp, reference (optional project/build).
7. **Supplier**, **SupplierPart** — supplier catalog lines linked to Part.
8. **Project**, **BomLine** — project header; lines: part, qty per unit built.
9. **Attachment** — file metadata + storage key.
10. **AuditLog** — entity, action, diff snapshot or JSON patch.

Refine during implementation; start with Part + Location + Movement.

---

## 5. Implementation phases (step-by-step)

### Phase A — Foundation (week 1–2)

1. Add **Prisma** + initial schema: `Part`, `Category`, `StorageLocation` (minimal fields).
2. Configure **PostgreSQL** via Docker for dev; document SQLite alternative for zero-setup.
3. **CRUD UI** for categories and locations (simple forms + lists).
4. **CRUD UI** for parts (create/edit/list, assign category and default location).
5. **Environment** documentation: `.env.example`, required variables.

### Phase B — Stock truth (week 2–4)

6. Model **on-hand quantity** per part/location; **stock movements** table and server actions.
7. Transactional updates: movement always updates aggregated stock.
8. **Dashboard**: low-stock list; total part count; recent movements.
9. **Audit log** for part and stock changes.

### Phase C — Auth and multi-user (week 4–6)

10. Integrate **Auth.js** with credentials or OAuth; protect routes and APIs.
11. Associate movements and edits with `userId`; optional roles (admin/editor/viewer).

### Phase D — Projects and BOM (week 6–8)

12. **Projects** and **BOM lines**; “buildability” calculator vs current stock.
13. Optional: consume stock from a build (ties movements to project).

### Phase E — Files and search (week 8–10)

14. File upload for datasheets/images; serve securely.
15. **Full-text or indexed search** (Postgres `tsvector` or simple `ILIKE` + filters first).
16. **Parametric filters** for common electronics attributes (iterate on schema).

### Phase F — Barcodes and labels (week 10–12)

17. Generate **QR/barcode** values; print-friendly label page.
18. **Scanner flow** in UI: scan → resolve part or location → quick adjust.

### Phase G — Integrations and polish (ongoing)

19. **REST API** (Route Handlers) with API keys for scripts.
20. **CSV import/export**.
21. **PWA** manifest + offline-tolerant read-only cache (optional).
22. **KiCad HTTP library** or plugin (research KiCad 8+ library API; align JSON with Part-DB patterns).

---

## 6. Quality bar

- **Lint + typecheck** in CI; **Prisma migrate** in deploy docs.
- **Seed script** for demo categories/parts (developer onboarding).
- **Accessibility**: keyboard navigation, labels on forms (Tailwind + semantic HTML).

---

## 7. Immediate next actions (first sprint)

1. From `web/`: `npm install prisma @prisma/client zod` and `npx prisma init`.
2. Define first migration for `Category`, `StorageLocation`, `Part`.
3. Replace placeholder home with **Parts** list page backed by Prisma.
4. Add `docker-compose.yml` with Postgres only.
5. Add `.github/workflows/ci.yml` running `npm run lint` and `npm run build`.

---

## 8. References (external)

- [InvenTree — parts, suppliers, stock, BOM](https://inventree.org/)
- [Part-DB documentation — KiCad, distributor APIs, barcodes](https://docs.part-db.de/)
- [Hackaday — Part-DB feature overview](https://www.hackaday.io/project/18803-part-db-open-source-inventory-software)
- [BrightCoding — InvenTree architecture notes](https://blog.brightcoding.dev/2025/09/05/open-source-inventory-management-for-parts-stock-tracking-a-deep-dive-into-inventree) (Django/React stack reference)

---

*Last updated: 2026-04-11 — aligned with repository bootstrap.*
