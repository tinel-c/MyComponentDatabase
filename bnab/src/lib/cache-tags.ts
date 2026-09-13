import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { loadPlanMonth as loadPlanMonthUncached } from "@/lib/plan-data";
import { loadAccountActivitySummaries as loadActivityUncached } from "@/lib/account-activity-summary";
import { clearEngineMonthTips } from "@/lib/engine-month-tip";
import {
  fetchTransactionsRegisterChunk,
  type TransactionsListFilters,
  buildTransactionsWhere,
} from "@/lib/transactions-register-chunk";
import {
  fetchAccountRegisterChunk,
  type AccountRegisterFilters,
  buildAccountRegisterWhere,
} from "@/lib/account-register-chunk";

export function planMonthTag(budgetId: string, month: string) {
  return `plan:${budgetId}:${month}`;
}

export function activityTag(budgetId: string, ym: string) {
  return `activity:${budgetId}:${ym}`;
}

export function budgetTag(budgetId: string) {
  return `budget:${budgetId}`;
}

export function registerTag(budgetId: string, scope: string, filterHash: string) {
  return `register:${budgetId}:${scope}:${filterHash}`;
}

export function hashRegisterFilters(filters: unknown): string {
  return createHash("sha1")
    .update(JSON.stringify(filters ?? {}))
    .digest("hex")
    .slice(0, 12);
}

/**
 * Bust plan / activity / tip / register first-page caches for a budget.
 * Also clears durable EngineMonthTip rows so continueFrom cannot go stale.
 */
export function invalidateBudgetCaches(budgetId: string) {
  revalidateTag(budgetTag(budgetId), "max");
  void clearEngineMonthTips(budgetId);
}

/** Per-request memoization of plan month. */
export const loadPlanMonthCached = cache(async (budgetId: string, month: string) => {
  const cached = unstable_cache(
    () => loadPlanMonthUncached(budgetId, month),
    [`plan-month`, budgetId, month],
    {
      tags: [budgetTag(budgetId), planMonthTag(budgetId, month)],
      revalidate: 60,
    },
  );
  return cached();
});

export const loadAccountActivityCached = cache(async (budgetId: string) => {
  const ym = new Date().toISOString().slice(0, 7);
  const cached = unstable_cache(
    () => loadActivityUncached(prisma, budgetId),
    [`activity`, budgetId, ym],
    {
      tags: [budgetTag(budgetId), activityTag(budgetId, ym)],
      revalidate: 60,
    },
  );
  return cached();
});

/** First-page transactions register (no cursor) — tagged; load-more stays uncached. */
export const loadTransactionsRegisterFirstPage = cache(
  async (budgetId: string, filters: TransactionsListFilters) => {
    const filterHash = hashRegisterFilters(filters);
    const where = buildTransactionsWhere(budgetId, filters);
    const activityView = Boolean(
      (filters.categoryId && filters.month) ||
        (filters.groupId && filters.month) ||
        (filters.month && filters.flow),
    );
    const cached = unstable_cache(
      async () => {
        const [chunk, count, activity] = await Promise.all([
          fetchTransactionsRegisterChunk({ budgetId, where }),
          prisma.transaction.count({ where }),
          activityView
            ? prisma.transaction.aggregate({
                where,
                _sum: { amount: true },
              })
            : Promise.resolve(null),
        ]);
        return {
          items: chunk.items,
          nextCursor: chunk.nextCursor,
          hasMore: chunk.hasMore,
          count,
          activitySum: activity?._sum.amount ?? null,
        };
      },
      [`txn-register-first`, budgetId, filterHash],
      {
        tags: [budgetTag(budgetId), registerTag(budgetId, "txn", filterHash)],
        revalidate: 45,
      },
    );
    return cached();
  },
);

/** First-page account register (no cursor). */
export const loadAccountRegisterFirstPage = cache(
  async (
    budgetId: string,
    accountId: string,
    filters: AccountRegisterFilters = {},
  ) => {
    const filterHash = hashRegisterFilters({ accountId, ...filters });
    const cached = unstable_cache(
      async () => {
        const [chunk, count] = await Promise.all([
          fetchAccountRegisterChunk(accountId, null, undefined, filters),
          prisma.transaction.count({
            where: buildAccountRegisterWhere(accountId, filters),
          }),
        ]);
        return { ...chunk, count };
      },
      [`acct-register-first`, budgetId, accountId, filterHash],
      {
        tags: [
          budgetTag(budgetId),
          registerTag(budgetId, `acct:${accountId}`, filterHash),
        ],
        revalidate: 45,
      },
    );
    return cached();
  },
);
