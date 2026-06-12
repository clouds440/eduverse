CREATE TABLE "GuardianStudent" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "relationshipLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianStudent_pkey" PRIMARY KEY ("id")
);

INSERT INTO "GuardianStudent" (
    "id",
    "guardianId",
    "studentId",
    "organizationId",
    "relationshipLabel",
    "createdAt",
    "updatedAt"
)
SELECT
    "guardianId" || '-' || "id",
    "guardianId",
    "id",
    "organizationId",
    COALESCE(NULLIF("guardianRelationship", ''), 'Guardian'),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Student"
WHERE "guardianId" IS NOT NULL;

CREATE UNIQUE INDEX "GuardianStudent_studentId_key" ON "GuardianStudent"("studentId");
CREATE UNIQUE INDEX "GuardianStudent_guardianId_studentId_key" ON "GuardianStudent"("guardianId", "studentId");
CREATE INDEX "GuardianStudent_guardianId_idx" ON "GuardianStudent"("guardianId");
CREATE INDEX "GuardianStudent_organizationId_idx" ON "GuardianStudent"("organizationId");

ALTER TABLE "GuardianStudent"
ADD CONSTRAINT "GuardianStudent_guardianId_fkey"
FOREIGN KEY ("guardianId") REFERENCES "GuardianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuardianStudent"
ADD CONSTRAINT "GuardianStudent_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuardianStudent"
ADD CONSTRAINT "GuardianStudent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_guardianId_fkey";
DROP INDEX IF EXISTS "Student_guardianId_idx";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "guardianId";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "guardianRelationship";
ALTER TABLE "GuardianProfile" DROP COLUMN IF EXISTS "relationshipLabel";
