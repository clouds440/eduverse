ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUB_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FINANCE_MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'GUARDIAN';

CREATE TABLE "GuardianProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "relationshipLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Student" ADD COLUMN "guardianId" TEXT;
ALTER TABLE "Student" ADD COLUMN "guardianRelationship" TEXT;

CREATE UNIQUE INDEX "GuardianProfile_userId_key" ON "GuardianProfile"("userId");
CREATE INDEX "GuardianProfile_organizationId_idx" ON "GuardianProfile"("organizationId");
CREATE INDEX "Student_guardianId_idx" ON "Student"("guardianId");

ALTER TABLE "GuardianProfile" ADD CONSTRAINT "GuardianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianProfile" ADD CONSTRAINT "GuardianProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "GuardianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
