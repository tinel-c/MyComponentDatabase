import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  pageStackClass,
  sectionSubheadingClass,
} from "@/components/forms/field-classes";
import { LoanPayoffClient } from "@/components/loans/LoanPayoffClient";

export default async function LoansPage() {
  const { budget } = await requireBudgetAccess();
  const accounts = await prisma.financeAccount.findMany({
    where: {
      budgetId: budget.id,
      closed: false,
      type: "TRACKING_LIABILITY",
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className={`mx-auto max-w-lg ${pageStackClass}`}>
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-fg md:text-2xl">
          Loan payoff
        </h1>
        <p className={sectionSubheadingClass}>
          Rough months-to-payoff for a fixed payment. Balances are typed in —
          nothing syncs from the bank.
        </p>
      </div>
      <LoanPayoffClient accounts={accounts} currency={budget.currency} />
    </div>
  );
}
