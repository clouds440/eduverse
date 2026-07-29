ALTER TABLE "Organization" DROP CONSTRAINT IF EXISTS "Organization_parentOrgId_fkey";
ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_parentOrgId_fkey"
  FOREIGN KEY ("parentOrgId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_organizationId_fkey";
ALTER TABLE "User"
  ADD CONSTRAINT "User_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
