CREATE TYPE "ProgramType" AS ENUM (
  'DEGREE',
  'DIPLOMA',
  'CERTIFICATE',
  'COURSE',
  'SHORT_COURSE',
  'BOOTCAMP',
  'WORKSHOP',
  'TUTORING',
  'COACHING',
  'CLASS',
  'OTHER'
);

ALTER TABLE "Program"
  ADD COLUMN "slug" TEXT NOT NULL,
  ADD COLUMN "programType" "ProgramType" NOT NULL,
  ADD COLUMN "subjectArea" TEXT,
  ADD COLUMN "educationLevel" TEXT,
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "languageCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "credentialType" TEXT,
  ADD COLUMN "credentialAwarded" TEXT,
  ADD COLUMN "targetAudience" TEXT,
  ADD COLUMN "learningOutcomes" JSONB,
  ADD COLUMN "entryOverview" TEXT,
  ADD COLUMN "awardingBody" TEXT,
  ADD COLUMN "accreditationSummary" TEXT;

CREATE TABLE "CampusProgramConfiguration" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "configurationVersion" INTEGER NOT NULL DEFAULT 1,
  "structureType" "ProgramStructureType" NOT NULL,
  "progressionMode" "ProgramProgressionMode" NOT NULL,
  "completionMode" "ProgramCompletionMode" NOT NULL,
  "minimumPassingPercentage" DOUBLE PRECISION NOT NULL DEFAULT 50,
  "minimumAttendancePercentage" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampusProgramConfiguration_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Program" DROP CONSTRAINT IF EXISTS "Program_organizationId_fkey";
ALTER TABLE "Program" DROP CONSTRAINT IF EXISTS "Program_departmentId_fkey";

DROP INDEX IF EXISTS "Program_organizationId_code_key";
DROP INDEX IF EXISTS "Program_organizationId_idx";
DROP INDEX IF EXISTS "Program_departmentId_idx";
DROP INDEX IF EXISTS "Program_providerId_idx";
DROP INDEX IF EXISTS "Program_isVisibleForAdmissions_admissionsSortOrder_idx";

ALTER TABLE "Program"
  DROP COLUMN "organizationId",
  DROP COLUMN "departmentId",
  DROP COLUMN "configurationVersion",
  DROP COLUMN "structureType",
  DROP COLUMN "progressionMode",
  DROP COLUMN "completionMode",
  DROP COLUMN "minimumPassingPercentage",
  DROP COLUMN "minimumAttendancePercentage",
  DROP COLUMN "isVisibleForAdmissions",
  DROP COLUMN "admissionsLabel",
  DROP COLUMN "admissionsDescription",
  DROP COLUMN "admissionsSortOrder";

CREATE UNIQUE INDEX "Program_providerId_code_key" ON "Program"("providerId", "code");
CREATE UNIQUE INDEX "Program_providerId_slug_key" ON "Program"("providerId", "slug");
CREATE INDEX "Program_providerId_status_idx" ON "Program"("providerId", "status");
CREATE INDEX "Program_programType_status_idx" ON "Program"("programType", "status");
CREATE INDEX "Program_subjectArea_idx" ON "Program"("subjectArea");

CREATE UNIQUE INDEX "CampusProgramConfiguration_programId_key" ON "CampusProgramConfiguration"("programId");
CREATE INDEX "CampusProgramConfiguration_organizationId_departmentId_idx" ON "CampusProgramConfiguration"("organizationId", "departmentId");
CREATE INDEX "CampusProgramConfiguration_departmentId_idx" ON "CampusProgramConfiguration"("departmentId");

ALTER TABLE "CampusProgramConfiguration" ADD CONSTRAINT "CampusProgramConfiguration_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampusProgramConfiguration" ADD CONSTRAINT "CampusProgramConfiguration_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampusProgramConfiguration" ADD CONSTRAINT "CampusProgramConfiguration_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
