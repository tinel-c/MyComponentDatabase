-- Salt Edge Partners AIS: connections, account links, provider txn ids.
-- SQLite: FK must be inline in CREATE TABLE (no ALTER ADD CONSTRAINT).

CREATE TABLE "BankProviderConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "connectionId" TEXT,
    "providerCode" TEXT,
    "providerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "consentExpiresAt" DATETIME,
    "lastSyncedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankProviderConnection_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BankProviderConnection_budgetId_connectionId_key" ON "BankProviderConnection"("budgetId", "connectionId");
CREATE INDEX "BankProviderConnection_budgetId_idx" ON "BankProviderConnection"("budgetId");
CREATE INDEX "BankProviderConnection_leadId_idx" ON "BankProviderConnection"("leadId");
CREATE INDEX "BankProviderConnection_connectionId_idx" ON "BankProviderConnection"("connectionId");

CREATE TABLE "BankAccountLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "financeAccountId" TEXT,
    "name" TEXT,
    "nature" TEXT,
    "currency" TEXT,
    "balanceMinor" INTEGER,
    "lastBalanceAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankAccountLink_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BankProviderConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BankAccountLink_financeAccountId_fkey" FOREIGN KEY ("financeAccountId") REFERENCES "FinanceAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BankAccountLink_connectionId_externalAccountId_key" ON "BankAccountLink"("connectionId", "externalAccountId");
CREATE INDEX "BankAccountLink_financeAccountId_idx" ON "BankAccountLink"("financeAccountId");

ALTER TABLE "Transaction" ADD COLUMN "providerTransactionId" TEXT;
CREATE UNIQUE INDEX "Transaction_accountId_providerTransactionId_key" ON "Transaction"("accountId", "providerTransactionId");
