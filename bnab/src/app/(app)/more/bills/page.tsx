import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireBudgetAccess } from "@/lib/authz";
import {
  fetchBillsChunk,
  parseBillStatusFilter,
  type BillListStatusFilter,
} from "@/lib/bills-chunk";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  cardCompactClass,
  chipClass,
  chipMutedClass,
  pageStackClass,
  sectionSubheadingClass,
} from "@/components/forms/field-classes";
import { EmptyState } from "@/components/ui/EmptyState";
import { BillsInfiniteList } from "@/components/bills/BillsInfiniteList";
import { reapplyReceiptRulesAction } from "@/app/(app)/more/receipts/actions";

const STATUS_CHIPS: {
  value: BillListStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "unlinked", label: "Unlinked" },
  { value: "needs_mapping", label: "Needs mapping" },
];

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { budget } = await requireBudgetAccess();
  const sp = await searchParams;
  const statusFilter = parseBillStatusFilter(sp.status);
  const chunk = await fetchBillsChunk(budget.id, null, undefined, statusFilter);

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
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <form action={reapplyReceiptRulesAction}>
            <button
              type="submit"
              className={`${buttonCompactClass} w-full sm:w-auto`}
            >
              Re-apply to unlinked scans
            </button>
          </form>
          <Link
            href="/more/import-bill"
            className={`${buttonCompactClass} w-full shrink-0 sm:w-auto`}
          >
            Import bill
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="navigation" aria-label="Bill status filter">
        {STATUS_CHIPS.map((chip) => {
          const href =
            chip.value === "all"
              ? "/more/bills"
              : `/more/bills?status=${chip.value}`;
          const active = statusFilter === chip.value;
          return (
            <Link
              key={chip.value}
              href={href}
              className={active ? chipClass : chipMutedClass}
              aria-current={active ? "page" : undefined}
            >
              {chip.label}
            </Link>
          );
        })}
      </div>

      {chunk.items.length === 0 ? (
        <div className={cardCompactClass}>
          <EmptyState
            icon={Receipt}
            title={
              statusFilter === "all"
                ? "No bills imported yet"
                : "No bills match this filter"
            }
            description={
              statusFilter === "all"
                ? "Scan a receipt to categorize spend before the ING statement arrives."
                : "Try another status chip or import a bill."
            }
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
          statusFilter={statusFilter}
        />
      )}
    </div>
  );
}
