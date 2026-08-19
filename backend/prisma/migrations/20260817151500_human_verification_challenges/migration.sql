CREATE TABLE "HumanVerificationChallenge" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "answerHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HumanVerificationChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HumanVerificationChallenge_purpose_expiresAt_idx" ON "HumanVerificationChallenge"("purpose", "expiresAt");
CREATE INDEX "HumanVerificationChallenge_createdAt_idx" ON "HumanVerificationChallenge"("createdAt");

ALTER TABLE "Organization" ADD COLUMN "onlineAdmissionEmailTemplates" JSONB;
