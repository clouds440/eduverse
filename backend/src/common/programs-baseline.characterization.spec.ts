import { BadRequestException } from '@nestjs/common';
import {
  AcademicCycleStatus,
  CohortLifecycleStatus,
  GradeStatus,
  ProgramClassificationStatus,
  Role,
  SectionLifecycleStatus,
} from './enums';
import { AssessmentsService } from '../assessments/assessments.service';
import { CohortsService } from '../cohorts/cohorts.service';
import { CopyForwardService } from '../copy-forward/copy-forward.service';
import { FilesService } from '../files/files.service';
import { ReassignmentService } from '../reassignment/reassignment.service';
import { SectionsService } from '../sections/sections.service';
import { TranscriptsService } from '../transcripts/transcripts.service';

function transactionPrisma(tx: Record<string, unknown>, root: Record<string, unknown>) {
  return {
    ...root,
    $transaction: jest.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
  };
}

describe('Programs implementation baseline characterization', () => {
  describe('cohort enrollment and history', () => {
    it('auto-enrolls a newly assigned student into every cohort section', async () => {
      const tx = {
        student: { update: jest.fn().mockResolvedValue({}) },
        cohortMembershipHistory: { create: jest.fn().mockResolvedValue({}) },
        enrollment: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        enrollmentHistory: { create: jest.fn().mockResolvedValue({}) },
      };
      const prisma = transactionPrisma(tx, {
        academicCycle: {
          findFirst: jest.fn().mockResolvedValue({ id: 'cycle-1', status: AcademicCycleStatus.ACTIVE }),
        },
        cohort: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cohort-1',
            academicCycleId: 'cycle-1',
            status: CohortLifecycleStatus.ACTIVE,
            programClassificationStatus: ProgramClassificationStatus.STANDALONE,
            sections: [
              { id: 'section-1', academicCycleId: 'cycle-1' },
              { id: 'section-2', academicCycleId: 'cycle-1' },
            ],
          }),
        },
        student: {
          findFirst: jest.fn().mockResolvedValue({ id: 'student-1', cohortId: null }),
        },
      });

      const service = new CohortsService(prisma as never);
      await service.addStudentToCohort('org-1', 'cohort-1', 'student-1');

      expect(tx.student.update).toHaveBeenCalledWith({
        where: { id: 'student-1' },
        data: { cohortId: 'cohort-1' },
      });
      expect(tx.cohortMembershipHistory.create).toHaveBeenCalledWith({
        data: {
          studentId: 'student-1',
          cohortId: 'cohort-1',
          academicCycleId: 'cycle-1',
        },
      });
      expect(tx.enrollment.create).toHaveBeenCalledTimes(2);
      expect(tx.enrollmentHistory.create).toHaveBeenCalledTimes(2);
    });

    it('removes only cohort-sourced current enrollments and closes history', async () => {
      const tx = {
        enrollment: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'enrollment-1', sectionId: 'section-1' },
          ]),
          delete: jest.fn().mockResolvedValue({}),
        },
        enrollmentHistory: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        student: { update: jest.fn().mockResolvedValue({}) },
        cohortMembershipHistory: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const prisma = transactionPrisma(tx, {
        academicCycle: {
          findFirst: jest.fn().mockResolvedValue({ id: 'cycle-1', status: AcademicCycleStatus.ACTIVE }),
        },
        cohort: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cohort-1',
            academicCycleId: 'cycle-1',
            status: CohortLifecycleStatus.ACTIVE,
          }),
        },
        student: {
          findFirst: jest.fn().mockResolvedValue({ id: 'student-1', cohortId: 'cohort-1' }),
        },
      });

      const service = new CohortsService(prisma as never);
      await service.removeStudentFromCohort('org-1', 'cohort-1', 'student-1');

      expect(tx.enrollment.findMany).toHaveBeenCalledWith({
        where: {
          studentId: 'student-1',
          source: 'COHORT',
          isExcludedFromCohort: false,
          section: { cohortId: 'cohort-1' },
        },
      });
      expect(tx.enrollment.delete).toHaveBeenCalledWith({
        where: { id: 'enrollment-1' },
      });
      expect(tx.enrollmentHistory.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { removedAt: expect.any(Date) } }),
      );
      expect(tx.cohortMembershipHistory.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { leftAt: expect.any(Date) } }),
      );
    });
  });

  it('reassignment closes the source history and preserves enrollment source', async () => {
    const tx = {
      enrollment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'enrollment-1', source: 'MANUAL' })
          .mockResolvedValueOnce(null),
        delete: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      enrollmentHistory: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = transactionPrisma(tx, {
      academicCycle: {
        findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve({
          id: where.id,
          status: AcademicCycleStatus.ACTIVE,
        })),
      },
      student: {
        findMany: jest.fn().mockResolvedValue([{ id: 'student-1', cohortId: null }]),
      },
      section: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'section-1' })
          .mockResolvedValueOnce({
            id: 'section-2',
            academicCycleId: 'cycle-2',
            cohortId: null,
            cohort: null,
          }),
      },
    });

    const service = new ReassignmentService(prisma as never);
    const result = await service.reassignStudents('org-1', {
      sourceType: 'section',
      studentIds: ['student-1'],
      fromSectionId: 'section-1',
      toSectionId: 'section-2',
      toCycleId: 'cycle-2',
    });

    expect(result.reassigned).toBe(1);
    expect(tx.enrollmentHistory.updateMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1', sectionId: 'section-1', removedAt: null },
      data: { removedAt: expect.any(Date) },
    });
    expect(tx.enrollment.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        sectionId: 'section-2',
        academicCycleId: 'cycle-2',
        source: 'MANUAL',
      },
    });
  });

  describe('delivery-history preservation', () => {
    it('closes a section with delivery dependents instead of deleting it', async () => {
      const prisma = {
        section: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'section-1',
            status: SectionLifecycleStatus.ACTIVE,
            course: { departmentId: 'department-1' },
            academicCycle: { status: AcademicCycleStatus.ACTIVE },
            _count: {
              enrollments: 1,
              enrollmentHistories: 0,
              assessments: 0,
              attendanceSessions: 0,
              schedules: 0,
              courseMaterials: 0,
              evaluations: 0,
              evaluationWindows: 0,
              preferenceOptions: 0,
              preferenceAudiences: 0,
              archiveSections: 0,
            },
          }),
          update: jest.fn().mockResolvedValue({}),
          delete: jest.fn(),
        },
      };
      const service = new SectionsService(prisma as never, {} as never);

      await service.deleteSection('org-1', 'section-1');

      expect(prisma.section.update).toHaveBeenCalledWith({
        where: { id: 'section-1' },
        data: { status: SectionLifecycleStatus.CLOSED },
      });
      expect(prisma.section.delete).not.toHaveBeenCalled();
    });

    it('retires an assessment with grades instead of deleting it', async () => {
      const prisma = {
        assessment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'assessment-1',
            organizationId: 'org-1',
            sectionId: 'section-1',
            status: 'ACTIVE',
            academicCycle: { status: AcademicCycleStatus.ACTIVE },
            _count: { grades: 1, submissions: 0 },
          }),
          update: jest.fn().mockResolvedValue({ id: 'assessment-1' }),
          delete: jest.fn(),
        },
      };
      const service = new AssessmentsService(
        prisma as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );

      await service.deleteAssessment('org-1', 'assessment-1', {
        id: 'admin-1',
        name: 'Admin',
        role: Role.ORG_ADMIN,
      });

      expect(prisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'RETIRED' },
      });
      expect(prisma.assessment.delete).not.toHaveBeenCalled();
    });
  });

  it('requires an audited reason before correcting a finalized grade', async () => {
    const prisma = {
      assessment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'assessment-1',
          organizationId: 'org-1',
          sectionId: 'section-1',
          academicCycleId: 'cycle-1',
          totalMarks: 100,
        }),
      },
      academicCycle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cycle-1', status: AcademicCycleStatus.ACTIVE }),
      },
      grade: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'grade-1',
          status: GradeStatus.FINALIZED,
        }),
        upsert: jest.fn(),
      },
    };
    const service = new AssessmentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.updateGrade(
        'org-1',
        'assessment-1',
        'student-1',
        { marksObtained: 90 },
        'admin-1',
        Role.ORG_ADMIN,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.grade.upsert).not.toHaveBeenCalled();
  });

  it('queries finalized grades only when building transcripts', async () => {
    const prisma = {
      student: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'student-1',
          registrationNumber: 'REG-1',
          rollNumber: 'ROLL-1',
          cohort: null,
          user: {
            id: 'user-1',
            name: 'Student',
            email: 'student@example.test',
            avatarUrl: null,
            avatarUpdatedAt: null,
          },
        }),
      },
      enrollmentHistory: { findMany: jest.fn().mockResolvedValue([]) },
      cohortMembershipHistory: { findMany: jest.fn().mockResolvedValue([]) },
      grade: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const gpaService = { applyRounding: jest.fn((value: number) => value) };
    const service = new TranscriptsService(
      prisma as never,
      gpaService as never,
      {} as never,
    );

    await service.getStudentTranscript('org-1', 'student-1', 'cycle-1');

    expect(prisma.grade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId: 'student-1',
          academicCycleId: 'cycle-1',
          status: 'FINALIZED',
        },
      }),
    );
  });

  it('authorizes same-organization staff before deleting file metadata', async () => {
    const prisma = {
      file: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'file-1',
          orgId: 'org-1',
          entityType: 'ASSESSMENT',
          entityId: 'assessment-1',
          path: 'path',
          publicId: null,
          filename: 'answer.pdf',
          mimeType: 'application/pdf',
          size: 10,
          uploadedBy: 'teacher-1',
          createdAt: new Date(),
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new FilesService(prisma as never);

    await service.deleteFile('file-1', {
      id: 'admin-1',
      role: Role.ORG_ADMIN,
      organizationId: 'org-1',
    });

    expect(prisma.file.delete).toHaveBeenCalledWith({ where: { id: 'file-1' } });
  });

  it('copy-forward reports zero assessments and never copies results', async () => {
    const tx = {
      section: { findFirst: jest.fn(), create: jest.fn() },
      sectionSchedule: { findFirst: jest.fn(), create: jest.fn() },
      courseMaterial: { create: jest.fn() },
    };
    const prisma = transactionPrisma(tx, {
      academicCycle: {
        findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(
          where.id === 'cycle-1'
            ? { id: 'cycle-1', code: 'FALL-2025', name: 'Fall 2025', status: AcademicCycleStatus.COMPLETED }
            : { id: 'cycle-2', code: 'SPRING-2026', name: 'Spring 2026', status: AcademicCycleStatus.DRAFT },
        )),
      },
      section: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const service = new CopyForwardService(prisma as never);

    const result = await service.copyForward('org-1', {
      programClassificationStatus: ProgramClassificationStatus.STANDALONE,
      fromCycleId: 'cycle-1',
      toCycleId: 'cycle-2',
      copySchedules: true,
      copyMaterials: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        sectionsCopied: 0,
        schedulesCopied: 0,
        assessmentsCopied: 0,
        materialsCopied: 0,
      }),
    );
    expect(tx).not.toHaveProperty('assessment');
    expect(tx).not.toHaveProperty('grade');
    expect(tx).not.toHaveProperty('submission');
    expect(tx).not.toHaveProperty('attendanceSession');
  });
});
