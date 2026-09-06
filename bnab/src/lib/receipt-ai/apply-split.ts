import type { PrismaClient } from "@prisma/client";
import type { ProposedSplit } from "./types";

/**
 * Convert an existing bank transaction into a split parent + category children.
 * Replaces prior children on re-detail. Clears parent categoryId.
 */
export async function applyReceiptSplits(params: {
  prisma: PrismaClient;
  transactionId: string;
  budgetId: string;
  splits: ProposedSplit[];
}): Promise<{ childIdsByCategory: Map<string, string> }> {
  if (params.splits.length < 1) {
    throw new Error("Need at least one split line");
  }

  const txn = await params.prisma.transaction.findFirst({
    where: {
      id: params.transactionId,
      account: { budgetId: params.budgetId },
      isChild: false,
    },
  });
  if (!txn) throw new Error("Transaction not found");
  if (txn.transferTwinId) {
    throw new Error("Cannot detail a transfer");
  }

  const outflow = txn.amount <= 0;
  const childIdsByCategory = new Map<string, string>();

  await params.prisma.$transaction(async (tx) => {
    await tx.transaction.deleteMany({
      where: { parentId: txn.id },
    });

    await tx.transaction.update({
      where: { id: txn.id },
      data: {
        isParent: true,
        categoryId: null,
      },
    });

    for (const split of params.splits) {
      const amount = outflow
        ? -Math.abs(split.amountCents)
        : Math.abs(split.amountCents);
      const child = await tx.transaction.create({
        data: {
          accountId: txn.accountId,
          date: txn.date,
          amount,
          categoryId: split.categoryId,
          payeeId: txn.payeeId,
          notes: split.notes || null,
          isChild: true,
          parentId: txn.id,
          cleared: txn.cleared,
        },
      });
      childIdsByCategory.set(split.categoryId, child.id);
    }

    const children = await tx.transaction.findMany({
      where: { parentId: txn.id },
      select: { amount: true },
    });
    const childSum = children.reduce((s, c) => s + c.amount, 0);
    if (childSum !== txn.amount) {
      // Keep parent bank amount authoritative; nudge largest child.
      const delta = txn.amount - childSum;
      const largest = await tx.transaction.findFirst({
        where: { parentId: txn.id },
        orderBy: { amount: outflow ? "asc" : "desc" },
      });
      if (largest) {
        await tx.transaction.update({
          where: { id: largest.id },
          data: { amount: largest.amount + delta },
        });
      }
    }
  });

  return { childIdsByCategory };
}
