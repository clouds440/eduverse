-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('TEACHER', 'COURSE');

-- CreateTable
CREATE TABLE "EvaluationWindow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "academicCycleId" TEXT NOT NULL,
    "courseId" TEXT,
    "sectionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "EvaluationType" NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT,
    "academicCycleId" TEXT NOT NULL,
    "windowId" TEXT,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "hiddenById" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationWindow_organizationId_idx" ON "EvaluationWindow"("organizationId");
CREATE INDEX "EvaluationWindow_organizationId_isActive_idx" ON "EvaluationWindow"("organizationId", "isActive");
CREATE INDEX "EvaluationWindow_academicCycleId_idx" ON "EvaluationWindow"("academicCycleId");
CREATE INDEX "EvaluationWindow_courseId_idx" ON "EvaluationWindow"("courseId");
CREATE INDEX "EvaluationWindow_sectionId_idx" ON "EvaluationWindow"("sectionId");
CREATE INDEX "EvaluationWindow_startDate_endDate_idx" ON "EvaluationWindow"("startDate", "endDate");

CREATE UNIQUE INDEX "Evaluation_teacher_once_per_section_cycle_key" ON "Evaluation"("studentId", "teacherId", "sectionId", "academicCycleId") WHERE "type" = 'TEACHER' AND "teacherId" IS NOT NULL;
CREATE UNIQUE INDEX "Evaluation_course_once_per_section_cycle_key" ON "Evaluation"("studentId", "courseId", "sectionId", "academicCycleId") WHERE "type" = 'COURSE';
CREATE INDEX "Evaluation_organizationId_idx" ON "Evaluation"("organizationId");
CREATE INDEX "Evaluation_type_idx" ON "Evaluation"("type");
CREATE INDEX "Evaluation_studentId_idx" ON "Evaluation"("studentId");
CREATE INDEX "Evaluation_teacherId_idx" ON "Evaluation"("teacherId");
CREATE INDEX "Evaluation_courseId_idx" ON "Evaluation"("courseId");
CREATE INDEX "Evaluation_sectionId_idx" ON "Evaluation"("sectionId");
CREATE INDEX "Evaluation_academicCycleId_idx" ON "Evaluation"("academicCycleId");
CREATE INDEX "Evaluation_windowId_idx" ON "Evaluation"("windowId");
CREATE INDEX "Evaluation_isHidden_idx" ON "Evaluation"("isHidden");

-- AddForeignKey
ALTER TABLE "EvaluationWindow" ADD CONSTRAINT "EvaluationWindow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationWindow" ADD CONSTRAINT "EvaluationWindow_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationWindow" ADD CONSTRAINT "EvaluationWindow_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationWindow" ADD CONSTRAINT "EvaluationWindow_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationWindow" ADD CONSTRAINT "EvaluationWindow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationWindow" ADD CONSTRAINT "EvaluationWindow_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "EvaluationWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
