-- Durable engine tip for continueFrom (plan cold-path).
-- SQLite: FK must be inline in CREATE TABLE (no ALTER ADD CONSTRAINT).
CREATE TABLE "EngineMonthTip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EngineMonthTip_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EngineMonthTip_budgetId_month_key" ON "EngineMonthTip"("budgetId", "month");
CREATE INDEX "EngineMonthTip_budgetId_idx" ON "EngineMonthTip"("budgetId");
