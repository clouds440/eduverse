import { AcademicCycleStatus, CohortOfferingStatus, CohortSectionSource } from '@/prisma/prisma-client';
import { Role } from '../common/enums';
import { CohortsService } from './cohorts.service';

const actor = { id: 'admin-1', role: Role.ORG_ADMIN };

function createService() {
  const prisma = {
    academicCycle: { findFirst: jest.fn() },
    cohort: { findFirst: jest.fn() },
    cohortOffering: { findFirst: jest.fn() },
    section: { findFirst: jest.fn(), findMany: jest.fn() },
    enrollment: { findMany: jest.fn() },
    student: { findMany: jest.fn() },
    studentCohortMembership: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const tx = {
    cohortOfferingSection: { upsert: jest.fn() },
    studentCohortMembership: { findMany: jest.fn() },
    enrollment: { upsert: jest.fn() },
  };
  const courseResultSchemes = {
    expandSectionIdsWithRelated: jest.fn(),
  };
  return {
    prisma,
    tx,
    courseResultSchemes,
    service: new CohortsService(prisma as never, {} as never, courseResultSchemes as never),
  };
}

function section(id: string, code: string) {
  return {
    id,
    code,
    name: `${code} Section`,
    academicCycleId: 'cycle-1',
    componentType: code.includes('LAB') ? 'LAB' : 'THEORY',
    course: { id: 'course-1', code: 'PHY', name: 'Physics', departmentId: 'dept-1' },
  };
}

describe('CohortsService relationship expansion', () => {
  it('previews related sections and missing enrollments before creating a cohort offering', async () => {
    const { service, prisma, courseResultSchemes } = createService();
    prisma.academicCycle.findFirst.mockResolvedValue({ id: 'cycle-1', status: AcademicCycleStatus.ACTIVE });
    courseResultSchemes.expandSectionIdsWithRelated.mockResolvedValue({
      sectionIds: ['theory-section', 'lab-section'],
      addedSectionIds: ['lab-section'],
      groups: [{ schemeId: 'scheme-1', schemeName: 'Physics relationship', triggerSectionId: 'theory-section', sections: [] }],
    });
    prisma.section.findMany.mockResolvedValue([section('theory-section', 'THEORY'), section('lab-section', 'LAB')]);
    prisma.enrollment.findMany.mockResolvedValue([{ studentId: 'student-1', sectionId: 'theory-section' }]);
    prisma.student.findMany.mockResolvedValue([{ id: 'student-1', registrationNumber: 'R-1', user: { name: 'Ada Lovelace', email: 'ada@example.com' } }]);

    const preview = await service.previewCreateOffering('org-1', {
      academicCycleId: 'cycle-1',
      studentIds: ['student-1'],
      sectionIds: ['theory-section'],
    }, actor);

    expect(preview).toMatchObject({
      selectedSectionCount: 1,
      expandedSectionCount: 2,
      addedRelatedSectionCount: 1,
      studentCount: 1,
      missingEnrollmentCount: 1,
      addedSectionIds: ['lab-section'],
    });
    expect(preview.missingEnrollments[0]).toMatchObject({ studentId: 'student-1', sectionId: 'lab-section' });
  });

  it('previews related section assignment against existing cohort offering membership', async () => {
    const { service, prisma, courseResultSchemes } = createService();
    prisma.cohortOffering.findFirst
      .mockResolvedValueOnce({
        id: 'offering-1',
        organizationId: 'org-1',
        status: CohortOfferingStatus.ACTIVE,
        academicCycleId: 'cycle-1',
        programStageOffering: null,
        sections: [{ sectionId: 'theory-section', section: section('theory-section', 'THEORY') }],
      })
      .mockResolvedValueOnce({
        id: 'offering-1',
        academicCycleId: 'cycle-1',
        programStageOfferingId: null,
        sections: [{ sectionId: 'theory-section', section: section('theory-section', 'THEORY') }],
      });
    prisma.section.findFirst.mockResolvedValue(section('theory-section', 'THEORY'));
    prisma.academicCycle.findFirst.mockResolvedValue({ id: 'cycle-1', status: AcademicCycleStatus.ACTIVE });
    courseResultSchemes.expandSectionIdsWithRelated.mockResolvedValue({
      sectionIds: ['theory-section', 'lab-section'],
      addedSectionIds: ['lab-section'],
      groups: [],
    });
    prisma.section.findMany.mockResolvedValue([section('theory-section', 'THEORY'), section('lab-section', 'LAB')]);
    prisma.studentCohortMembership.findMany.mockResolvedValue([{ studentId: 'student-1' }]);
    prisma.enrollment.findMany.mockResolvedValue([]);
    prisma.student.findMany.mockResolvedValue([{ id: 'student-1', registrationNumber: 'R-1', user: { name: 'Ada Lovelace', email: 'ada@example.com' } }]);

    const preview = await service.previewAssignSectionToCohort('org-1', 'offering-1', { sectionId: 'theory-section' }, actor);

    expect(preview.sectionsToAddCount).toBe(1);
    expect(preview.addedSectionIds).toEqual(['lab-section']);
    expect(preview.missingEnrollmentCount).toBe(2);
  });

  it('assigns every related section and enrolls cohort members into each default section', async () => {
    const { service, prisma, tx, courseResultSchemes } = createService();
    prisma.cohortOffering.findFirst
      .mockResolvedValueOnce({
        id: 'offering-1',
        organizationId: 'org-1',
        status: CohortOfferingStatus.ACTIVE,
        academicCycleId: 'cycle-1',
        programStageOffering: null,
        sections: [],
      })
      .mockResolvedValueOnce({
        id: 'offering-1',
        academicCycleId: 'cycle-1',
        programStageOfferingId: null,
        sections: [],
      });
    prisma.section.findFirst.mockResolvedValue(section('theory-section', 'THEORY'));
    prisma.academicCycle.findFirst.mockResolvedValue({ id: 'cycle-1', status: AcademicCycleStatus.ACTIVE });
    courseResultSchemes.expandSectionIdsWithRelated.mockResolvedValue({
      sectionIds: ['theory-section', 'lab-section'],
      addedSectionIds: ['lab-section'],
      groups: [],
    });
    prisma.section.findMany.mockResolvedValue([section('theory-section', 'THEORY'), section('lab-section', 'LAB')]);
    tx.cohortOfferingSection.upsert
      .mockResolvedValueOnce({ id: 'link-1', sectionId: 'theory-section' })
      .mockResolvedValueOnce({ id: 'link-2', sectionId: 'lab-section' });
    tx.studentCohortMembership.findMany.mockResolvedValue([{ id: 'membership-1', studentId: 'student-1', studentStageEnrollmentId: null }]);
    tx.enrollment.upsert.mockResolvedValue({});
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    const result = await service.assignSectionToCohort('org-1', 'offering-1', 'theory-section', actor, CohortSectionSource.MANUAL, true);

    expect(result).toMatchObject({ expandedSectionIds: ['theory-section', 'lab-section'], addedSectionIds: ['lab-section'] });
    expect(tx.cohortOfferingSection.upsert).toHaveBeenCalledTimes(2);
    expect(tx.enrollment.upsert).toHaveBeenCalledTimes(2);
  });
});
