import Link from "next/link";
import { requireAdmin, requireBudgetAccess } from "@/lib/authz";
import { pageStackClass, sectionSubheadingClass } from "@/components/forms/field-classes";
import { DataToolsClient } from "@/components/data/DataToolsClient";

export default async function DataToolsPage() {
  await requireAdmin();
  await requireBudgetAccess();

  return (
    <div className={`mx-auto max-w-2xl ${pageStackClass}`}>
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-fg md:text-2xl">Data</h1>
        <p className={sectionSubheadingClass}>
          Admin export, import, and selective erase. Ignored ING rows stay in the
          ledger; budget math excludes them via ignore rules.
        </p>
      </div>
      <DataToolsClient />
    </div>
  );
}
