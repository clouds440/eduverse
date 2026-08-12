-- Section transfer accommodations: transcript exclusions, assessment exemptions,
-- and auditable percentage-based attendance adjustments.

CREATE TYPE "AttendanceRecordSource" AS ENUM ('MANUAL', 'TRANSFER_PERCENTAGE');

ALTER TABLE "AttendanceRecord"
ADD COLUMN "source" "AttendanceRecordSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "note" TEXT,
ADD COLUMN "transferredFromSectionId" TEXT,
ADD COLUMN "transferredFromAttendancePercent" DOUBLE PRECISION,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "AssessmentExemption" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicCycleId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'TRANSFER',
    "sourceSectionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentExemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessmentExemption_assessmentId_studentId_key" ON "AssessmentExemption"("assessmentId", "studentId");
CREATE INDEX "AssessmentExemption_studentId_idx" ON "AssessmentExemption"("studentId");
CREATE INDEX "AssessmentExemption_academicCycleId_idx" ON "AssessmentExemption"("academicCycleId");
CREATE INDEX "AssessmentExemption_sourceSectionId_idx" ON "AssessmentExemption"("sourceSectionId");
CREATE INDEX "AttendanceRecord_source_idx" ON "AttendanceRecord"("source");
CREATE INDEX "AttendanceRecord_transferredFromSectionId_idx" ON "AttendanceRecord"("transferredFromSectionId");

ALTER TABLE "AttendanceRecord"
ADD CONSTRAINT "AttendanceRecord_transferredFromSectionId_fkey"
FOREIGN KEY ("transferredFromSectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssessmentExemption"
ADD CONSTRAINT "AssessmentExemption_assessmentId_fkey"
FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssessmentExemption"
ADD CONSTRAINT "AssessmentExemption_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssessmentExemption"
ADD CONSTRAINT "AssessmentExemption_academicCycleId_fkey"
FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentExemption"
ADD CONSTRAINT "AssessmentExemption_sourceSectionId_fkey"
FOREIGN KEY ("sourceSectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
