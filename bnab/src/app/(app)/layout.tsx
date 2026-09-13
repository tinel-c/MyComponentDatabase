import { Suspense } from "react";
import { requireBudgetAccess } from "@/lib/authz";
import {
  AccountActivityRail,
  AppChrome,
} from "@/components/layout/AppChrome";
import { loadAccountActivityCached } from "@/lib/cache-tags";

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
  return (
    <AppChrome
      budgetName={budget.name}
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
