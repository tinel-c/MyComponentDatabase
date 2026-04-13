import { cardClass, sectionHeadingClass, sectionSubheadingClass } from "@/components/forms/field-classes";
import Link from "next/link";
import { pushInventoryToProduction } from "./actions";
import { SyncPushButton } from "./SyncPushButton";

export default function AdminSyncPage() {
  const targetSecret = process.env.SYNC_TARGET_SECRET?.trim() || "(not set)";
  const targetUrl = process.env.SYNC_TARGET_URL?.trim() || "(not set)";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className={sectionHeadingClass}>Database sync</h1>
        <p className={sectionSubheadingClass}>
          Export inventory as JSON or push from this server to production using environment
          variables. Import on the target always uses a shared secret (Bearer token), not browser
          cookies.
        </p>
      </header>

      <div
        className="rounded-xl border border-rim/60 bg-danger-muted px-4 py-3 text-sm text-danger-fg"
        role="status"
      >
        <strong className="font-semibold">Images are now included in push.</strong> The push action
        uploads files from{" "}
        <code className="rounded bg-canvas/80 px-1 py-0.5 text-xs">public/part-assets/</code>.
        Large photo libraries can make the request bigger/slower.
      </div>

      <section className={`${cardClass} space-y-4 p-6`}>
        <div>
          <h2 className="text-lg font-semibold text-fg">Export</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Download a JSON snapshot of categories, locations, parts, purchase links, and part
            image rows (metadata only).
          </p>
        </div>
        <Link
          href="/api/admin/sync/export"
          className="inline-flex items-center justify-center rounded-full border border-rim bg-surface px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-overlay"
        >
          Download inventory JSON
        </Link>
      </section>

      <section className={`${cardClass} space-y-4 p-6`}>
        <div>
          <h2 className="text-lg font-semibold text-fg">Push to production</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Reads <code className="text-xs text-accent">SYNC_TARGET_URL</code> and{" "}
            <code className="text-xs text-accent">SYNC_TARGET_SECRET</code> on this server, exports
            the local inventory, and POSTs it to the target&apos;s{" "}
            <code className="text-xs">/api/admin/sync/import</code>. The secret must match{" "}
            <code className="text-xs">DATABASE_SYNC_SECRET</code> on production.
          </p>
          <p className="mt-2 text-sm text-fg-muted">
            Target URL: <code className="text-xs text-accent">{targetUrl}</code>
          </p>
          <p className="mt-1 text-sm text-fg-muted">
            SYNC_TARGET_SECRET for this instance:{" "}
            <code className="rounded bg-canvas/80 px-1 py-0.5 text-xs text-accent">{targetSecret}</code>
          </p>
        </div>
        <SyncPushButton pushAction={pushInventoryToProduction} />
      </section>
    </div>
  );
}
