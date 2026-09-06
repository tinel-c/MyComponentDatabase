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
  const [, accounts] = await Promise.all([
    seedDefaultReceiptRules(prisma, budget.id),
    prisma.financeAccount.findMany({
      where: { budgetId: budget.id, closed: false, onBudget: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

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
          Photo → categories now. Match an existing ING row, or create a new
          entry and link it when the statement arrives.{" "}
          <Link href="/more/bills" className="text-accent hover:underline">
            View imported bills
          </Link>
          {" · "}
          <Link href="/more/receipt-rules" className="text-accent hover:underline">
            Receipt mappings
          </Link>
        </p>
      </div>

      <ImportBillClient currency={budget.currency} accounts={accounts} />
    </div>
  );
}
