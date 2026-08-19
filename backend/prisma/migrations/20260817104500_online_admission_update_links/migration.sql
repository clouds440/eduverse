ALTER TABLE "OnlineAdmissionSubmission"
ADD COLUMN "updateTokenHash" TEXT,
ADD COLUMN "updateTokenExpiresAt" TIMESTAMP(3);

CREATE INDEX "OnlineAdmissionSubmission_updateTokenHash_idx"
ON "OnlineAdmissionSubmission"("updateTokenHash");
