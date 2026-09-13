import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

/**
 * Parent ids of bill-import txns awaiting statement link (no fingerprint).
 * Their children should also be excluded from account balances / RTA.
 */
export async function findPendingBillImportParentIds(
  prisma: PrismaClient,
  accountIds: string[],
): Promise<string[]> {
  if (accountIds.length === 0) return [];
  const rows = await prisma.transaction.findMany({
    where: {
      accountId: { in: accountIds },
      isChild: false,
      importFingerprint: null,
      notes: { contains: "Bill import" },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Prisma filter: exclude pending bill parents and their split children. */
export function excludePendingBillImportsWhere(
  pendingParentIds: string[],
): Prisma.TransactionWhereInput {
  if (pendingParentIds.length === 0) return {};
  return {
    NOT: {
      OR: [
        { id: { in: pendingParentIds } },
        { parentId: { in: pendingParentIds } },
      ],
    },
  };
}
