-- AlterTable
ALTER TABLE "FinancialStructureAssignment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "FinancialStructureAssignment_structureId_targetType_entityName_" RENAME TO "FinancialStructureAssignment_structureId_targetType_entityN_key";
