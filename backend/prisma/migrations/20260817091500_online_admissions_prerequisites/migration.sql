-- CreateEnum
CREATE TYPE "OnlineAdmissionSubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_UPDATE', 'ACCEPTED', 'ADMITTED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "onlineAdmissionsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProgramOffering" ADD COLUMN "onlineAdmissionEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "onlineAdmissionInstructions" TEXT;

-- CreateTable
CREATE TABLE "OnlineAdmissionDocumentRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programOfferingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "acceptedMimeTypes" JSONB,
    "maxFileSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineAdmissionDocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineAdmissionSubmission" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "programOfferingId" TEXT NOT NULL,
    "academicCycleId" TEXT NOT NULL,
    "status" "OnlineAdmissionSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "applicantEmail" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "applicantPhone" TEXT,
    "formData" JSONB NOT NULL,
    "sourceIpHash" TEXT,
    "userAgent" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "admittedStudentId" TEXT,

    CONSTRAINT "OnlineAdmissionSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineAdmissionDocumentUpload" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "labelSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineAdmissionDocumentUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineAdmissionStatusEvent" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fromStatus" "OnlineAdmissionSubmissionStatus",
    "toStatus" "OnlineAdmissionSubmissionStatus" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineAdmissionStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramOffering_onlineAdmissionEnabled_status_idx" ON "ProgramOffering"("onlineAdmissionEnabled", "status");

-- CreateIndex
CREATE INDEX "OnlineAdmissionDocumentRequirement_organizationId_idx" ON "OnlineAdmissionDocumentRequirement"("organizationId");

-- CreateIndex
CREATE INDEX "OnlineAdmissionDocumentRequirement_programOfferingId_sortOrder_idx" ON "OnlineAdmissionDocumentRequirement"("programOfferingId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineAdmissionSubmission_publicReference_key" ON "OnlineAdmissionSubmission"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineAdmissionSubmission_admittedStudentId_key" ON "OnlineAdmissionSubmission"("admittedStudentId");

-- CreateIndex
CREATE INDEX "OnlineAdmissionSubmission_organizationId_status_submittedAt_idx" ON "OnlineAdmissionSubmission"("organizationId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "OnlineAdmissionSubmission_departmentId_status_idx" ON "OnlineAdmissionSubmission"("departmentId", "status");

-- CreateIndex
CREATE INDEX "OnlineAdmissionSubmission_programId_status_idx" ON "OnlineAdmissionSubmission"("programId", "status");

-- CreateIndex
CREATE INDEX "OnlineAdmissionSubmission_programOfferingId_status_idx" ON "OnlineAdmissionSubmission"("programOfferingId", "status");

-- CreateIndex
CREATE INDEX "OnlineAdmissionSubmission_academicCycleId_status_idx" ON "OnlineAdmissionSubmission"("academicCycleId", "status");

-- CreateIndex
CREATE INDEX "OnlineAdmissionSubmission_applicantEmail_idx" ON "OnlineAdmissionSubmission"("applicantEmail");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineAdmissionDocumentUpload_fileId_key" ON "OnlineAdmissionDocumentUpload"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineAdmissionDocumentUpload_submissionId_requirementId_key" ON "OnlineAdmissionDocumentUpload"("submissionId", "requirementId");

-- CreateIndex
CREATE INDEX "OnlineAdmissionDocumentUpload_organizationId_idx" ON "OnlineAdmissionDocumentUpload"("organizationId");

-- CreateIndex
CREATE INDEX "OnlineAdmissionDocumentUpload_requirementId_idx" ON "OnlineAdmissionDocumentUpload"("requirementId");

-- CreateIndex
CREATE INDEX "OnlineAdmissionStatusEvent_submissionId_createdAt_idx" ON "OnlineAdmissionStatusEvent"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "OnlineAdmissionStatusEvent_actorUserId_idx" ON "OnlineAdmissionStatusEvent"("actorUserId");

-- AddForeignKey
ALTER TABLE "OnlineAdmissionDocumentRequirement" ADD CONSTRAINT "OnlineAdmissionDocumentRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionDocumentRequirement" ADD CONSTRAINT "OnlineAdmissionDocumentRequirement_programOfferingId_fkey" FOREIGN KEY ("programOfferingId") REFERENCES "ProgramOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionSubmission" ADD CONSTRAINT "OnlineAdmissionSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionSubmission" ADD CONSTRAINT "OnlineAdmissionSubmission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionSubmission" ADD CONSTRAINT "OnlineAdmissionSubmission_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionSubmission" ADD CONSTRAINT "OnlineAdmissionSubmission_programOfferingId_fkey" FOREIGN KEY ("programOfferingId") REFERENCES "ProgramOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionSubmission" ADD CONSTRAINT "OnlineAdmissionSubmission_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionSubmission" ADD CONSTRAINT "OnlineAdmissionSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionSubmission" ADD CONSTRAINT "OnlineAdmissionSubmission_admittedStudentId_fkey" FOREIGN KEY ("admittedStudentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionDocumentUpload" ADD CONSTRAINT "OnlineAdmissionDocumentUpload_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionDocumentUpload" ADD CONSTRAINT "OnlineAdmissionDocumentUpload_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "OnlineAdmissionSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionDocumentUpload" ADD CONSTRAINT "OnlineAdmissionDocumentUpload_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "OnlineAdmissionDocumentRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionDocumentUpload" ADD CONSTRAINT "OnlineAdmissionDocumentUpload_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionStatusEvent" ADD CONSTRAINT "OnlineAdmissionStatusEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "OnlineAdmissionSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineAdmissionStatusEvent" ADD CONSTRAINT "OnlineAdmissionStatusEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
