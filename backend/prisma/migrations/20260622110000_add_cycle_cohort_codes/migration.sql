-- Add required organization-scoped import codes for academic cycles and cohorts.
ALTER TABLE "AcademicCycle" ADD COLUMN "code" TEXT;
ALTER TABLE "Cohort" ADD COLUMN "code" TEXT;

WITH numbered_cycles AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt", "id") AS row_number
  FROM "AcademicCycle"
)
UPDATE "AcademicCycle"
SET "code" = 'CYCLE-' || LPAD(numbered_cycles.row_number::TEXT, 4, '0')
FROM numbered_cycles
WHERE "AcademicCycle"."id" = numbered_cycles."id";

WITH numbered_cohorts AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt", "id") AS row_number
  FROM "Cohort"
)
UPDATE "Cohort"
SET "code" = 'COHORT-' || LPAD(numbered_cohorts.row_number::TEXT, 4, '0')
FROM numbered_cohorts
WHERE "Cohort"."id" = numbered_cohorts."id";

ALTER TABLE "AcademicCycle" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Cohort" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "AcademicCycle_organizationId_code_key" ON "AcademicCycle"("organizationId", "code");
CREATE UNIQUE INDEX "Cohort_organizationId_code_key" ON "Cohort"("organizationId", "code");
