/*
  Warnings:

  - You are about to drop the column `semester` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `fee` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `feePlan` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `salary` on the `Teacher` table. All the data in the column will be lost.
  - Made the column `academicCycleId` on table `Section` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "FinanceCategory" AS ENUM ('TUITION', 'TRANSPORT', 'LIBRARY', 'EXAM', 'SALARY', 'BONUS', 'ADMISSION', 'HOSTEL', 'ACTIVITY', 'REIMBURSEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('ONCE', 'MONTHLY', 'SEMESTER', 'YEARLY', 'ACADEMIC_CYCLE');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PENDING', 'UNVERIFIED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('SYSTEM', 'MANUAL');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- DropForeignKey
ALTER TABLE "Section" DROP CONSTRAINT "Section_academicCycleId_fkey";

-- AlterTable
ALTER TABLE "ChatParticipant" ADD COLUMN     "clearedAt" TIMESTAMP(3),
ADD COLUMN     "hiddenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Section" DROP COLUMN "semester",
DROP COLUMN "year",
ALTER COLUMN "academicCycleId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "fee",
DROP COLUMN "feePlan";

-- AlterTable
ALTER TABLE "Teacher" DROP COLUMN "salary";

-- CreateTable
CREATE TABLE "FinancialStructure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "studentId" TEXT,
    "teacherId" TEXT,
    "category" "FinanceCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" "BillingCycle" NOT NULL,
    "dueDay" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "structureId" TEXT,
    "title" TEXT NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "markedByUser" BOOLEAN NOT NULL DEFAULT false,
    "markedAt" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "paymentMethod" TEXT,
    "confirmedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "source" "EntrySource" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" "FinanceCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "relatedEntryId" TEXT,
    "paymentMethod" TEXT,
    "referenceNumber" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialStructure_organizationId_idx" ON "FinancialStructure"("organizationId");

-- CreateIndex
CREATE INDEX "FinancialStructure_studentId_idx" ON "FinancialStructure"("studentId");

-- CreateIndex
CREATE INDEX "FinancialStructure_teacherId_idx" ON "FinancialStructure"("teacherId");

-- CreateIndex
CREATE INDEX "FinancialStructure_isActive_idx" ON "FinancialStructure"("isActive");

-- CreateIndex
CREATE INDEX "FinancialEntry_organizationId_idx" ON "FinancialEntry"("organizationId");

-- CreateIndex
CREATE INDEX "FinancialEntry_studentId_idx" ON "FinancialEntry"("studentId");

-- CreateIndex
CREATE INDEX "FinancialEntry_teacherId_idx" ON "FinancialEntry"("teacherId");

-- CreateIndex
CREATE INDEX "FinancialEntry_status_idx" ON "FinancialEntry"("status");

-- CreateIndex
CREATE INDEX "FinancialEntry_dueDate_idx" ON "FinancialEntry"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEntry_structureId_periodStart_periodEnd_key" ON "FinancialEntry"("structureId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_idx" ON "Transaction"("organizationId");

-- CreateIndex
CREATE INDEX "Transaction_relatedEntryId_idx" ON "Transaction"("relatedEntryId");

-- CreateIndex
CREATE INDEX "Transaction_createdById_idx" ON "Transaction"("createdById");

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructure" ADD CONSTRAINT "FinancialStructure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructure" ADD CONSTRAINT "FinancialStructure_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructure" ADD CONSTRAINT "FinancialStructure_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "FinancialStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_relatedEntryId_fkey" FOREIGN KEY ("relatedEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
