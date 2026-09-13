import { Suspense } from "react";
import { requireBudgetAccess } from "@/lib/authz";
import {
  AccountActivityRail,
  AppChrome,
} from "@/components/layout/AppChrome";
import { loadAccountActivityCached } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/money";
import { runScheduledAutoEnterCached } from "@/lib/scheduled-auto-enter";

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
  const { budget, session } = await requireBudgetAccess();
  await runScheduledAutoEnterCached(budget.id);
  const [plannedDueCount, memberships] = await Promise.all([
    prisma.scheduledTransaction.count({
      where: {
        budgetId: budget.id,
        active: true,
        kind: "PLANNED",
        nextDate: { lte: todayISO() },
      },
    }),
    prisma.budgetMember.findMany({
      where: { userId: session.user.id },
      include: { budget: { select: { id: true, name: true, currency: true } } },
      orderBy: { budget: { createdAt: "asc" } },
    }),
  ]);
  const budgets = memberships.map((m) => m.budget);
  return (
    <AppChrome
      budgetName={budget.name}
      budgetId={budget.id}
      budgets={budgets}
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
