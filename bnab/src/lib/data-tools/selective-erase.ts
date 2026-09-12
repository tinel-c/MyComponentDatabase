import type { PrismaClient } from "@prisma/client";
import {
  seedDefaultImportRules,
  seedDefaultReceiptRules,
} from "@/lib/starter-categories";

/** Checklist for More → Data selective erase. Users / team memberships are never wiped. */
export type SelectiveEraseFlags = {
  transactions: boolean;
  importBatches: boolean;
  receiptScans: boolean;
  monthlyBudgets: boolean;
  payees: boolean;
  schedules: boolean;
  /** Default off — keep ING memo → category mappings. */
  importRules: boolean;
  /** Default off — keep receipt line → category mappings. */
  receiptRules: boolean;
  categories: boolean;
  accounts: boolean;
};

export const DEFAULT_ERASE_FLAGS: SelectiveEraseFlags = {
  transactions: true,
  importBatches: true,
  receiptScans: true,
  monthlyBudgets: true,
  payees: true,
  schedules: true,
  importRules: false,
  receiptRules: false,
  categories: false,
  accounts: false,
};

const FLAG_KEYS = Object.keys(DEFAULT_ERASE_FLAGS) as (keyof SelectiveEraseFlags)[];

/** Parse checkbox form fields; missing keys = false (unchecked). */
export function parseEraseFlags(
  get: (name: string) => FormDataEntryValue | null,
): SelectiveEraseFlags {
  const flags = { ...DEFAULT_ERASE_FLAGS };
  for (const key of FLAG_KEYS) {
    flags[key] = get(key) === "on" || get(key) === "true" || get(key) === "1";
  }
  return flags;
}

/** Defaults for a "fresh ledger" form: wipe data, keep mappings / structure. */
export function freshLedgerEraseFlags(): SelectiveEraseFlags {
  return { ...DEFAULT_ERASE_FLAGS };
}

export async function selectiveEraseBudget(
  prisma: PrismaClient,
  budgetId: string,
  flags: SelectiveEraseFlags,
): Promise<{ reseededImportRules: boolean; reseededReceiptRules: boolean }> {
  const accountIds = (
    await prisma.financeAccount.findMany({
      where: { budgetId },
      select: { id: true },
    })
  ).map((a) => a.id);

  // Receipt lines → scans (before transactions if we keep orphaned images optional)
  if (flags.receiptScans) {
    await prisma.receiptScanLine.deleteMany({
      where: { scan: { budgetId } },
    });
    await prisma.receiptScan.deleteMany({ where: { budgetId } });
  } else if (flags.transactions) {
    await prisma.receiptScan.updateMany({
      where: { budgetId, transactionId: { not: null } },
      data: { transactionId: null },
    });
  }

  if (flags.importBatches) {
    await prisma.importBatchItem.deleteMany({
      where: { batch: { budgetId } },
    });
    if (!flags.transactions && accountIds.length) {
      await prisma.transaction.updateMany({
        where: { accountId: { in: accountIds }, importBatchId: { not: null } },
        data: {
          importBatchId: null,
          importFingerprint: null,
          importContentHash: null,
        },
      });
    }
    await prisma.importBatch.deleteMany({ where: { budgetId } });
  }

  if (flags.transactions && accountIds.length) {
    // Children cascade via parent relation; wipe all account rows.
    await prisma.transaction.deleteMany({
      where: { accountId: { in: accountIds } },
    });
  }

  if (flags.schedules) {
    await prisma.scheduledTransaction.deleteMany({ where: { budgetId } });
  }

  if (flags.monthlyBudgets) {
    await prisma.monthlyCategoryBudget.deleteMany({
      where: { category: { group: { budgetId } } },
    });
    await prisma.categoryTarget.deleteMany({
      where: { category: { group: { budgetId } } },
    });
    await prisma.monthMeta.deleteMany({ where: { budgetId } });
  }

  if (flags.payees) {
    if (!flags.transactions && accountIds.length) {
      await prisma.transaction.updateMany({
        where: { accountId: { in: accountIds } },
        data: { payeeId: null },
      });
    }
    if (!flags.schedules) {
      await prisma.scheduledTransaction.updateMany({
        where: { budgetId },
        data: { payeeId: null },
      });
    }
    await prisma.payee.deleteMany({ where: { budgetId } });
  }

  if (flags.importRules) {
    await prisma.importCategoryRule.deleteMany({ where: { budgetId } });
  }

  if (flags.receiptRules) {
    if (!flags.receiptScans) {
      await prisma.receiptScanLine.updateMany({
        where: { scan: { budgetId } },
        data: { matchedRuleId: null },
      });
    }
    await prisma.receiptCategoryRule.deleteMany({ where: { budgetId } });
  }

  if (flags.categories) {
    await prisma.financeAccount.updateMany({
      where: { budgetId },
      data: { creditCategoryId: null },
    });
    if (!flags.importRules) {
      await prisma.importCategoryRule.updateMany({
        where: { budgetId },
        data: { categoryId: null },
      });
    }
    if (!flags.receiptRules) {
      await prisma.receiptCategoryRule.updateMany({
        where: { budgetId },
        data: { categoryId: null },
      });
    }
    if (!flags.payees) {
      await prisma.payee.updateMany({
        where: { budgetId },
        data: { lastCategoryId: null },
      });
    }
    if (!flags.transactions && accountIds.length) {
      await prisma.transaction.updateMany({
        where: { accountId: { in: accountIds } },
        data: { categoryId: null },
      });
    }
    if (!flags.schedules) {
      await prisma.scheduledTransaction.updateMany({
        where: { budgetId },
        data: { categoryId: null },
      });
    }
    if (!flags.monthlyBudgets) {
      await prisma.monthlyCategoryBudget.deleteMany({
        where: { category: { group: { budgetId } } },
      });
      await prisma.categoryTarget.deleteMany({
        where: { category: { group: { budgetId } } },
      });
    }
    await prisma.category.deleteMany({
      where: { group: { budgetId } },
    });
    await prisma.categoryGroup.deleteMany({ where: { budgetId } });
  }

  if (flags.accounts) {
    if (!flags.transactions) {
      await prisma.transaction.deleteMany({
        where: { accountId: { in: accountIds } },
      });
    }
    if (!flags.schedules) {
      await prisma.scheduledTransaction.deleteMany({ where: { budgetId } });
    }
    await prisma.financeAccount.deleteMany({ where: { budgetId } });
  }

  let reseededImportRules = false;
  let reseededReceiptRules = false;
  if (flags.importRules && !flags.categories) {
    await seedDefaultImportRules(prisma, budgetId);
    reseededImportRules = true;
  }
  if (flags.receiptRules && !flags.categories) {
    await seedDefaultReceiptRules(prisma, budgetId);
    reseededReceiptRules = true;
  }

  return { reseededImportRules, reseededReceiptRules };
}
