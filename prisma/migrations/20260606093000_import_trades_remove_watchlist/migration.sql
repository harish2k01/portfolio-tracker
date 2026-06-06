ALTER TABLE "Asset" ADD COLUMN "isin" TEXT;
CREATE UNIQUE INDEX "Asset_isin_key" ON "Asset"("isin");

ALTER TABLE "Transaction" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "importedAt" TIMESTAMP(3);
CREATE INDEX "Transaction_userId_externalSource_externalId_idx" ON "Transaction"("userId", "externalSource", "externalId");

ALTER TABLE "Sip" DROP COLUMN IF EXISTS "dismissedDueDate";

DROP TABLE IF EXISTS "WatchlistItem";
