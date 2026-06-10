-- CreateEnum
CREATE TYPE "FinanceTargetType" AS ENUM ('STUDENT', 'TEACHER', 'OTHER_INCOME', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceAssignmentSource" AS ENUM ('MANUAL', 'SECTION', 'COHORT', 'COURSE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentClaimStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- AlterTable
ALTER TABLE "FinancialStructure"
ADD COLUMN "targetType" "FinanceTargetType" NOT NULL DEFAULT 'STUDENT';

-- AlterTable
ALTER TABLE "FinancialEntry"
ADD COLUMN "assignmentId" TEXT;

-- CreateTable
CREATE TABLE "FinancialStructureAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "targetType" "FinanceTargetType" NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "entityName" TEXT,
    "sourceType" "FinanceAssignmentSource" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialStructureAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentClaim" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "claimedAmount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT,
    "referenceNumber" TEXT,
    "receiptUrl" TEXT,
    "note" TEXT,
    "status" "PaymentClaimStatus" NOT NULL DEFAULT 'PENDING',
    "claimedById" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "confirmedAmount" DOUBLE PRECISION,
    "rejectionReason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "PaymentClaim_pkey" PRIMARY KEY ("id")
);

-- Drop old per-structure-period uniqueness before replacing with assignment-aware uniqueness.
DROP INDEX IF EXISTS "FinancialEntry_structureId_periodStart_periodEnd_key";

-- CreateIndex
CREATE INDEX "FinancialStructure_targetType_idx" ON "FinancialStructure"("targetType");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_organizationId_idx" ON "FinancialStructureAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_structureId_idx" ON "FinancialStructureAssignment"("structureId");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_targetType_idx" ON "FinancialStructureAssignment"("targetType");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_studentId_idx" ON "FinancialStructureAssignment"("studentId");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_teacherId_idx" ON "FinancialStructureAssignment"("teacherId");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_sourceType_idx" ON "FinancialStructureAssignment"("sourceType");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_isActive_idx" ON "FinancialStructureAssignment"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialStructureAssignment_structureId_studentId_key" 
ON "FinancialStructureAssignment"("structureId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialStructureAssignment_structureId_teacherId_key" 
ON "FinancialStructureAssignment"("structureId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialStructureAssignment_structureId_targetType_entityName_key" 
ON "FinancialStructureAssignment"("structureId", "targetType", "entityName");

-- CreateIndex
CREATE INDEX "FinancialEntry_assignmentId_idx" ON "FinancialEntry"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEntry_assignmentId_periodStart_periodEnd_key" 
ON "FinancialEntry"("assignmentId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PaymentClaim_organizationId_idx" ON "PaymentClaim"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentClaim_entryId_idx" ON "PaymentClaim"("entryId");

-- CreateIndex
CREATE INDEX "PaymentClaim_claimedById_idx" ON "PaymentClaim"("claimedById");

-- CreateIndex
CREATE INDEX "PaymentClaim_reviewedById_idx" ON "PaymentClaim"("reviewedById");

-- CreateIndex
CREATE INDEX "PaymentClaim_status_idx" ON "PaymentClaim"("status");

-- CreateIndex
CREATE INDEX "PaymentClaim_claimedAt_idx" ON "PaymentClaim"("claimedAt");

-- AddForeignKey
ALTER TABLE "FinancialStructureAssignment" 
ADD CONSTRAINT "FinancialStructureAssignment_organizationId_fkey" 
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructureAssignment" 
ADD CONSTRAINT "FinancialStructureAssignment_structureId_fkey" 
FOREIGN KEY ("structureId") REFERENCES "FinancialStructure"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructureAssignment" 
ADD CONSTRAINT "FinancialStructureAssignment_studentId_fkey" 
FOREIGN KEY ("studentId") REFERENCES "Student"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructureAssignment" 
ADD CONSTRAINT "FinancialStructureAssignment_teacherId_fkey" 
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" 
ADD CONSTRAINT "FinancialEntry_assignmentId_fkey" 
FOREIGN KEY ("assignmentId") REFERENCES "FinancialStructureAssignment"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" 
ADD CONSTRAINT "PaymentClaim_organizationId_fkey" 
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" 
ADD CONSTRAINT "PaymentClaim_entryId_fkey" 
FOREIGN KEY ("entryId") REFERENCES "FinancialEntry"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" 
ADD CONSTRAINT "PaymentClaim_claimedById_fkey" 
FOREIGN KEY ("claimedById") REFERENCES "User"("id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" 
ADD CONSTRAINT "PaymentClaim_reviewedById_fkey" 
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;