import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import { fetchBillsChunk } from "@/lib/bills-chunk";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  cardCompactClass,
  pageStackClass,
  sectionSubheadingClass,
} from "@/components/forms/field-classes";
import { EmptyState } from "@/components/ui/EmptyState";
import { BillsInfiniteList } from "@/components/bills/BillsInfiniteList";

export default async function BillsPage() {
  const { budget } = await requireBudgetAccess();
  const chunk = await fetchBillsChunk(budget.id);

  return (
    <div className={pageStackClass}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/more" className="text-sm text-fg-muted hover:text-fg md:hidden">
            ← More
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-fg md:text-2xl">
            Imported bills
          </h1>
          <p className={sectionSubheadingClass}>
            Bill scans and ING / register linkage.{" "}
            <Link href="/more/import-bill" className="text-accent hover:underline">
              Import another
            </Link>
          </p>
        </div>
        <Link
          href="/more/import-bill"
          className={`${buttonCompactClass} w-full shrink-0 sm:w-auto`}
        >
          Import bill
        </Link>
      </div>

      {chunk.items.length === 0 ? (
        <div className={cardCompactClass}>
          <EmptyState
            icon={Receipt}
            title="No bills imported yet"
            description="Scan a receipt to categorize spend before the ING statement arrives."
            action={
              <Link href="/more/import-bill" className={buttonPrimaryClass}>
                Scan a receipt
              </Link>
            }
          />
        </div>
      ) : (
        <BillsInfiniteList
          currency={budget.currency}
          initialItems={chunk.items}
          initialCursor={chunk.nextCursor}
          hasMore={chunk.hasMore}
        />
      )}
    </div>
  );
}
