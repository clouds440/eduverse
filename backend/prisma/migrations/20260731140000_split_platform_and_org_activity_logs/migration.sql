-- Split the legacy mixed audit log into explicit platform and organization activity logs.
-- Existing legacy audit rows are intentionally discarded.

CREATE TYPE "ActivityLogType" AS ENUM (
  'SECURITY',
  'ADMIN',
  'FINANCE',
  'SYSTEM',
  'AI',
  'COMMUNICATION',
  'ACADEMIC'
);

DROP TABLE IF EXISTS "AuditLog" CASCADE;

CREATE TABLE "PlatformActivityLog" (
  "id" TEXT NOT NULL,
  "type" "ActivityLogType" NOT NULL DEFAULT 'SECURITY',
  "action" TEXT NOT NULL,
  "actorUserId" TEXT,
  "targetUserId" TEXT,
  "module" TEXT,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "resourceTitle" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "sessionId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationActivityLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "ActivityLogType" NOT NULL DEFAULT 'SECURITY',
  "action" TEXT NOT NULL,
  "actorUserId" TEXT,
  "targetUserId" TEXT,
  "module" TEXT,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "resourceTitle" TEXT,
  "financeStructureId" TEXT,
  "financeEntryId" TEXT,
  "paymentClaimId" TEXT,
  "transactionId" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "sessionId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformActivityLog_type_idx" ON "PlatformActivityLog"("type");
CREATE INDEX "PlatformActivityLog_action_idx" ON "PlatformActivityLog"("action");
CREATE INDEX "PlatformActivityLog_actorUserId_idx" ON "PlatformActivityLog"("actorUserId");
CREATE INDEX "PlatformActivityLog_targetUserId_idx" ON "PlatformActivityLog"("targetUserId");
CREATE INDEX "PlatformActivityLog_module_idx" ON "PlatformActivityLog"("module");
CREATE INDEX "PlatformActivityLog_resourceType_idx" ON "PlatformActivityLog"("resourceType");
CREATE INDEX "PlatformActivityLog_resourceId_idx" ON "PlatformActivityLog"("resourceId");
CREATE INDEX "PlatformActivityLog_createdAt_idx" ON "PlatformActivityLog"("createdAt");

CREATE INDEX "OrganizationActivityLog_organizationId_idx" ON "OrganizationActivityLog"("organizationId");
CREATE INDEX "OrganizationActivityLog_type_idx" ON "OrganizationActivityLog"("type");
CREATE INDEX "OrganizationActivityLog_action_idx" ON "OrganizationActivityLog"("action");
CREATE INDEX "OrganizationActivityLog_actorUserId_idx" ON "OrganizationActivityLog"("actorUserId");
CREATE INDEX "OrganizationActivityLog_targetUserId_idx" ON "OrganizationActivityLog"("targetUserId");
CREATE INDEX "OrganizationActivityLog_module_idx" ON "OrganizationActivityLog"("module");
CREATE INDEX "OrganizationActivityLog_resourceType_idx" ON "OrganizationActivityLog"("resourceType");
CREATE INDEX "OrganizationActivityLog_resourceId_idx" ON "OrganizationActivityLog"("resourceId");
CREATE INDEX "OrganizationActivityLog_financeStructureId_idx" ON "OrganizationActivityLog"("financeStructureId");
CREATE INDEX "OrganizationActivityLog_financeEntryId_idx" ON "OrganizationActivityLog"("financeEntryId");
CREATE INDEX "OrganizationActivityLog_paymentClaimId_idx" ON "OrganizationActivityLog"("paymentClaimId");
CREATE INDEX "OrganizationActivityLog_transactionId_idx" ON "OrganizationActivityLog"("transactionId");
CREATE INDEX "OrganizationActivityLog_createdAt_idx" ON "OrganizationActivityLog"("createdAt");

ALTER TABLE "OrganizationActivityLog"
  ADD CONSTRAINT "OrganizationActivityLog_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
