ALTER TABLE "User"
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "contactEmailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "contactEmailVerificationCodeHash" TEXT,
ADD COLUMN "contactEmailVerificationExpiresAt" TIMESTAMP(3),
ADD COLUMN "contactEmailVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastContactEmailVerificationSentAt" TIMESTAMP(3);
