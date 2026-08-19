import {
  AdmissionApplicationVersionStatus,
  ProgramOfferingAction,
  ProgramOfferingAttendanceMode,
  ProgramOfferingDeliveryMode,
  ProgramOfferingStatus,
  ProgramStatus,
} from '@/prisma/prisma-client';
import { ProgramOfferingCatalogService } from './program-offering-catalog.service';

const input = {
  programId: 'program-1',
  code: 'WEB-SEP-26',
  intakeName: 'September 2026',
  timezone: 'UTC',
  deliveryMode: ProgramOfferingDeliveryMode.ONLINE,
  attendanceMode: ProgramOfferingAttendanceMode.SELF_PACED,
  supportedActions: [ProgramOfferingAction.APPLY],
  publicSummary: 'A practical online web development course.',
};

describe('ProgramOfferingCatalogService', () => {
  it('creates a standalone offering without an organization, curriculum, or academic cycle', async () => {
    const prisma: any = {
      program: { findFirst: jest.fn().mockResolvedValue({ id: 'program-1' }) },
      providerLocation: { count: jest.fn() },
      programOffering: { create: jest.fn().mockResolvedValue({ id: 'offering-1', campusBinding: null }) },
    };
    const service = new ProgramOfferingCatalogService(prisma);

    await service.createStandalone('provider-1', input, 'owner-1');

    expect(prisma.programOffering.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        providerId: 'provider-1',
        programId: 'program-1',
        status: ProgramOfferingStatus.DRAFT,
      }),
    }));
    const data = prisma.programOffering.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('organizationId');
    expect(data).not.toHaveProperty('academicCycleId');
    expect(data).not.toHaveProperty('curriculumVersionId');
  });

  it('opens a ready online offering without a Campus binding', async () => {
    const offering = {
      id: 'offering-1',
      providerId: 'provider-1',
      status: ProgramOfferingStatus.DRAFT,
      intakeName: input.intakeName,
      timezone: input.timezone,
      deliveryMode: input.deliveryMode,
      supportedActions: input.supportedActions,
      applicationOpensAt: null,
      applicationClosesAt: null,
      teachingStartsAt: null,
      teachingEndsAt: null,
      publicSummary: input.publicSummary,
      onlineAdmissionEnabled: true,
      fees: [{ label: 'No application fee' }],
      admissionRequirements: [{ label: 'Open admission' }],
      program: { status: ProgramStatus.ACTIVE },
      locations: [],
      applicationConfig: { applicationVersion: { status: AdmissionApplicationVersionStatus.PUBLISHED } },
    };
    const prisma: any = {
      programOffering: {
        findFirst: jest.fn().mockResolvedValue(offering),
        update: jest.fn().mockResolvedValue({ ...offering, status: ProgramOfferingStatus.OPEN }),
      },
    };
    const service = new ProgramOfferingCatalogService(prisma);

    await expect(service.openApplications('provider-1', 'offering-1')).resolves.toMatchObject({ status: ProgramOfferingStatus.OPEN });
    expect(prisma.programOffering.update).toHaveBeenCalledWith({ where: { id: 'offering-1' }, data: { status: ProgramOfferingStatus.OPEN } });
  });

  it('requires fee and eligibility disclosure before applications open', () => {
    const service = new ProgramOfferingCatalogService({} as any);

    const readiness = service.publicReadiness({
      id: 'offering-1',
      intakeName: input.intakeName,
      timezone: input.timezone,
      deliveryMode: input.deliveryMode,
      supportedActions: input.supportedActions,
      applicationOpensAt: null,
      applicationClosesAt: null,
      teachingStartsAt: null,
      teachingEndsAt: null,
      publicSummary: input.publicSummary,
      onlineAdmissionEnabled: true,
      program: { status: ProgramStatus.ACTIVE },
      locations: [],
      fees: [],
      admissionRequirements: [],
      applicationConfig: { applicationVersion: { status: AdmissionApplicationVersionStatus.PUBLISHED } },
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'MISSING_FEE_DISCLOSURE',
      'MISSING_ELIGIBILITY_REQUIREMENTS',
    ]));
  });
});
