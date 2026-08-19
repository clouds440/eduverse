ALTER TYPE "ProgramOfferingStatus" ADD VALUE 'PUBLISHED' AFTER 'DRAFT';
ALTER TYPE "ProgramOfferingStatus" ADD VALUE 'ARCHIVED' AFTER 'CANCELLED';

CREATE TYPE "ProgramOfferingDeliveryMode" AS ENUM ('ON_CAMPUS', 'ONLINE', 'HYBRID', 'FLEXIBLE');
CREATE TYPE "ProgramOfferingAttendanceMode" AS ENUM ('FULL_TIME', 'PART_TIME', 'SELF_PACED', 'SCHEDULED', 'OTHER');
CREATE TYPE "ProgramOfferingAction" AS ENUM ('APPLY', 'ENROLL_INTEREST', 'REQUEST_INFO');

ALTER TABLE "ProgramOffering" DROP CONSTRAINT IF EXISTS "ProgramOffering_organizationId_fkey";
ALTER TABLE "ProgramOffering" DROP CONSTRAINT IF EXISTS "ProgramOffering_curriculumVersionId_fkey";
ALTER TABLE "ProgramOffering" DROP CONSTRAINT IF EXISTS "ProgramOffering_academicCycleId_fkey";

DROP INDEX IF EXISTS "ProgramOffering_programId_curriculumVersionId_academicCycleId_key";
DROP INDEX IF EXISTS "ProgramOffering_organizationId_idx";
DROP INDEX IF EXISTS "ProgramOffering_academicCycleId_status_idx";

ALTER TABLE "ProgramOffering"
  ADD COLUMN "code" TEXT NOT NULL,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "intakeName" TEXT NOT NULL,
  ADD COLUMN "applicationOpensAt" TIMESTAMP(3),
  ADD COLUMN "applicationClosesAt" TIMESTAMP(3),
  ADD COLUMN "teachingStartsAt" TIMESTAMP(3),
  ADD COLUMN "teachingEndsAt" TIMESTAMP(3),
  ADD COLUMN "timezone" TEXT NOT NULL,
  ADD COLUMN "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryMode" "ProgramOfferingDeliveryMode" NOT NULL,
  ADD COLUMN "attendanceMode" "ProgramOfferingAttendanceMode" NOT NULL,
  ADD COLUMN "scheduleSummary" TEXT,
  ADD COLUMN "durationValue" INTEGER,
  ADD COLUMN "durationUnit" "ProgramDurationUnit",
  ADD COLUMN "languageCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "publicSummary" TEXT,
  ADD COLUMN "detailedInstructions" TEXT,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "supportedActions" "ProgramOfferingAction"[] NOT NULL DEFAULT ARRAY['APPLY']::"ProgramOfferingAction"[],
  DROP COLUMN "organizationId",
  DROP COLUMN "curriculumVersionId",
  DROP COLUMN "academicCycleId",
  DROP COLUMN "opensAt",
  DROP COLUMN "closesAt";

CREATE TABLE "CampusProgramOfferingBinding" (
  "id" TEXT NOT NULL,
  "programOfferingId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "academicCycleId" TEXT NOT NULL,
  "curriculumVersionId" TEXT NOT NULL,
  "readinessMetadata" JSONB,
  "readinessCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampusProgramOfferingBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderLocation" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "displayLabel" TEXT NOT NULL,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "region" TEXT,
  "countryCode" TEXT,
  "postalCode" TEXT,
  "latitude" DECIMAL(65,30),
  "longitude" DECIMAL(65,30),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramOfferingLocation" (
  "programOfferingId" TEXT NOT NULL,
  "providerLocationId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  CONSTRAINT "ProgramOfferingLocation_pkey" PRIMARY KEY ("programOfferingId", "providerLocationId")
);

CREATE UNIQUE INDEX "ProgramOffering_providerId_code_key" ON "ProgramOffering"("providerId", "code");
CREATE UNIQUE INDEX "ProgramOffering_providerId_slug_key" ON "ProgramOffering"("providerId", "slug");
CREATE INDEX "ProgramOffering_deliveryMode_status_idx" ON "ProgramOffering"("deliveryMode", "status");
CREATE UNIQUE INDEX "CampusProgramOfferingBinding_programOfferingId_key" ON "CampusProgramOfferingBinding"("programOfferingId");
CREATE UNIQUE INDEX "CampusProgramOfferingBinding_curriculumVersionId_academicCycleId_key" ON "CampusProgramOfferingBinding"("curriculumVersionId", "academicCycleId");
CREATE INDEX "CampusProgramOfferingBinding_organizationId_academicCycleId_idx" ON "CampusProgramOfferingBinding"("organizationId", "academicCycleId");
CREATE INDEX "CampusProgramOfferingBinding_academicCycleId_idx" ON "CampusProgramOfferingBinding"("academicCycleId");
CREATE UNIQUE INDEX "ProviderLocation_providerId_name_key" ON "ProviderLocation"("providerId", "name");
CREATE UNIQUE INDEX "ProviderLocation_providerId_code_key" ON "ProviderLocation"("providerId", "code");
CREATE INDEX "ProviderLocation_providerId_isActive_idx" ON "ProviderLocation"("providerId", "isActive");
CREATE INDEX "ProviderLocation_countryCode_city_idx" ON "ProviderLocation"("countryCode", "city");
CREATE INDEX "ProgramOfferingLocation_providerLocationId_idx" ON "ProgramOfferingLocation"("providerLocationId");

ALTER TABLE "CampusProgramOfferingBinding" ADD CONSTRAINT "CampusProgramOfferingBinding_programOfferingId_fkey"
  FOREIGN KEY ("programOfferingId") REFERENCES "ProgramOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampusProgramOfferingBinding" ADD CONSTRAINT "CampusProgramOfferingBinding_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampusProgramOfferingBinding" ADD CONSTRAINT "CampusProgramOfferingBinding_academicCycleId_fkey"
  FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampusProgramOfferingBinding" ADD CONSTRAINT "CampusProgramOfferingBinding_curriculumVersionId_fkey"
  FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderLocation" ADD CONSTRAINT "ProviderLocation_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "EducationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramOfferingLocation" ADD CONSTRAINT "ProgramOfferingLocation_programOfferingId_fkey"
  FOREIGN KEY ("programOfferingId") REFERENCES "ProgramOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramOfferingLocation" ADD CONSTRAINT "ProgramOfferingLocation_providerLocationId_fkey"
  FOREIGN KEY ("providerLocationId") REFERENCES "ProviderLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
