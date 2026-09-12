-- AlterTable
ALTER TABLE "ImportCategoryRule" ADD COLUMN "transferAccountId" TEXT;

-- CreateIndex
CREATE INDEX "ImportCategoryRule_transferAccountId_idx" ON "ImportCategoryRule"("transferAccountId");

-- AddForeignKey
ALTER TABLE "ImportCategoryRule" ADD CONSTRAINT "ImportCategoryRule_transferAccountId_fkey" FOREIGN KEY ("transferAccountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
