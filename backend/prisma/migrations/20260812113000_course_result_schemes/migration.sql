-- CreateEnum
CREATE TYPE "CourseResultComponentType" AS ENUM ('THEORY', 'LAB', 'PRACTICAL', 'TUTORIAL', 'RECITATION', 'CLINIC', 'STUDIO', 'FIELDWORK', 'OTHER');

-- AlterTable
ALTER TABLE "Section" ADD COLUMN "componentType" "CourseResultComponentType" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "CourseResultScheme" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "academicCycleId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Section Result Relationship',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseResultScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseResultComponent" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "componentType" "CourseResultComponentType" NOT NULL,
    "label" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseResultComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseResultComponentSection" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseResultComponentSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseResultScheme_organizationId_courseId_academicCycleId_key" ON "CourseResultScheme"("organizationId", "courseId", "academicCycleId");

-- CreateIndex
CREATE INDEX "CourseResultScheme_organizationId_idx" ON "CourseResultScheme"("organizationId");

-- CreateIndex
CREATE INDEX "CourseResultScheme_courseId_idx" ON "CourseResultScheme"("courseId");

-- CreateIndex
CREATE INDEX "CourseResultScheme_academicCycleId_idx" ON "CourseResultScheme"("academicCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseResultComponent_schemeId_componentType_key" ON "CourseResultComponent"("schemeId", "componentType");

-- CreateIndex
CREATE INDEX "CourseResultComponent_schemeId_idx" ON "CourseResultComponent"("schemeId");

-- CreateIndex
CREATE INDEX "CourseResultComponent_componentType_idx" ON "CourseResultComponent"("componentType");

-- CreateIndex
CREATE UNIQUE INDEX "CourseResultComponentSection_componentId_sectionId_key" ON "CourseResultComponentSection"("componentId", "sectionId");

-- CreateIndex
CREATE INDEX "CourseResultComponentSection_sectionId_idx" ON "CourseResultComponentSection"("sectionId");

-- AddForeignKey
ALTER TABLE "CourseResultScheme" ADD CONSTRAINT "CourseResultScheme_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResultScheme" ADD CONSTRAINT "CourseResultScheme_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResultScheme" ADD CONSTRAINT "CourseResultScheme_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResultComponent" ADD CONSTRAINT "CourseResultComponent_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "CourseResultScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResultComponentSection" ADD CONSTRAINT "CourseResultComponentSection_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CourseResultComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResultComponentSection" ADD CONSTRAINT "CourseResultComponentSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
