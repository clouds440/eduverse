CREATE TABLE "AdmissionsDomainEvent" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "programOfferingId" TEXT,
    "submissionId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionsDomainEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdmissionsDomainEvent_providerId_createdAt_idx" ON "AdmissionsDomainEvent"("providerId", "createdAt");
CREATE INDEX "AdmissionsDomainEvent_programOfferingId_createdAt_idx" ON "AdmissionsDomainEvent"("programOfferingId", "createdAt");
CREATE INDEX "AdmissionsDomainEvent_submissionId_createdAt_idx" ON "AdmissionsDomainEvent"("submissionId", "createdAt");
CREATE INDEX "AdmissionsDomainEvent_eventType_publishedAt_idx" ON "AdmissionsDomainEvent"("eventType", "publishedAt");

ALTER TABLE "AdmissionsDomainEvent" ADD CONSTRAINT "AdmissionsDomainEvent_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdmissionsDomainEvent" ADD CONSTRAINT "AdmissionsDomainEvent_programOfferingId_fkey" FOREIGN KEY ("programOfferingId") REFERENCES "ProgramOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdmissionsDomainEvent" ADD CONSTRAINT "AdmissionsDomainEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "OnlineAdmissionSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
