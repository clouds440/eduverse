import { AcademicCycleStatus, CurriculumStatus } from '@/prisma/prisma-client';
import { CampusProgramOfferingBindingsService } from './campus-program-offering-bindings.service';

describe('CampusProgramOfferingBindingsService', () => {
  it('reports Campus delivery blockers independently from public listing readiness', () => {
    const service = new CampusProgramOfferingBindingsService({} as never);

    const readiness = service.deliveryReadiness({
      campusBinding: {
        curriculumVersion: { status: CurriculumStatus.DRAFT },
        academicCycle: { status: AcademicCycleStatus.ACTIVE },
      },
      stageOfferings: [],
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CURRICULUM_NOT_ACTIVE' }),
      expect.objectContaining({ code: 'NO_STAGES' }),
    ]));
  });

  it('does not treat a standalone offering as Campus-ready', () => {
    const service = new CampusProgramOfferingBindingsService({} as never);
    expect(service.deliveryReadiness({ campusBinding: null, stageOfferings: [] })).toEqual({
      ready: false,
      blockers: [{ code: 'CAMPUS_BINDING_REQUIRED', message: 'Bind this offering to a Campus curriculum and academic cycle.' }],
      warnings: [],
    });
  });
});
