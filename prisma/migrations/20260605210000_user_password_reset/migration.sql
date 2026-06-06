ALTER TABLE "User"
ADD COLUMN "mustResetPassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "temporaryPasswordExpiresAt" TIMESTAMP(3);
