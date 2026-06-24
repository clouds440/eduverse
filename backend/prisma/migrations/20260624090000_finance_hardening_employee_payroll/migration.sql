-- Finance hardening: exact money, employee payroll targets, and finance audit links.

ALTER TYPE "FinanceTargetType" ADD VALUE IF NOT EXISTS 'SUB_ADMIN';
ALTER TYPE "FinanceTargetType" ADD VALUE IF NOT EXISTS 'FINANCE_MANAGER';

ALTER TABLE "FinancialStructure"
  ADD COLUMN IF NOT EXISTS "employeeUserId" TEXT,
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "FinancialStructureAssignment"
  ADD COLUMN IF NOT EXISTS "employeeUserId" TEXT;

ALTER TABLE "FinancialEntry"
  ADD COLUMN IF NOT EXISTS "employeeUserId" TEXT,
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2),
  ALTER COLUMN "paidAmount" TYPE DECIMAL(12,2) USING ROUND("paidAmount"::numeric, 2),
  ALTER COLUMN "amount" SET DEFAULT 0.00,
  ALTER COLUMN "paidAmount" SET DEFAULT 0.00;

ALTER TABLE "PaymentClaim"
  ALTER COLUMN "claimedAmount" TYPE DECIMAL(12,2) USING ROUND("claimedAmount"::numeric, 2),
  ALTER COLUMN "confirmedAmount" TYPE DECIMAL(12,2) USING ROUND("confirmedAmount"::numeric, 2);

ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "module" TEXT,
  ADD COLUMN IF NOT EXISTS "resourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "resourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "financeStructureId" TEXT,
  ADD COLUMN IF NOT EXISTS "financeEntryId" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentClaimId" TEXT,
  ADD COLUMN IF NOT EXISTS "transactionId" TEXT;

CREATE INDEX IF NOT EXISTS "FinancialStructure_employeeUserId_idx" ON "FinancialStructure"("employeeUserId");
CREATE INDEX IF NOT EXISTS "FinancialStructureAssignment_employeeUserId_idx" ON "FinancialStructureAssignment"("employeeUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialStructureAssignment_structureId_employeeUserId_key" ON "FinancialStructureAssignment"("structureId", "employeeUserId");
CREATE INDEX IF NOT EXISTS "FinancialEntry_employeeUserId_idx" ON "FinancialEntry"("employeeUserId");

CREATE INDEX IF NOT EXISTS "AuditLog_module_idx" ON "AuditLog"("module");
CREATE INDEX IF NOT EXISTS "AuditLog_resourceType_idx" ON "AuditLog"("resourceType");
CREATE INDEX IF NOT EXISTS "AuditLog_resourceId_idx" ON "AuditLog"("resourceId");
CREATE INDEX IF NOT EXISTS "AuditLog_financeStructureId_idx" ON "AuditLog"("financeStructureId");
CREATE INDEX IF NOT EXISTS "AuditLog_financeEntryId_idx" ON "AuditLog"("financeEntryId");
CREATE INDEX IF NOT EXISTS "AuditLog_paymentClaimId_idx" ON "AuditLog"("paymentClaimId");
CREATE INDEX IF NOT EXISTS "AuditLog_transactionId_idx" ON "AuditLog"("transactionId");

ALTER TABLE "FinancialStructure"
  ADD CONSTRAINT "FinancialStructure_employeeUserId_fkey"
  FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialStructureAssignment"
  ADD CONSTRAINT "FinancialStructureAssignment_employeeUserId_fkey"
  FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialEntry"
  ADD CONSTRAINT "FinancialEntry_employeeUserId_fkey"
  FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
