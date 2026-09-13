-- Planned payments FKs, pending-bill flag, import history enrichment
ALTER TABLE "Transaction" ADD COLUMN "isPendingBill" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN "scheduledTransactionId" TEXT;

CREATE INDEX "Transaction_scheduledTransactionId_idx" ON "Transaction"("scheduledTransactionId");
CREATE INDEX "Transaction_isPendingBill_idx" ON "Transaction"("isPendingBill");

ALTER TABLE "ImportBatchItem" ADD COLUMN "importRuleId" TEXT;
ALTER TABLE "ImportBatchItem" ADD COLUMN "scheduledTransactionId" TEXT;
ALTER TABLE "ImportBatchItem" ADD COLUMN "classification" TEXT;

CREATE INDEX "ImportBatchItem_importRuleId_idx" ON "ImportBatchItem"("importRuleId");
CREATE INDEX "ImportBatchItem_scheduledTransactionId_idx" ON "ImportBatchItem"("scheduledTransactionId");

ALTER TABLE "ScheduledTransaction" ADD COLUMN "billingUrl" TEXT;
ALTER TABLE "ScheduledTransaction" ADD COLUMN "importRuleId" TEXT;
ALTER TABLE "ScheduledTransaction" ADD COLUMN "dayOfMonth" INTEGER;
ALTER TABLE "ScheduledTransaction" ADD COLUMN "weekday" INTEGER;

CREATE INDEX "ScheduledTransaction_importRuleId_idx" ON "ScheduledTransaction"("importRuleId");
