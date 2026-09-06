import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  ensureYngsbCategories,
  seedDefaultReceiptRules,
} from "@/lib/starter-categories";
import { ImportBillClient } from "@/components/receipts/ImportBillClient";

export default async function ImportBillPage() {
  const { budget } = await requireBudgetAccess();
  await ensureYngsbCategories(prisma, budget.id);
  await seedDefaultReceiptRules(prisma, budget.id);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg md:hidden">
          ← More
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
          Import bill
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Photo of a receipt → match bank line by date & amount → split
          categories.{" "}
          <Link href="/more/receipt-rules" className="text-accent hover:underline">
            Receipt mappings
          </Link>
        </p>
      </div>

      <ImportBillClient currency={budget.currency} />
    </div>
  );
}
