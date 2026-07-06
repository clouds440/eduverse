-- AlterEnum
ALTER TYPE "TargetType" ADD VALUE IF NOT EXISTS 'COURSE';
ALTER TYPE "TargetType" ADD VALUE IF NOT EXISTS 'COHORT';

-- CreateEnum
CREATE TYPE "PreferenceWindowKind" AS ENUM ('SECTION_CHOICE', 'COURSE_CHOICE');

-- CreateEnum
CREATE TYPE "PreferenceWindowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PreferenceTargetType" AS ENUM ('COURSE', 'COHORT', 'SECTION');

-- CreateTable
CREATE TABLE "PreferenceWindow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "academicCycleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "PreferenceWindowKind" NOT NULL,
    "status" "PreferenceWindowStatus" NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "announcementId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceWindowOption" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "targetType" "PreferenceTargetType" NOT NULL,
    "courseId" TEXT,
    "sectionId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PreferenceWindowOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceWindowAudience" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "targetType" "PreferenceTargetType" NOT NULL,
    "courseId" TEXT,
    "cohortId" TEXT,
    "sectionId" TEXT,

    CONSTRAINT "PreferenceWindowAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceSubmission" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenceSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceRank" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "PreferenceRank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreferenceWindow_organizationId_idx" ON "PreferenceWindow"("organizationId");
CREATE INDEX "PreferenceWindow_academicCycleId_idx" ON "PreferenceWindow"("academicCycleId");
CREATE INDEX "PreferenceWindow_kind_idx" ON "PreferenceWindow"("kind");
CREATE INDEX "PreferenceWindow_status_idx" ON "PreferenceWindow"("status");
CREATE INDEX "PreferenceWindow_startAt_endAt_idx" ON "PreferenceWindow"("startAt", "endAt");
CREATE INDEX "PreferenceWindow_announcementId_idx" ON "PreferenceWindow"("announcementId");

-- CreateIndex
CREATE INDEX "PreferenceWindowOption_windowId_idx" ON "PreferenceWindowOption"("windowId");
CREATE INDEX "PreferenceWindowOption_courseId_idx" ON "PreferenceWindowOption"("courseId");
CREATE INDEX "PreferenceWindowOption_sectionId_idx" ON "PreferenceWindowOption"("sectionId");
CREATE UNIQUE INDEX "PreferenceWindowOption_windowId_courseId_key" ON "PreferenceWindowOption"("windowId", "courseId");
CREATE UNIQUE INDEX "PreferenceWindowOption_windowId_sectionId_key" ON "PreferenceWindowOption"("windowId", "sectionId");

-- CreateIndex
CREATE INDEX "PreferenceWindowAudience_windowId_idx" ON "PreferenceWindowAudience"("windowId");
CREATE INDEX "PreferenceWindowAudience_courseId_idx" ON "PreferenceWindowAudience"("courseId");
CREATE INDEX "PreferenceWindowAudience_cohortId_idx" ON "PreferenceWindowAudience"("cohortId");
CREATE INDEX "PreferenceWindowAudience_sectionId_idx" ON "PreferenceWindowAudience"("sectionId");
CREATE UNIQUE INDEX "PreferenceWindowAudience_windowId_courseId_key" ON "PreferenceWindowAudience"("windowId", "courseId");
CREATE UNIQUE INDEX "PreferenceWindowAudience_windowId_cohortId_key" ON "PreferenceWindowAudience"("windowId", "cohortId");
CREATE UNIQUE INDEX "PreferenceWindowAudience_windowId_sectionId_key" ON "PreferenceWindowAudience"("windowId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceSubmission_windowId_studentId_key" ON "PreferenceSubmission"("windowId", "studentId");
CREATE INDEX "PreferenceSubmission_windowId_idx" ON "PreferenceSubmission"("windowId");
CREATE INDEX "PreferenceSubmission_studentId_idx" ON "PreferenceSubmission"("studentId");
CREATE INDEX "PreferenceSubmission_submittedById_idx" ON "PreferenceSubmission"("submittedById");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceRank_submissionId_optionId_key" ON "PreferenceRank"("submissionId", "optionId");
CREATE UNIQUE INDEX "PreferenceRank_submissionId_rank_key" ON "PreferenceRank"("submissionId", "rank");
CREATE INDEX "PreferenceRank_optionId_idx" ON "PreferenceRank"("optionId");

-- AddForeignKey
ALTER TABLE "PreferenceWindow" ADD CONSTRAINT "PreferenceWindow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreferenceWindow" ADD CONSTRAINT "PreferenceWindow_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreferenceWindow" ADD CONSTRAINT "PreferenceWindow_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PreferenceWindow" ADD CONSTRAINT "PreferenceWindow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PreferenceWindow" ADD CONSTRAINT "PreferenceWindow_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindowOption" ADD CONSTRAINT "PreferenceWindowOption_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "PreferenceWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreferenceWindowOption" ADD CONSTRAINT "PreferenceWindowOption_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreferenceWindowOption" ADD CONSTRAINT "PreferenceWindowOption_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindowAudience" ADD CONSTRAINT "PreferenceWindowAudience_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "PreferenceWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreferenceWindowAudience" ADD CONSTRAINT "PreferenceWindowAudience_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreferenceWindowAudience" ADD CONSTRAINT "PreferenceWindowAudience_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreferenceWindowAudience" ADD CONSTRAINT "PreferenceWindowAudience_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceSubmission" ADD CONSTRAINT "PreferenceSubmission_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "PreferenceWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreferenceSubmission" ADD CONSTRAINT "PreferenceSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreferenceSubmission" ADD CONSTRAINT "PreferenceSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceRank" ADD CONSTRAINT "PreferenceRank_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "PreferenceSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreferenceRank" ADD CONSTRAINT "PreferenceRank_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PreferenceWindowOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
