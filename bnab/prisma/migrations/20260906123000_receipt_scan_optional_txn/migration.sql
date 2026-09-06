-- AlterTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReceiptScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "transactionId" TEXT,
    "imagePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "model" TEXT,
    "rawJson" TEXT,
    "errorText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReceiptScan_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReceiptScan_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReceiptScan" ("budgetId", "createdAt", "errorText", "id", "imagePath", "model", "rawJson", "status", "transactionId") SELECT "budgetId", "createdAt", "errorText", "id", "imagePath", "model", "rawJson", "status", "transactionId" FROM "ReceiptScan";
DROP TABLE "ReceiptScan";
ALTER TABLE "new_ReceiptScan" RENAME TO "ReceiptScan";
CREATE INDEX "ReceiptScan_budgetId_createdAt_idx" ON "ReceiptScan"("budgetId", "createdAt");
CREATE INDEX "ReceiptScan_transactionId_idx" ON "ReceiptScan"("transactionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
