import Link from "next/link";
import { requireAdmin, requireBudgetAccess } from "@/lib/authz";
import { sectionSubheadingClass } from "@/components/forms/field-classes";
import { DataToolsClient } from "@/components/data/DataToolsClient";

export default async function DataToolsPage() {
  await requireAdmin();
  await requireBudgetAccess();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-fg">Data</h1>
        <p className={sectionSubheadingClass}>
          Admin-only export, import, and selective erase. Ignored ING rows stay in
          the ledger (balances); budget math excludes them via ignore rules in
          notes — no re-import needed when toggling rules.
        </p>
      </div>
      <DataToolsClient />
    </div>
  );
}
