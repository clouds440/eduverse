ALTER TABLE "Session"
ADD COLUMN "contactEmailChangeCodeHash" TEXT,
ADD COLUMN "contactEmailChangeCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN "contactEmailChangeCodeAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "contactEmailChangeCodeSentAt" TIMESTAMP(3),
ADD COLUMN "contactEmailChangeAuthorizedAt" TIMESTAMP(3);
