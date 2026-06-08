ALTER TABLE "GpaPolicy" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AcademicCycle" ADD COLUMN "gpaPolicyId" TEXT;
ALTER TABLE "AcademicCycle" ADD COLUMN "gpaPolicySnapshot" JSONB;

UPDATE "AcademicCycle" AS ac
SET
    "gpaPolicyId" = gp."id",
    "gpaPolicySnapshot" = jsonb_build_object(
        'policyId', gp."id",
        'name', gp."name",
        'scale', gp."scale",
        'method', gp."method",
        'rounding', gp."rounding",
        'gradeRules', gp."gradeRules",
        'capturedAt', CURRENT_TIMESTAMP
    )
FROM "GpaPolicy" AS gp
WHERE gp."organizationId" = ac."organizationId"
  AND gp."isDefault" = true
  AND ac."gpaPolicyId" IS NULL;

CREATE INDEX "GpaPolicy_isArchived_idx" ON "GpaPolicy"("isArchived");
CREATE INDEX "AcademicCycle_gpaPolicyId_idx" ON "AcademicCycle"("gpaPolicyId");

ALTER TABLE "AcademicCycle" ADD CONSTRAINT "AcademicCycle_gpaPolicyId_fkey" FOREIGN KEY ("gpaPolicyId") REFERENCES "GpaPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
