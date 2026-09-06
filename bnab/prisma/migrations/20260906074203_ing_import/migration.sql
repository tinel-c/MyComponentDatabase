-- CreateTable
CREATE TABLE "ImportCategoryRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "matchText" TEXT NOT NULL,
    "categoryId" TEXT,
    "ignore" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportCategoryRule_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportCategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "snapshotPath" TEXT,
    "statsJson" TEXT,
    CONSTRAINT "ImportBatch_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatchItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "transactionId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "memoPreview" TEXT,
    CONSTRAINT "ImportBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payeeId" TEXT,
    "categoryId" TEXT,
    "notes" TEXT,
    "cleared" BOOLEAN NOT NULL DEFAULT false,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "isParent" BOOLEAN NOT NULL DEFAULT false,
    "isChild" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "transferTwinId" TEXT,
    "isStartingBalance" BOOLEAN NOT NULL DEFAULT false,
    "importFingerprint" TEXT,
    "importContentHash" TEXT,
    "importBatchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "Payee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("accountId", "amount", "categoryId", "cleared", "createdAt", "date", "id", "isChild", "isParent", "isStartingBalance", "notes", "parentId", "payeeId", "reconciled", "transferTwinId", "updatedAt") SELECT "accountId", "amount", "categoryId", "cleared", "createdAt", "date", "id", "isChild", "isParent", "isStartingBalance", "notes", "parentId", "payeeId", "reconciled", "transferTwinId", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_accountId_date_idx" ON "Transaction"("accountId", "date");
CREATE INDEX "Transaction_categoryId_date_idx" ON "Transaction"("categoryId", "date");
CREATE INDEX "Transaction_parentId_idx" ON "Transaction"("parentId");
CREATE INDEX "Transaction_transferTwinId_idx" ON "Transaction"("transferTwinId");
CREATE INDEX "Transaction_importBatchId_idx" ON "Transaction"("importBatchId");
CREATE UNIQUE INDEX "Transaction_accountId_importFingerprint_key" ON "Transaction"("accountId", "importFingerprint");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ImportCategoryRule_budgetId_sortOrder_idx" ON "ImportCategoryRule"("budgetId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ImportCategoryRule_budgetId_matchText_key" ON "ImportCategoryRule"("budgetId", "matchText");

-- CreateIndex
CREATE INDEX "ImportBatch_budgetId_createdAt_idx" ON "ImportBatch"("budgetId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_accountId_idx" ON "ImportBatch"("accountId");

-- CreateIndex
CREATE INDEX "ImportBatchItem_batchId_idx" ON "ImportBatchItem"("batchId");

-- CreateIndex
CREATE INDEX "ImportBatchItem_fingerprint_idx" ON "ImportBatchItem"("fingerprint");
