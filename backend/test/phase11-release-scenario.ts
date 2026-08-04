import { JwtService } from '@nestjs/jwt';
import {
  AcademicCycleStatus,
  AssessmentLifecycleStatus,
  AssessmentType,
  AttendanceStatus,
  CohortLifecycleStatus,
  CourseRequirementType,
  CurriculumStatus,
  DepartmentScopeType,
  GradeStatus,
  OrgStatus,
  ProgramClassificationStatus,
  ProgramAcademicCycleStatus,
  ProgramCompletionMode,
  ProgramDurationUnit,
  ProgramProgressionMode,
  ProgramStatus,
  ProgramStructureType,
  Role,
  ScheduleType,
  SectionLifecycleStatus,
  StudentStatus,
  UserStatus,
} from '@/prisma/prisma-client';
import { AccessLevel } from '../src/common/access-control/access-level.enum';
import { PrismaService } from '../src/prisma/prisma.service';

export const phase11Ids = {
  orgA: 'phase11-org-a',
  orgB: 'phase11-org-b',
  orgPending: 'phase11-org-pending',
  departmentA: 'phase11-department-a',
  departmentA2: 'phase11-department-a2',
  departmentB: 'phase11-department-b',
  inactiveDepartment: 'phase11-department-inactive',
  cycleShared: 'phase11-cycle-shared',
  cycleNext: 'phase11-cycle-next',
  cycleStandalone: 'phase11-cycle-standalone',
  cycleArchive: 'phase11-cycle-archive',
  cycleB: 'phase11-cycle-b',
  courseA: 'phase11-course-a',
  courseA2: 'phase11-course-a2',
  programA: 'phase11-program-a',
  programA2: 'phase11-program-a2',
  programB: 'phase11-program-b',
  studentA: 'phase11-student-a',
  studentB: 'phase11-student-b',
  studentArchive: 'phase11-student-archive',
  studentProgress: 'phase11-student-progress',
  studentTransfer: 'phase11-student-transfer',
  studentWithdraw: 'phase11-student-withdraw',
  orgAdminA: 'phase11-user-admin-a',
  subAdminA: 'phase11-user-subadmin-a',
  subAdminAllA: 'phase11-user-subadmin-all-a',
  financeA: 'phase11-user-finance-a',
  managerA: 'phase11-user-manager-a',
  teacherA: 'phase11-user-teacher-a',
  teacherUnassignedA: 'phase11-user-teacher-unassigned-a',
  guardianA: 'phase11-user-guardian-a',
  guardianUnrelatedA: 'phase11-user-guardian-unrelated-a',
  orgAdminB: 'phase11-user-admin-b',
  pendingAdmin: 'phase11-user-admin-pending',
  archiveCohort: 'phase11-cohort-archive',
  archiveSection: 'phase11-section-archive',
  archiveAssessment: 'phase11-assessment-archive',
  archiveGrade: 'phase11-grade-archive',
  archiveFile: 'phase11-file-archive',
  archiveAttachment: 'phase11-attachment-archive',
} as const;

const programDefinitions = [
  {
    id: phase11Ids.programA,
    departmentId: phase11Ids.departmentA,
    courseId: phase11Ids.courseA,
    name: 'Phase 11 Computer Science',
    code: 'P11-CS',
    label: 'BS Computer Science',
    sortOrder: 1,
  },
  {
    id: phase11Ids.programA2,
    departmentId: phase11Ids.departmentA2,
    courseId: phase11Ids.courseA2,
    name: 'Phase 11 Business',
    code: 'P11-BUS',
    label: 'Bachelor of Business',
    sortOrder: 2,
  },
] as const;

