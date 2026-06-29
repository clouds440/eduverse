-- Existing timetable data is dummy and can be recreated after this model change.
DELETE FROM "AttendanceSession";
DELETE FROM "SectionSchedule";

ALTER TABLE "SectionSchedule" ADD COLUMN "teacherId" TEXT NOT NULL;

ALTER TABLE "SectionSchedule"
ADD CONSTRAINT "SectionSchedule_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "SectionSchedule_teacherId_idx" ON "SectionSchedule"("teacherId");
