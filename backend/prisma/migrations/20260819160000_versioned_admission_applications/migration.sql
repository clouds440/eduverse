CREATE TYPE "AdmissionApplicationVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "AdditionalDocumentRequestStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'ACCEPTED', 'WAIVED');

ALTER TABLE "OnlineAdmissionDocumentUpload" DROP CONSTRAINT IF EXISTS "OnlineAdmissionDocumentUpload_requirementId_fkey";
DROP INDEX IF EXISTS "OnlineAdmissionDocumentUpload_submissionId_requirementId_key";
DROP TABLE "OnlineAdmissionDocumentRequirement";

CREATE TABLE "AdmissionApplicationTemplate" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isDefaultCampus" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdmissionApplicationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdmissionApplicationTemplateVersion" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "AdmissionApplicationVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "definition" JSONB NOT NULL,
  "uiSchema" JSONB,
  "consentText" TEXT,
  "consentVersion" TEXT,
  "createdById" TEXT NOT NULL,
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdmissionApplicationTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdmissionDocumentRequirement" (
  "id" TEXT NOT NULL,
  "templateVersionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "acceptedMimeTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "acceptedExtensions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "maxFileSizeBytes" INTEGER,
  "maxFileCount" INTEGER NOT NULL DEFAULT 1,
  "requiresExpiryDate" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdmissionDocumentRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramOfferingApplicationConfig" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "programOfferingId" TEXT NOT NULL,
  "applicationVersionId" TEXT NOT NULL,
  "allowApplicantUpdates" BOOLEAN NOT NULL DEFAULT true,
  "requireEmailVerification" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramOfferingApplicationConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdditionalDocumentRequest" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "organizationId" TEXT,
  "submissionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "acceptedMimeTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "acceptedExtensions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "maxFileSizeBytes" INTEGER,
  "maxFileCount" INTEGER NOT NULL DEFAULT 1,
  "requiresExpiryDate" BOOLEAN NOT NULL DEFAULT false,
  "status" "AdditionalDocumentRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "dueAt" TIMESTAMP(3),
  "requestedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdditionalDocumentRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OnlineAdmissionSubmission"
  ADD COLUMN "applicationVersionId" TEXT NOT NULL,
  ADD COLUMN "intent" "ProgramOfferingAction" NOT NULL DEFAULT 'APPLY',
  ADD COLUMN "formDefinitionSnapshot" JSONB NOT NULL,
  ADD COLUMN "documentRequirementsSnapshot" JSONB NOT NULL,
  ADD COLUMN "consentVersionSnapshot" TEXT;

ALTER TABLE "OnlineAdmissionDocumentUpload"
  ALTER COLUMN "requirementId" DROP NOT NULL,
  ADD COLUMN "additionalDocumentRequestId" TEXT,
  ADD COLUMN "policySnapshot" JSONB NOT NULL,
  ADD COLUMN "expiryDate" TIMESTAMP(3);

CREATE UNIQUE INDEX "AdmissionApplicationTemplate_providerId_name_key" ON "AdmissionApplicationTemplate"("providerId", "name");
CREATE INDEX "AdmissionApplicationTemplate_providerId_isDefaultCampus_idx" ON "AdmissionApplicationTemplate"("providerId", "isDefaultCampus");
CREATE UNIQUE INDEX "AdmissionApplicationTemplateVersion_templateId_version_key" ON "AdmissionApplicationTemplateVersion"("templateId", "version");
CREATE INDEX "AdmissionApplicationTemplateVersion_templateId_status_idx" ON "AdmissionApplicationTemplateVersion"("templateId", "status");
CREATE UNIQUE INDEX "AdmissionDocumentRequirement_templateVersionId_key_key" ON "AdmissionDocumentRequirement"("templateVersionId", "key");
CREATE INDEX "AdmissionDocumentRequirement_templateVersionId_sortOrder_idx" ON "AdmissionDocumentRequirement"("templateVersionId", "sortOrder");
CREATE UNIQUE INDEX "ProgramOfferingApplicationConfig_programOfferingId_key" ON "ProgramOfferingApplicationConfig"("programOfferingId");
CREATE INDEX "ProgramOfferingApplicationConfig_providerId_idx" ON "ProgramOfferingApplicationConfig"("providerId");
CREATE INDEX "ProgramOfferingApplicationConfig_applicationVersionId_idx" ON "ProgramOfferingApplicationConfig"("applicationVersionId");
CREATE UNIQUE INDEX "AdditionalDocumentRequest_submissionId_key_key" ON "AdditionalDocumentRequest"("submissionId", "key");
CREATE INDEX "AdditionalDocumentRequest_providerId_status_idx" ON "AdditionalDocumentRequest"("providerId", "status");
CREATE INDEX "AdditionalDocumentRequest_organizationId_status_idx" ON "AdditionalDocumentRequest"("organizationId", "status");
CREATE INDEX "AdditionalDocumentRequest_submissionId_status_idx" ON "AdditionalDocumentRequest"("submissionId", "status");
CREATE INDEX "OnlineAdmissionSubmission_applicationVersionId_idx" ON "OnlineAdmissionSubmission"("applicationVersionId");
CREATE INDEX "OnlineAdmissionSubmission_providerId_programOfferingId_intent_applicantEmail_idx" ON "OnlineAdmissionSubmission"("providerId", "programOfferingId", "intent", "applicantEmail");
CREATE INDEX "OnlineAdmissionDocumentUpload_additionalDocumentRequestId_idx" ON "OnlineAdmissionDocumentUpload"("additionalDocumentRequestId");

ALTER TABLE "AdmissionApplicationTemplate" ADD CONSTRAINT "AdmissionApplicationTemplate_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdmissionApplicationTemplateVersion" ADD CONSTRAINT "AdmissionApplicationTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AdmissionApplicationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdmissionDocumentRequirement" ADD CONSTRAINT "AdmissionDocumentRequirement_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "AdmissionApplicationTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramOfferingApplicationConfig" ADD CONSTRAINT "ProgramOfferingApplicationConfig_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgramOfferingApplicationConfig" ADD CONSTRAINT "ProgramOfferingApplicationConfig_programOfferingId_fkey" FOREIGN KEY ("programOfferingId") REFERENCES "ProgramOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramOfferingApplicationConfig" ADD CONSTRAINT "ProgramOfferingApplicationConfig_applicationVersionId_fkey" FOREIGN KEY ("applicationVersionId") REFERENCES "AdmissionApplicationTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnlineAdmissionSubmission" ADD CONSTRAINT "OnlineAdmissionSubmission_applicationVersionId_fkey" FOREIGN KEY ("applicationVersionId") REFERENCES "AdmissionApplicationTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnlineAdmissionDocumentUpload" ADD CONSTRAINT "OnlineAdmissionDocumentUpload_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "AdmissionDocumentRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdditionalDocumentRequest" ADD CONSTRAINT "AdditionalDocumentRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdditionalDocumentRequest" ADD CONSTRAINT "AdditionalDocumentRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdditionalDocumentRequest" ADD CONSTRAINT "AdditionalDocumentRequest_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "OnlineAdmissionSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineAdmissionDocumentUpload" ADD CONSTRAINT "OnlineAdmissionDocumentUpload_additionalDocumentRequestId_fkey" FOREIGN KEY ("additionalDocumentRequestId") REFERENCES "AdditionalDocumentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
