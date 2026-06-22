-- Add required organization-scoped human-readable codes for importable reference entities.

ALTER TABLE "Course" ADD COLUMN "code" TEXT;
ALTER TABLE "Room" ADD COLUMN "code" TEXT;
ALTER TABLE "Section" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Section" ADD COLUMN "code" TEXT;

-- Normalize existing optional codes first.
UPDATE "Department"
SET "code" = NULLIF(UPPER(TRIM("code")), '')
WHERE "code" IS NOT NULL;

UPDATE "Building"
SET "code" = NULLIF(UPPER(TRIM("code")), '')
WHERE "code" IS NOT NULL;

-- Backfill missing department codes from names with stable per-organization suffixes.
WITH bases AS (
  SELECT
    "id",
    "organizationId",
    COALESCE(NULLIF(REGEXP_REPLACE(UPPER(TRIM("code")), '[^A-Z0-9]+', '-', 'g'), ''), NULLIF(REGEXP_REPLACE(UPPER(TRIM("name")), '[^A-Z0-9]+', '-', 'g'), ''), 'DEPT') AS base
  FROM "Department"
), ranked AS (
  SELECT "id", base, ROW_NUMBER() OVER (PARTITION BY "organizationId", base ORDER BY "id") AS rn
  FROM bases
)
UPDATE "Department" d
SET "code" = CASE WHEN ranked.rn = 1 THEN ranked.base ELSE ranked.base || '-' || ranked.rn END
FROM ranked
WHERE d."id" = ranked."id";

-- Backfill missing building codes from names with stable per-organization suffixes.
WITH bases AS (
  SELECT
    "id",
    "organizationId",
    COALESCE(NULLIF(REGEXP_REPLACE(UPPER(TRIM("code")), '[^A-Z0-9]+', '-', 'g'), ''), NULLIF(REGEXP_REPLACE(UPPER(TRIM("name")), '[^A-Z0-9]+', '-', 'g'), ''), 'BLDG') AS base
  FROM "Building"
), ranked AS (
  SELECT "id", base, ROW_NUMBER() OVER (PARTITION BY "organizationId", base ORDER BY "id") AS rn
  FROM bases
)
UPDATE "Building" b
SET "code" = CASE WHEN ranked.rn = 1 THEN ranked.base ELSE ranked.base || '-' || ranked.rn END
FROM ranked
WHERE b."id" = ranked."id";

-- Backfill course codes from names.
WITH bases AS (
  SELECT
    "id",
    "organizationId",
    COALESCE(NULLIF(REGEXP_REPLACE(UPPER(TRIM("name")), '[^A-Z0-9]+', '-', 'g'), ''), 'COURSE') AS base
  FROM "Course"
), ranked AS (
  SELECT "id", base, ROW_NUMBER() OVER (PARTITION BY "organizationId", base ORDER BY "id") AS rn
  FROM bases
)
UPDATE "Course" c
SET "code" = CASE WHEN ranked.rn = 1 THEN ranked.base ELSE ranked.base || '-' || ranked.rn END
FROM ranked
WHERE c."id" = ranked."id";

-- Backfill room codes from building code + room name, scoped to organization.
WITH bases AS (
  SELECT
    r."id",
    r."organizationId",
    COALESCE(NULLIF(REGEXP_REPLACE(UPPER(TRIM(b."code" || '-' || r."name")), '[^A-Z0-9]+', '-', 'g'), ''), 'ROOM') AS base
  FROM "Room" r
  JOIN "Building" b ON b."id" = r."buildingId"
), ranked AS (
  SELECT "id", base, ROW_NUMBER() OVER (PARTITION BY "organizationId", base ORDER BY "id") AS rn
  FROM bases
)
UPDATE "Room" r
SET "code" = CASE WHEN ranked.rn = 1 THEN ranked.base ELSE ranked.base || '-' || ranked.rn END
FROM ranked
WHERE r."id" = ranked."id";

-- Backfill sections with direct organizationId and codes from course code + section name.
UPDATE "Section" s
SET "organizationId" = c."organizationId"
FROM "Course" c
WHERE c."id" = s."courseId";

WITH bases AS (
  SELECT
    s."id",
    s."organizationId",
    COALESCE(NULLIF(REGEXP_REPLACE(UPPER(TRIM(c."code" || '-' || s."name")), '[^A-Z0-9]+', '-', 'g'), ''), 'SECTION') AS base
  FROM "Section" s
  JOIN "Course" c ON c."id" = s."courseId"
), ranked AS (
  SELECT "id", base, ROW_NUMBER() OVER (PARTITION BY "organizationId", base ORDER BY "id") AS rn
  FROM bases
)
UPDATE "Section" s
SET "code" = CASE WHEN ranked.rn = 1 THEN ranked.base ELSE ranked.base || '-' || ranked.rn END
FROM ranked
WHERE s."id" = ranked."id";

ALTER TABLE "Department" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Building" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Course" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Room" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Section" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Section" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Course_organizationId_code_key" ON "Course"("organizationId", "code");
CREATE UNIQUE INDEX "Room_organizationId_code_key" ON "Room"("organizationId", "code");
CREATE UNIQUE INDEX "Section_organizationId_code_key" ON "Section"("organizationId", "code");
CREATE INDEX "Section_organizationId_idx" ON "Section"("organizationId");

ALTER TABLE "Section"
ADD CONSTRAINT "Section_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;