import { cache } from "react";
import type { Recurrence } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/money";
import { advancePlannedDate } from "@/lib/planned-payments";
import { invalidateBudgetCaches } from "@/lib/cache-tags";

const AUTO_ENTER_LIMIT = 20;

/**
 * Catch up due SCHEDULED rows with autoEnter=true (create ledger txn + advance).
 * Skips create when a txn already exists for that scheduledTransactionId+date.
 * Limited to AUTO_ENTER_LIMIT entries per call.
 */
export async function runScheduledAutoEnter(budgetId: string): Promise<number> {
  const today = todayISO();
  let processed = 0;
  let anyCreated = false;

  while (processed < AUTO_ENTER_LIMIT) {
    const due = await prisma.scheduledTransaction.findMany({
      where: {
        budgetId,
        active: true,
        kind: "SCHEDULED",
        autoEnter: true,
        nextDate: { lte: today },
      },
      orderBy: { nextDate: "asc" },
      take: AUTO_ENTER_LIMIT - processed,
    });
    if (due.length === 0) break;

    let advancedAny = false;
    for (const sched of due) {
      if (processed >= AUTO_ENTER_LIMIT) break;

      const existing = await prisma.transaction.findFirst({
        where: {
          scheduledTransactionId: sched.id,
          date: sched.nextDate,
        },
        select: { id: true },
      });

      if (!existing) {
        await prisma.transaction.create({
          data: {
            accountId: sched.accountId,
            date: sched.nextDate,
            amount: sched.amount,
            payeeId: sched.payeeId,
            categoryId: sched.categoryId,
            notes: sched.notes,
            cleared: true,
            scheduledTransactionId: sched.id,
          },
        });
        anyCreated = true;
      }

      const next = advancePlannedDate(
        sched.nextDate,
        sched.recurrence as Recurrence | string,
      );
      await prisma.scheduledTransaction.update({
        where: { id: sched.id },
        data: {
          nextDate: next,
          active: sched.recurrence === "ONCE" ? false : true,
        },
      });
      processed++;
      advancedAny = true;
    }

    if (!advancedAny) break;
  }

  if (anyCreated) {
    invalidateBudgetCaches(budgetId);
  }
  return processed;
}

/** Once per request — call from app layout so catch-up runs on load. */
export const runScheduledAutoEnterCached = cache(async (budgetId: string) => {
  return runScheduledAutoEnter(budgetId);
});
