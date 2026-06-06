ALTER TABLE "Transaction"
ALTER COLUMN "amount" TYPE DECIMAL(18, 3);

UPDATE "Transaction"
SET "stampDuty" = 0
WHERE "externalSource" IS NOT NULL;

UPDATE "Transaction"
SET "amount" = ROUND("quantity" * "navOrPrice", 3)
WHERE "externalSource" = 'mf-tradebook';
