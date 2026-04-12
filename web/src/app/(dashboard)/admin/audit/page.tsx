import { AuditLogRevertControl } from "@/components/admin/AuditRevertButton";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import Link from "next/link";

const PAGE_SIZE = 50;

const MODELS = ["Part", "Category", "StorageLocation", "User"] as const;
const ACTIONS = ["CREATE", "UPDATE", "DELETE"] as const;

const AUDIT_PATH = "/admin/audit";

/** Always returns a real path — never `""`, so Next.js Link navigates correctly. */
function auditHref(parts: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(parts)) {
    if (v != null && v !== "") {
      sp.set(k, v);
    }
  }
  const s = sp.toString();
  return s ? `${AUDIT_PATH}?${s}` : AUDIT_PATH;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const page = Math.max(1, parseInt(String(raw.page ?? "1"), 10) || 1);
  const modelRaw = typeof raw.model === "string" ? raw.model : "";
  const actionRaw = typeof raw.action === "string" ? raw.action : "";

  const modelFilter = MODELS.includes(modelRaw as (typeof MODELS)[number])
    ? modelRaw
    : "";
  const actionFilter = ACTIONS.includes(actionRaw as (typeof ACTIONS)[number])
    ? actionRaw
    : "";

  const where: Prisma.AuditLogWhereInput = {};
  if (modelFilter) {
    where.model = modelFilter;
  }
  if (actionFilter) {
    where.action = actionFilter;
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Audit log</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Database changes with actor and optional revert for update operations.
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Model
        </span>
        <Link
          href={auditHref({ action: actionFilter || undefined })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !modelFilter ? "bg-accent text-accent-fg" : "bg-surface text-fg-muted ring-1 ring-rim/60"
          }`}
        >
          All
        </Link>
        {MODELS.map((m) => (
          <Link
            key={m}
            href={auditHref({
              model: m,
              action: actionFilter || undefined,
            })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              modelFilter === m
                ? "bg-accent text-accent-fg"
                : "bg-surface text-fg-muted ring-1 ring-rim/60"
            }`}
          >
            {m === "StorageLocation" ? "Location" : m}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Action
        </span>
        <Link
          href={auditHref({ model: modelFilter || undefined })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !actionFilter ? "bg-accent text-accent-fg" : "bg-surface text-fg-muted ring-1 ring-rim/60"
          }`}
        >
          All
        </Link>
        {ACTIONS.map((a) => (
          <Link
            key={a}
            href={auditHref({
              model: modelFilter || undefined,
              action: a,
            })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              actionFilter === a
                ? "bg-accent text-accent-fg"
                : "bg-surface text-fg-muted ring-1 ring-rim/60"
            }`}
          >
            {a}
          </Link>
        ))}
      </div>

      <p className="text-sm text-fg-muted">
        {total} {total === 1 ? "entry" : "entries"}
        {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ""}
      </p>

      {/* List */}
      <div
        className="overflow-hidden rounded-2xl border-[3px] bg-zinc-200 shadow-[0_6px_24px_-8px_rgba(0,0,0,0.22)]"
        style={{ borderColor: "#4b4b4b" }}
      >
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{
            background: "#111111",
            borderBottom: "2px solid color-mix(in oklch, var(--accent) 40%, #000)",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: "var(--accent)", opacity: 0.9 }}
          >
            Change history
          </p>
        </div>

        <ul className="divide-y-2 divide-zinc-300">
          {rows.length === 0 ? (
            <li className="bg-white px-4 py-8 text-center text-sm text-zinc-500">
              No log entries match the filters.
            </li>
          ) : (
            rows.map((row, i) => {
              const when = row.createdAt.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              });
              const actor =
                row.user?.email ?? row.user?.name ?? row.userId ?? "Unknown";
              return (
                <li
                  key={row.id}
                  className={`px-4 py-3 ${i % 2 === 0 ? "bg-white" : ""}`}
                  style={i % 2 === 1 ? { background: "var(--card-well)" } : undefined}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-zinc-500">{when}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            row.action === "CREATE"
                              ? "bg-emerald-100 text-emerald-900"
                              : row.action === "UPDATE"
                                ? "bg-sky-100 text-sky-900"
                                : "bg-rose-100 text-rose-900"
                          }`}
                        >
                          {row.action}
                        </span>
                        {row.reverted ? (
                          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">
                            Reverted
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold text-zinc-900">
                        <span className="text-zinc-500">{row.model}</span>
                        {" · "}
                        {row.recordName ?? row.recordId}
                      </p>
                      <p className="text-xs text-zinc-600">
                        By{" "}
                        <span className="font-medium text-zinc-800">{actor}</span>
                      </p>
                    </div>
                    <div className="shrink-0">
                      <AuditLogRevertControl
                        auditId={row.id}
                        action={row.action}
                        reverted={row.reverted}
                        hasBefore={row.before != null}
                      />
                    </div>
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-zinc-600 hover:text-zinc-900">
                      Before / after (JSON)
                    </summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase text-zinc-500">
                          Before
                        </p>
                        <pre className="max-h-48 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-[10px] text-zinc-800">
                          {row.before == null
                            ? "—"
                            : JSON.stringify(row.before, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase text-zinc-500">
                          After
                        </p>
                        <pre className="max-h-48 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-[10px] text-zinc-800">
                          {row.after == null
                            ? "—"
                            : JSON.stringify(row.after, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </details>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {page > 1 ? (
            <Link
              href={auditHref({
                model: modelFilter || undefined,
                action: actionFilter || undefined,
                page: String(page - 1),
              })}
              className="rounded-full border border-rim px-4 py-2 text-sm text-fg hover:bg-fg/8"
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              href={auditHref({
                model: modelFilter || undefined,
                action: actionFilter || undefined,
                page: String(page + 1),
              })}
              className="rounded-full border border-rim px-4 py-2 text-sm text-fg hover:bg-fg/8"
            >
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
