import { Suspense } from "react";
import { requireBudgetAccess } from "@/lib/authz";
import {
  AccountActivityRail,
  AppChrome,
} from "@/components/layout/AppChrome";
import { loadAccountActivityCached } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/money";

/** Streams into the desktop activity rail without blocking main chrome. */
async function AccountActivitySlot({ budgetId }: { budgetId: string }) {
  const summaries = await loadAccountActivityCached(budgetId);
  if (summaries.length === 0) return null;
  return <AccountActivityRail summaries={summaries} />;
}

function ActivityRailFallback() {
  return (
    <aside
      className="hidden w-14 shrink-0 border-l border-rim/60 bg-surface/40 md:block"
      aria-hidden
    />
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { budget } = await requireBudgetAccess();
  const plannedDueCount = await prisma.scheduledTransaction.count({
    where: {
      budgetId: budget.id,
      active: true,
      nextDate: { lte: todayISO() },
    },
  });
  return (
    <AppChrome
      budgetName={budget.name}
      plannedDueCount={plannedDueCount}
      activitySlot={
        <Suspense fallback={<ActivityRailFallback />}>
          <AccountActivitySlot budgetId={budget.id} />
        </Suspense>
      }
    >
      {children}
    </AppChrome>
  );
}
