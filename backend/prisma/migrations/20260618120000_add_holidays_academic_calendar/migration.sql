CREATE TYPE "HolidayType" AS ENUM ('HOLIDAY', 'EXAM_BREAK', 'EVENT', 'CLOSURE');

CREATE TYPE "HolidayMatchMode" AS ENUM ('SINGLE_DAY', 'DATE_RANGE', 'WEEKDAYS_IN_RANGE', 'DAILY_IN_RANGE');

CREATE TABLE "Holiday" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "HolidayType" NOT NULL DEFAULT 'HOLIDAY',
  "matchMode" "HolidayMatchMode" NOT NULL DEFAULT 'SINGLE_DAY',
  "departmentScopeType" "DepartmentScopeType" NOT NULL DEFAULT 'ALL',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "daysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "isFullDay" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HolidayDepartment" (
  "holidayId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HolidayDepartment_pkey" PRIMARY KEY ("holidayId", "departmentId")
);

CREATE INDEX "Holiday_organizationId_idx" ON "Holiday"("organizationId");
CREATE INDEX "Holiday_organizationId_isActive_idx" ON "Holiday"("organizationId", "isActive");
CREATE INDEX "Holiday_organizationId_startDate_endDate_idx" ON "Holiday"("organizationId", "startDate", "endDate");
CREATE INDEX "Holiday_type_idx" ON "Holiday"("type");
CREATE INDEX "Holiday_matchMode_idx" ON "Holiday"("matchMode");
CREATE INDEX "HolidayDepartment_departmentId_idx" ON "HolidayDepartment"("departmentId");

ALTER TABLE "Holiday"
ADD CONSTRAINT "Holiday_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Holiday"
ADD CONSTRAINT "Holiday_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Holiday"
ADD CONSTRAINT "Holiday_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HolidayDepartment"
ADD CONSTRAINT "HolidayDepartment_holidayId_fkey"
FOREIGN KEY ("holidayId") REFERENCES "Holiday"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HolidayDepartment"
ADD CONSTRAINT "HolidayDepartment_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
