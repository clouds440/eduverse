-- Clean ownership foundation for an empty database. Provider-owned records require a provider from first write.
CREATE TYPE "EducationProviderKind" AS ENUM ('INSTITUTION', 'ACADEMY', 'TRAINING_PROVIDER', 'ONLINE_PROVIDER', 'EDUCATOR', 'OTHER');
CREATE TYPE "EducationProviderStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "EducationProviderRole" AS ENUM ('OWNER', 'ADMIN', 'PROGRAM_MANAGER', 'ADMISSIONS_MANAGER', 'REVIEWER', 'VIEWER');
CREATE TYPE "EducationProviderMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

CREATE TABLE "EducationProvider" (
    "id" TEXT NOT NULL,
    "kind" "EducationProviderKind" NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "EducationProviderStatus" NOT NULL DEFAULT 'DRAFT',
    "campusOrganizationId" TEXT,
    "defaultCurrency" TEXT,
    "timezone" TEXT,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EducationProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EducationProviderMembership" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EducationProviderRole" NOT NULL,
    "status" "EducationProviderMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EducationProviderMembership_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Program" ADD COLUMN "providerId" TEXT NOT NULL;
ALTER TABLE "ProgramOffering" ADD COLUMN "providerId" TEXT NOT NULL;
ALTER TABLE "OnlineAdmissionDocumentRequirement" ADD COLUMN "providerId" TEXT NOT NULL;
ALTER TABLE "OnlineAdmissionSubmission" ADD COLUMN "providerId" TEXT NOT NULL;
ALTER TABLE "OnlineAdmissionDocumentUpload" ADD COLUMN "providerId" TEXT NOT NULL;
ALTER TABLE "File" ADD COLUMN "providerId" TEXT;

CREATE UNIQUE INDEX "EducationProvider_slug_key" ON "EducationProvider"("slug");
CREATE UNIQUE INDEX "EducationProvider_campusOrganizationId_key" ON "EducationProvider"("campusOrganizationId");
CREATE INDEX "EducationProvider_status_idx" ON "EducationProvider"("status");
CREATE INDEX "EducationProvider_kind_idx" ON "EducationProvider"("kind");
CREATE UNIQUE INDEX "EducationProviderMembership_providerId_userId_key" ON "EducationProviderMembership"("providerId", "userId");
CREATE INDEX "EducationProviderMembership_userId_status_idx" ON "EducationProviderMembership"("userId", "status");
CREATE INDEX "EducationProviderMembership_providerId_role_status_idx" ON "EducationProviderMembership"("providerId", "role", "status");
CREATE INDEX "Program_providerId_idx" ON "Program"("providerId");
CREATE INDEX "ProgramOffering_providerId_idx" ON "ProgramOffering"("providerId");
CREATE INDEX "OnlineAdmissionDocumentRequirement_providerId_idx" ON "OnlineAdmissionDocumentRequirement"("providerId");
CREATE INDEX "OnlineAdmissionSubmission_providerId_status_submittedAt_idx" ON "OnlineAdmissionSubmission"("providerId", "status", "submittedAt");
CREATE INDEX "OnlineAdmissionDocumentUpload_providerId_idx" ON "OnlineAdmissionDocumentUpload"("providerId");
CREATE INDEX "File_providerId_entityType_entityId_idx" ON "File"("providerId", "entityType", "entityId");

ALTER TABLE "EducationProvider" ADD CONSTRAINT "EducationProvider_campusOrganizationId_fkey"
  FOREIGN KEY ("campusOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EducationProviderMembership" ADD CONSTRAINT "EducationProviderMembership_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EducationProviderMembership" ADD CONSTRAINT "EducationProviderMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Program" ADD CONSTRAINT "Program_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgramOffering" ADD CONSTRAINT "ProgramOffering_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnlineAdmissionDocumentRequirement" ADD CONSTRAINT "OnlineAdmissionDocumentRequirement_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnlineAdmissionSubmission" ADD CONSTRAINT "OnlineAdmissionSubmission_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnlineAdmissionDocumentUpload" ADD CONSTRAINT "OnlineAdmissionDocumentUpload_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "File" ADD CONSTRAINT "File_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
