-- AlterTable
ALTER TABLE "Part" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Part" ADD COLUMN "partNumber" INTEGER;

-- Backfill sequential part numbers (1..n by createdAt)
UPDATE "Part" AS p
SET "partNumber" = (
  SELECT rn
  FROM (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY datetime("createdAt")) AS rn
    FROM "Part"
  ) AS o
  WHERE o."id" = p."id"
);

-- CreateIndex
CREATE UNIQUE INDEX "Part_partNumber_key" ON "Part"("partNumber");

-- CreateIndex
CREATE INDEX "Part_partNumber_idx" ON "Part"("partNumber");
