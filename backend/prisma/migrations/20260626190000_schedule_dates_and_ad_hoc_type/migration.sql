-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('OFFICIAL', 'AD_HOC');

-- Drop legacy unscheduled ad-hoc attendance sessions before making schedules required.
DELETE FROM "AttendanceSession" WHERE "scheduleId" IS NULL;

-- AlterTable
ALTER TABLE "SectionSchedule"
ADD COLUMN "date" TIMESTAMP(3),
ADD COLUMN "type" "ScheduleType" NOT NULL DEFAULT 'OFFICIAL';

-- AlterTable
ALTER TABLE "AttendanceSession"
DROP COLUMN "isAdhoc",
ALTER COLUMN "scheduleId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "SectionSchedule_date_idx" ON "SectionSchedule"("date");

-- CreateIndex
CREATE INDEX "SectionSchedule_type_idx" ON "SectionSchedule"("type");
