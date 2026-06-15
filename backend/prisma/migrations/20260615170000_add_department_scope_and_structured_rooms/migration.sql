-- Phase 3-7 additive department scope and structured room support.
-- No data backfill is performed; legacy text fields remain as fallbacks.

CREATE TYPE "DepartmentScopeType" AS ENUM ('ALL', 'SELECTED');

ALTER TABLE "User"
ADD COLUMN "departmentScopeType" "DepartmentScopeType" NOT NULL DEFAULT 'ALL';

ALTER TABLE "Teacher"
ADD COLUMN "departmentScopeType" "DepartmentScopeType" NOT NULL DEFAULT 'ALL';

ALTER TABLE "Course"
ADD COLUMN "departmentId" TEXT;

ALTER TABLE "Student"
ADD COLUMN "primaryDepartmentId" TEXT;

ALTER TABLE "Section"
ADD COLUMN "defaultRoomId" TEXT;

ALTER TABLE "SectionSchedule"
ADD COLUMN "roomId" TEXT;

CREATE TABLE "TeacherDepartment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  CONSTRAINT "TeacherDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentDepartment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  CONSTRAINT "StudentDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagerDepartment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  CONSTRAINT "ManagerDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubAdminDepartment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  CONSTRAINT "SubAdminDepartment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherDepartment_teacherId_departmentId_key" ON "TeacherDepartment"("teacherId", "departmentId");
CREATE INDEX "TeacherDepartment_organizationId_idx" ON "TeacherDepartment"("organizationId");
CREATE INDEX "TeacherDepartment_departmentId_idx" ON "TeacherDepartment"("departmentId");

CREATE UNIQUE INDEX "StudentDepartment_studentId_departmentId_key" ON "StudentDepartment"("studentId", "departmentId");
CREATE INDEX "StudentDepartment_organizationId_idx" ON "StudentDepartment"("organizationId");
CREATE INDEX "StudentDepartment_departmentId_idx" ON "StudentDepartment"("departmentId");

CREATE UNIQUE INDEX "ManagerDepartment_teacherId_departmentId_key" ON "ManagerDepartment"("teacherId", "departmentId");
CREATE INDEX "ManagerDepartment_organizationId_idx" ON "ManagerDepartment"("organizationId");
CREATE INDEX "ManagerDepartment_departmentId_idx" ON "ManagerDepartment"("departmentId");

CREATE UNIQUE INDEX "SubAdminDepartment_userId_departmentId_key" ON "SubAdminDepartment"("userId", "departmentId");
CREATE INDEX "SubAdminDepartment_organizationId_idx" ON "SubAdminDepartment"("organizationId");
CREATE INDEX "SubAdminDepartment_departmentId_idx" ON "SubAdminDepartment"("departmentId");

CREATE INDEX "Course_departmentId_idx" ON "Course"("departmentId");
CREATE INDEX "Student_primaryDepartmentId_idx" ON "Student"("primaryDepartmentId");
CREATE INDEX "Section_defaultRoomId_idx" ON "Section"("defaultRoomId");
CREATE INDEX "SectionSchedule_roomId_idx" ON "SectionSchedule"("roomId");

ALTER TABLE "Course"
ADD CONSTRAINT "Course_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Student"
ADD CONSTRAINT "Student_primaryDepartmentId_fkey"
FOREIGN KEY ("primaryDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Section"
ADD CONSTRAINT "Section_defaultRoomId_fkey"
FOREIGN KEY ("defaultRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SectionSchedule"
ADD CONSTRAINT "SectionSchedule_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeacherDepartment"
ADD CONSTRAINT "TeacherDepartment_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherDepartment"
ADD CONSTRAINT "TeacherDepartment_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherDepartment"
ADD CONSTRAINT "TeacherDepartment_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentDepartment"
ADD CONSTRAINT "StudentDepartment_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentDepartment"
ADD CONSTRAINT "StudentDepartment_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentDepartment"
ADD CONSTRAINT "StudentDepartment_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManagerDepartment"
ADD CONSTRAINT "ManagerDepartment_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManagerDepartment"
ADD CONSTRAINT "ManagerDepartment_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManagerDepartment"
ADD CONSTRAINT "ManagerDepartment_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubAdminDepartment"
ADD CONSTRAINT "SubAdminDepartment_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubAdminDepartment"
ADD CONSTRAINT "SubAdminDepartment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubAdminDepartment"
ADD CONSTRAINT "SubAdminDepartment_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