export async function ensurePhase11ReleaseScenario(prisma: PrismaService) {
  if (process.env.PHASE11_DISPOSABLE_DATABASE !== 'true') {
    throw new Error(
      'Phase 11 fixture requires PHASE11_DISPOSABLE_DATABASE=true',
    );
  }
  const existing = await prisma.organization.findUnique({
    where: { id: phase11Ids.orgA },
  });
  if (existing) return phase11Ids;

  await prisma.organization.createMany({
    data: [
      {
        id: phase11Ids.orgA,
        name: 'Phase 11 Institute A',
        slug: 'phase11-institute-a',
        location: 'Lahore',
        type: 'UNIVERSITY',
        contactEmail: 'phase11-a@example.test',
        status: OrgStatus.APPROVED,
      },
      {
        id: phase11Ids.orgB,
        name: 'Phase 11 Institute B',
        slug: 'phase11-institute-b',
        location: 'Karachi',
        type: 'UNIVERSITY',
        contactEmail: 'phase11-b@example.test',
        status: OrgStatus.APPROVED,
      },
      {
        id: phase11Ids.orgPending,
        name: 'Phase 11 Pending',
        slug: 'phase11-pending',
        location: 'Islamabad',
        type: 'COLLEGE',
        contactEmail: 'phase11-pending@example.test',
        status: OrgStatus.PENDING,
      },
    ],
  });
  await prisma.user.createMany({
    data: [
      {
        id: phase11Ids.orgAdminA,
        organizationId: phase11Ids.orgA,
        email: 'admin-a@phase11.test',
        password: 'not-used',
        name: 'Admin A',
        role: Role.ORG_ADMIN,
        status: UserStatus.ACTIVE,
        isFirstLogin: false,
      },
      {
        id: phase11Ids.subAdminA,
        organizationId: phase11Ids.orgA,
        email: 'subadmin-a@phase11.test',
        password: 'not-used',
        name: 'Sub Admin A',
        role: Role.SUB_ADMIN,
        status: UserStatus.ACTIVE,
        departmentScopeType: DepartmentScopeType.SELECTED,
        isFirstLogin: false,
      },
      {
        id: phase11Ids.subAdminAllA,
        organizationId: phase11Ids.orgA,
        email: 'subadmin-all-a@phase11.test',
        password: 'not-used',
        name: 'Sub Admin Assigned A',
        role: Role.SUB_ADMIN,
        status: UserStatus.ACTIVE,
        departmentScopeType: DepartmentScopeType.ALL,
        isFirstLogin: false,
      },
      {
        id: phase11Ids.financeA,
        organizationId: phase11Ids.orgA,
        email: 'finance-a@phase11.test',
        password: 'not-used',
        name: 'Finance A',
        role: Role.FINANCE_MANAGER,
        status: UserStatus.ACTIVE,
        isFirstLogin: false,
      },
      {
        id: phase11Ids.managerA,
        organizationId: phase11Ids.orgA,
        email: 'manager-a@phase11.test',
        password: 'not-used',
        name: 'Manager A',
        role: Role.ORG_MANAGER,
        status: UserStatus.ACTIVE,
        departmentScopeType: DepartmentScopeType.ALL,
        isFirstLogin: false,
      },
      {
        id: phase11Ids.teacherA,
        organizationId: phase11Ids.orgA,
        email: 'teacher-a@phase11.test',
        password: 'not-used',
        name: 'Teacher A',
        role: Role.TEACHER,
        status: UserStatus.ACTIVE,
        isFirstLogin: false,
      },
      {
        id: phase11Ids.teacherUnassignedA,
        organizationId: phase11Ids.orgA,
        email: 'teacher-unassigned-a@phase11.test',
        password: 'not-used',
        name: 'Teacher Unassigned A',
        role: Role.TEACHER,
        status: UserStatus.ACTIVE,
        isFirstLogin: false,
      },
      {
        id: phase11Ids.guardianA,
        organizationId: phase11Ids.orgA,
        email: 'guardian-a@phase11.test',
        password: 'not-used',
        name: 'Guardian A',
        role: Role.GUARDIAN,
        status: UserStatus.ACTIVE,
        isFirstLogin: false,
      },
      {
        id: phase11Ids.guardianUnrelatedA,
        organizationId: phase11Ids.orgA,
        email: 'guardian-unrelated-a@phase11.test',
        password: 'not-used',
        name: 'Guardian Unrelated A',
        role: Role.GUARDIAN,
        status: UserStatus.ACTIVE,
        isFirstLogin: false,
      },
      {
        id: phase11Ids.orgAdminB,
        organizationId: phase11Ids.orgB,
        email: 'admin-b@phase11.test',
        password: 'not-used',
        name: 'Admin B',
        role: Role.ORG_ADMIN,
        status: UserStatus.ACTIVE,
        isFirstLogin: false,
      },
      {
        id: phase11Ids.pendingAdmin,
        organizationId: phase11Ids.orgPending,
        email: 'admin-pending@phase11.test',
        password: 'not-used',
        name: 'Pending Admin',
        role: Role.ORG_ADMIN,
        status: UserStatus.ACTIVE,
        isFirstLogin: false,
      },
      {
        id: 'phase11-user-student-a',
        organizationId: phase11Ids.orgA,
        email: 'student-a@phase11.test',
        password: 'not-used',
        name: 'Student A',
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        isFirstLogin: false,
      },
      {
        id: 'phase11-user-student-b',
        organizationId: phase11Ids.orgB,
        email: 'student-b@phase11.test',
        password: 'not-used',
        name: 'Student B',
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        isFirstLogin: false,
      },
      ...[
        ['archive', 'Archive Student'],
        ['progress', 'Progress Student'],
        ['transfer', 'Transfer Student'],
        ['withdraw', 'Withdraw Student'],
      ].map(([suffix, name]) => ({
        id: `phase11-user-student-${suffix}`,
        organizationId: phase11Ids.orgA,
        email: `student-${suffix}@phase11.test`,
        password: 'not-used',
        name,
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        isFirstLogin: false,
      })),
    ],
  });
  await prisma.department.createMany({
    data: [
      {
        id: phase11Ids.departmentA,
        organizationId: phase11Ids.orgA,
        name: 'Computing',
        code: 'P11-COMP',
        isActive: true,
      },
      {
        id: phase11Ids.departmentA2,
        organizationId: phase11Ids.orgA,
        name: 'Business',
        code: 'P11-BUS',
        isActive: true,
      },
      {
        id: phase11Ids.inactiveDepartment,
        organizationId: phase11Ids.orgA,
        name: 'Inactive',
        code: 'P11-INACTIVE',
        isActive: false,
      },
      {
        id: phase11Ids.departmentB,
        organizationId: phase11Ids.orgB,
        name: 'Other Tenant',
        code: 'P11-OTHER',
        isActive: true,
      },
    ],
  });
  await prisma.subAdminDepartment.createMany({
    data: [
      {
        organizationId: phase11Ids.orgA,
        userId: phase11Ids.subAdminA,
        departmentId: phase11Ids.departmentA,
      },
      {
        organizationId: phase11Ids.orgA,
        userId: phase11Ids.subAdminAllA,
        departmentId: phase11Ids.departmentA,
      },
    ],
  });
  await prisma.teacher.create({
    data: {
      id: 'phase11-teacher-a',
      organizationId: phase11Ids.orgA,
      userId: phase11Ids.teacherA,
      status: 'ACTIVE',
    },
  });
  await prisma.teacher.create({
    data: {
      id: 'phase11-teacher-unassigned-a',
      organizationId: phase11Ids.orgA,
      userId: phase11Ids.teacherUnassignedA,
      status: 'ACTIVE',
    },
  });
  await prisma.course.createMany({
    data: [
      {
        id: phase11Ids.courseA,
        organizationId: phase11Ids.orgA,
        departmentId: phase11Ids.departmentA,
        name: 'Programming',
        code: 'P11-CS101',
        creditHours: 3,
      },
      {
        id: phase11Ids.courseA2,
        organizationId: phase11Ids.orgA,
        departmentId: phase11Ids.departmentA2,
        name: 'Accounting',
        code: 'P11-ACC101',
        creditHours: 3,
      },
      {
        id: 'phase11-course-b',
        organizationId: phase11Ids.orgB,
        departmentId: phase11Ids.departmentB,
        name: 'Other Course',
        code: 'P11-B101',
        creditHours: 3,
      },
    ],
  });
  await prisma.academicCycle.createMany({
    data: [
      {
        id: phase11Ids.cycleShared,
        organizationId: phase11Ids.orgA,
        name: 'Fall 2026',
        code: 'P11-FALL-2026',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-12-31'),
        status: AcademicCycleStatus.ACTIVE,
      },
      {
        id: phase11Ids.cycleNext,
        organizationId: phase11Ids.orgA,
        name: 'Spring 2027',
        code: 'P11-SPRING-2027',
        startDate: new Date('2027-01-01'),
        endDate: new Date('2027-05-31'),
        status: AcademicCycleStatus.DRAFT,
      },
      {
        id: phase11Ids.cycleStandalone,
        organizationId: phase11Ids.orgA,
        name: 'Summer Workshop 2027',
        code: 'P11-SUMMER-2027',
        startDate: new Date('2027-06-01'),
        endDate: new Date('2027-07-31'),
        status: AcademicCycleStatus.DRAFT,
      },
      {
        id: phase11Ids.cycleArchive,
        organizationId: phase11Ids.orgA,
        name: 'Spring 2026 Archive Candidate',
        code: 'P11-SPRING-2026',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-05-31'),
        status: AcademicCycleStatus.COMPLETED,
      },
      {
        id: phase11Ids.cycleB,
        organizationId: phase11Ids.orgB,
        name: 'Other Fall',
        code: 'P11-B-FALL',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-12-31'),
        status: AcademicCycleStatus.ACTIVE,
      },
    ],
  });
  await prisma.student.createMany({
    data: [
      {
        id: phase11Ids.studentA,
        userId: 'phase11-user-student-a',
        organizationId: phase11Ids.orgA,
        registrationNumber: 'P11-REG-A',
        rollNumber: 'P11-ROLL-A',
        gender: 'Female',
        status: StudentStatus.ACTIVE,
        updatedBy: 'Phase 11',
      },
      {
        id: phase11Ids.studentB,
        userId: 'phase11-user-student-b',
        organizationId: phase11Ids.orgB,
        registrationNumber: 'P11-REG-B',
        rollNumber: 'P11-ROLL-B',
        gender: 'Male',
        status: StudentStatus.ACTIVE,
        updatedBy: 'Phase 11',
      },
      ...[
        [phase11Ids.studentArchive, 'archive', 'P11-REG-ARCHIVE'],
        [phase11Ids.studentProgress, 'progress', 'P11-REG-PROGRESS'],
        [phase11Ids.studentTransfer, 'transfer', 'P11-REG-TRANSFER'],
        [phase11Ids.studentWithdraw, 'withdraw', 'P11-REG-WITHDRAW'],
      ].map(([id, suffix, registrationNumber]) => ({
        id,
        userId: `phase11-user-student-${suffix}`,
        organizationId: phase11Ids.orgA,
        registrationNumber,
        rollNumber: registrationNumber.replace('REG', 'ROLL'),
        gender: 'Unassigned',
        status: StudentStatus.ACTIVE,
        updatedBy: 'Phase 11',
      })),
    ],
  });
  await prisma.guardianProfile.createMany({
    data: [
      {
        id: 'phase11-guardian-profile-a',
        userId: phase11Ids.guardianA,
        organizationId: phase11Ids.orgA,
      },
      {
        id: 'phase11-guardian-profile-unrelated-a',
        userId: phase11Ids.guardianUnrelatedA,
        organizationId: phase11Ids.orgA,
      },
    ],
  });
  await prisma.guardianStudent.create({
    data: {
      id: 'phase11-guardian-link-a',
      guardianId: 'phase11-guardian-profile-a',
      studentId: phase11Ids.studentArchive,
      organizationId: phase11Ids.orgA,
      relationshipLabel: 'Guardian',
    },
  });

  for (const definition of programDefinitions) {
    const revisionId = `${definition.id}-revision-1`;
    const curriculumId = `${definition.id}-curriculum-1`;
    await prisma.program.create({
      data: {
        id: definition.id,
        organizationId: phase11Ids.orgA,
        departmentId: definition.departmentId,
        name: definition.name,
        code: definition.code,
        status: ProgramStatus.ACTIVE,
        requiredCycleCount: 2,
        configurationVersion: 1,
        structureType: ProgramStructureType.TERM_BASED,
        progressionMode: ProgramProgressionMode.SEQUENTIAL,
        completionMode: ProgramCompletionMode.FINAL_STAGE,
        durationValue: 2,
        durationUnit: ProgramDurationUnit.CYCLES,
        isVisibleForAdmissions: true,
        admissionsLabel: definition.label,
        admissionsSortOrder: definition.sortOrder,
      },
    });
    await prisma.programConfigurationRevision.create({
      data: {
        id: revisionId,
        organizationId: phase11Ids.orgA,
        programId: definition.id,
        version: 1,
        requiredCycleCount: 2,
        cyclesSnapshot: [
          { academicCycleId: phase11Ids.cycleShared, sequence: 1 },
          { academicCycleId: phase11Ids.cycleNext, sequence: 2 },
        ],
        checksum: `${definition.code}-checksum-v1`,
        changeReason: 'Phase 11 fixture',
        createdById: phase11Ids.orgAdminA,
      },
    });
    const associations = [];
    for (const [index, academicCycleId] of [
      phase11Ids.cycleShared,
      phase11Ids.cycleNext,
    ].entries()) {
      associations.push(
        await prisma.programAcademicCycle.create({
          data: {
            id: `${definition.id}-cycle-${index + 1}`,
            organizationId: phase11Ids.orgA,
            programId: definition.id,
            academicCycleId,
            sequence: index + 1,
            isRequired: true,
            status: ProgramAcademicCycleStatus.ACTIVE,
          },
        }),
      );
    }
    await prisma.curriculumVersion.create({
      data: {
        id: curriculumId,
        organizationId: phase11Ids.orgA,
        programId: definition.id,
        programConfigurationRevisionId: revisionId,
        name: `${definition.code} 2026`,
        code: `${definition.code}-2026`,
        status: CurriculumStatus.ACTIVE,
        isDefaultForAdmissions: true,
        activatedAt: new Date(),
      },
    });
    for (const [index, association] of associations.entries()) {
      const stageId = `${definition.id}-stage-${index + 1}`;
      await prisma.programStage.create({
        data: {
          id: stageId,
          organizationId: phase11Ids.orgA,
          curriculumVersionId: curriculumId,
          programAcademicCycleId: association.id,
          name: `Semester ${index + 1}`,
          code: `${definition.code}-SEM-${index + 1}`,
          sequence: index + 1,
        },
      });
      await prisma.stageCourseRequirement.create({
        data: {
          id: `${stageId}-requirement`,
          organizationId: phase11Ids.orgA,
          programStageId: stageId,
          courseId: definition.courseId,
          requirementType: CourseRequirementType.REQUIRED,
          creditHoursSnapshot: 3,
          sortOrder: 0,
        },
      });
    }
  }

  await prisma.program.create({
    data: {
      id: phase11Ids.programB,
      organizationId: phase11Ids.orgB,
      departmentId: phase11Ids.departmentB,
      name: 'Other Tenant Program',
      code: 'P11-OTHER',
      status: ProgramStatus.DRAFT,
      requiredCycleCount: 1,
      structureType: ProgramStructureType.TERM_BASED,
      progressionMode: ProgramProgressionMode.SEQUENTIAL,
      completionMode: ProgramCompletionMode.FINAL_STAGE,
    },
  });
  await prisma.programConfigurationRevision.create({
    data: {
      id: `${phase11Ids.programB}-revision-1`,
      organizationId: phase11Ids.orgB,
      programId: phase11Ids.programB,
      version: 1,
      requiredCycleCount: 1,
      cyclesSnapshot: [{ academicCycleId: phase11Ids.cycleB, sequence: 1 }],
      checksum: 'P11-OTHER-checksum-v1',
      changeReason: 'Phase 11 fixture',
      createdById: phase11Ids.orgAdminB,
    },
  });
  await prisma.programAcademicCycle.create({
    data: {
      id: `${phase11Ids.programB}-cycle-1`,
      organizationId: phase11Ids.orgB,
      programId: phase11Ids.programB,
      academicCycleId: phase11Ids.cycleB,
      sequence: 1,
      isRequired: true,
      status: ProgramAcademicCycleStatus.ACTIVE,
    },
  });

  await prisma.cohort.create({
    data: {
      id: phase11Ids.archiveCohort,
      organizationId: phase11Ids.orgA,
      academicCycleId: phase11Ids.cycleArchive,
      name: 'Archive Standalone Cohort',
      code: 'P11-ARCHIVE-COHORT',
      status: CohortLifecycleStatus.CLOSED,
      programClassificationStatus: ProgramClassificationStatus.STANDALONE,
    },
  });
  await prisma.section.create({
    data: {
      id: phase11Ids.archiveSection,
      organizationId: phase11Ids.orgA,
      academicCycleId: phase11Ids.cycleArchive,
      courseId: phase11Ids.courseA,
      cohortId: phase11Ids.archiveCohort,
      name: 'Archived Programming Section',
      code: 'P11-ARCHIVE-SECTION',
      status: SectionLifecycleStatus.CLOSED,
      programClassificationStatus: ProgramClassificationStatus.STANDALONE,
      teachers: { connect: { id: 'phase11-teacher-a' } },
    },
  });
  await prisma.student.update({
    where: { id: phase11Ids.studentArchive },
    data: { cohortId: phase11Ids.archiveCohort },
  });
  await prisma.cohortMembershipHistory.create({
    data: {
      id: 'phase11-cohort-history-archive',
      studentId: phase11Ids.studentArchive,
      cohortId: phase11Ids.archiveCohort,
      academicCycleId: phase11Ids.cycleArchive,
      leftAt: new Date('2026-06-01'),
    },
  });
  await prisma.enrollment.create({
    data: {
      id: 'phase11-enrollment-archive',
      studentId: phase11Ids.studentArchive,
      sectionId: phase11Ids.archiveSection,
      academicCycleId: phase11Ids.cycleArchive,
    },
  });
  await prisma.enrollmentHistory.create({
    data: {
      id: 'phase11-enrollment-history-archive',
      studentId: phase11Ids.studentArchive,
      sectionId: phase11Ids.archiveSection,
      academicCycleId: phase11Ids.cycleArchive,
    },
  });
  await prisma.assessment.create({
    data: {
      id: phase11Ids.archiveAssessment,
      organizationId: phase11Ids.orgA,
      sectionId: phase11Ids.archiveSection,
      courseId: phase11Ids.courseA,
      academicCycleId: phase11Ids.cycleArchive,
      title: 'Archive Final',
      type: AssessmentType.FINAL,
      totalMarks: 100,
      weightage: 100,
      status: AssessmentLifecycleStatus.ACTIVE,
    },
  });
  await prisma.grade.create({
    data: {
      id: phase11Ids.archiveGrade,
      assessmentId: phase11Ids.archiveAssessment,
      studentId: phase11Ids.studentArchive,
      academicCycleId: phase11Ids.cycleArchive,
      marksObtained: 88,
      status: GradeStatus.PUBLISHED,
      answerbookReferenceNumber: 'P11-ANSWER-001',
      updatedBy: phase11Ids.teacherA,
    },
  });
  await prisma.file.create({
    data: {
      id: phase11Ids.archiveFile,
      orgId: phase11Ids.orgA,
      entityType: 'GRADE_ANSWERBOOK',
      entityId: phase11Ids.archiveGrade,
      path: `/phase11/files/${phase11Ids.archiveFile}`,
      filename: 'phase11-answerbook.pdf',
      mimeType: 'application/pdf',
      size: 28,
      uploadedBy: phase11Ids.teacherA,
      extension: '.pdf',
      fileKind: 'document',
      sha256: '1'.repeat(64),
    },
  });
  await prisma.gradeAnswerbookAttachment.create({
    data: {
      id: phase11Ids.archiveAttachment,
      organizationId: phase11Ids.orgA,
      gradeId: phase11Ids.archiveGrade,
      fileId: phase11Ids.archiveFile,
      uploadedById: phase11Ids.teacherA,
    },
  });
  await prisma.sectionSchedule.create({
    data: {
      id: 'phase11-schedule-archive',
      sectionId: phase11Ids.archiveSection,
      academicCycleId: phase11Ids.cycleArchive,
      day: 1,
      type: ScheduleType.OFFICIAL,
      startTime: '09:00',
      endTime: '10:00',
      teacherId: 'phase11-teacher-a',
    },
  });
  await prisma.attendanceSession.create({
    data: {
      id: 'phase11-attendance-session-archive',
      sectionId: phase11Ids.archiveSection,
      scheduleId: 'phase11-schedule-archive',
      academicCycleId: phase11Ids.cycleArchive,
      date: new Date('2026-03-02'),
    },
  });
  await prisma.attendanceRecord.create({
    data: {
      id: 'phase11-attendance-record-archive',
      sessionId: 'phase11-attendance-session-archive',
      studentId: phase11Ids.studentArchive,
      status: AttendanceStatus.PRESENT,
    },
  });
  await prisma.courseMaterial.create({
    data: {
      id: 'phase11-material-archive',
      sectionId: phase11Ids.archiveSection,
      academicCycleId: phase11Ids.cycleArchive,
      title: 'Archived Notes',
      links: ['https://example.test/phase11-notes'],
      createdBy: phase11Ids.teacherA,
    },
  });
  return phase11Ids;
}

export async function createPhase11Session(
  prisma: PrismaService,
  userId: string,
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { organization: true },
  });
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const token = await jwt.signAsync({
    sub: user.id,
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    orgId: user.organizationId,
    status: user.organization?.status ?? OrgStatus.APPROVED,
    userStatus: user.status,
    accessLevel:
      user.organization?.status === OrgStatus.APPROVED
        ? AccessLevel.WRITE
        : AccessLevel.NONE,
  });
  await prisma.session.deleteMany({
    where: { userId, deviceId: 'phase11-api' },
  });
  await prisma.session.create({
    data: {
      userId,
      deviceId: 'phase11-api',
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return token;
}
