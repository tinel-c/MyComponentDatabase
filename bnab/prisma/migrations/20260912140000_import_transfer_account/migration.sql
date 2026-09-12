-- SQLite: add nullable transferAccountId (no ALTER ADD CONSTRAINT support).
ALTER TABLE "ImportCategoryRule" ADD COLUMN "transferAccountId" TEXT;

CREATE INDEX IF NOT EXISTS "ImportCategoryRule_transferAccountId_idx" ON "ImportCategoryRule"("transferAccountId");
