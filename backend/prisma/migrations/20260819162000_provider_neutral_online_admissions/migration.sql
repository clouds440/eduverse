ALTER TABLE "OnlineAdmissionSubmission"
  ALTER COLUMN "organizationId" DROP NOT NULL,
  ALTER COLUMN "departmentId" DROP NOT NULL,
  ALTER COLUMN "academicCycleId" DROP NOT NULL,
  ADD COLUMN "providerOutcome" TEXT,
  ADD COLUMN "providerOutcomeNote" TEXT,
  ADD COLUMN "providerOutcomeAt" TIMESTAMP(3);

ALTER TABLE "OnlineAdmissionDocumentUpload"
  ALTER COLUMN "organizationId" DROP NOT NULL;

ALTER TABLE "File"
  ALTER COLUMN "orgId" DROP NOT NULL;
