-- CreateTable
CREATE TABLE "ReceiptCategoryRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "matchText" TEXT NOT NULL,
    "categoryId" TEXT,
    "ignore" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReceiptCategoryRule_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReceiptCategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceiptScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "imagePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "model" TEXT,
    "rawJson" TEXT,
    "errorText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReceiptScan_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReceiptScan_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceiptScanLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "categoryHint" TEXT,
    "matchedRuleId" TEXT,
    "childTransactionId" TEXT,
    "sortOrder" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ReceiptScanLine_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "ReceiptScan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReceiptScanLine_matchedRuleId_fkey" FOREIGN KEY ("matchedRuleId") REFERENCES "ReceiptCategoryRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReceiptCategoryRule_budgetId_sortOrder_idx" ON "ReceiptCategoryRule"("budgetId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptCategoryRule_budgetId_matchText_key" ON "ReceiptCategoryRule"("budgetId", "matchText");

-- CreateIndex
CREATE INDEX "ReceiptScan_budgetId_createdAt_idx" ON "ReceiptScan"("budgetId", "createdAt");

-- CreateIndex
CREATE INDEX "ReceiptScan_transactionId_idx" ON "ReceiptScan"("transactionId");

-- CreateIndex
CREATE INDEX "ReceiptScanLine_scanId_idx" ON "ReceiptScanLine"("scanId");

-- CreateIndex
CREATE INDEX "ReceiptScanLine_matchedRuleId_idx" ON "ReceiptScanLine"("matchedRuleId");
