import { Suspense } from "react";
import { requireBudgetAccess } from "@/lib/authz";
import { AppChrome } from "@/components/layout/AppChrome";
import { prisma } from "@/lib/prisma";
import { loadAccountActivitySummaries } from "@/lib/account-activity-summary";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { budget } = await requireBudgetAccess();
  const accountActivity = await loadAccountActivitySummaries(prisma, budget.id);
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-canvas text-sm text-fg-muted">Loading…</div>
      }
    >
      <AppChrome budgetName={budget.name} accountActivity={accountActivity}>
        {children}
      </AppChrome>
    </Suspense>
  );
}
