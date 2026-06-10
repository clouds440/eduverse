ALTER TABLE "Grade"
ADD COLUMN "finalizedById" TEXT,
ADD COLUMN "finalizedAt" TIMESTAMP(3),
ADD COLUMN "lastCorrectedById" TEXT,
ADD COLUMN "lastCorrectedAt" TIMESTAMP(3),
ADD COLUMN "correctionReason" TEXT;
