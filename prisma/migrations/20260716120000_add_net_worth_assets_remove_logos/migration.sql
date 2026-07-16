CREATE TYPE "NetWorthAssetType" AS ENUM (
  'BANK_ACCOUNT',
  'FIXED_DEPOSIT',
  'EPF',
  'GOLD',
  'PPF',
  'NPS',
  'OTHER'
);

CREATE TABLE "NetWorthAsset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "NetWorthAssetType" NOT NULL,
  "institution" TEXT,
  "currentValue" DECIMAL(18,2) NOT NULL,
  "investedAmount" DECIMAL(18,2),
  "accountReference" TEXT,
  "interestRate" DECIMAL(8,4),
  "maturityDate" TIMESTAMP(3),
  "quantity" DECIMAL(24,8),
  "unitPrice" DECIMAL(18,6),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NetWorthAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NetWorthSnapshot" (
  "id" TEXT NOT NULL,
  "netWorthAssetId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "currentValue" DECIMAL(18,2) NOT NULL,
  "investedAmount" DECIMAL(18,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NetWorthAsset_userId_type_idx" ON "NetWorthAsset"("userId", "type");
CREATE INDEX "NetWorthSnapshot_date_idx" ON "NetWorthSnapshot"("date");
CREATE UNIQUE INDEX "NetWorthSnapshot_netWorthAssetId_date_key" ON "NetWorthSnapshot"("netWorthAssetId", "date");

ALTER TABLE "NetWorthAsset"
  ADD CONSTRAINT "NetWorthAsset_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NetWorthSnapshot"
  ADD CONSTRAINT "NetWorthSnapshot_netWorthAssetId_fkey"
  FOREIGN KEY ("netWorthAssetId") REFERENCES "NetWorthAsset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Asset" DROP COLUMN "logoUrl";
ALTER TABLE "Asset" DROP COLUMN "logoSource";
ALTER TABLE "Asset" DROP COLUMN "logoUpdatedAt";
