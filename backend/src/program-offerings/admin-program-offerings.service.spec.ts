import {
  ProgramOfferingAction,
  ProgramOfferingAttendanceMode,
  ProgramOfferingDeliveryMode,
  ProgramOfferingStatus,
  ProgramStageOfferingStatus,
} from '@/prisma/prisma-client';
import { AdminProgramOfferingsService } from './admin-program-offerings.service';

const actor = { id: 'admin-1', role: 'ORG_ADMIN' };

function setup() {
  const prisma: any = {
    programOffering: { create: jest.fn().mockResolvedValue({ id: 'offering-1' }) },
  };
  const providers: any = {
    providerIdForOrganization: jest.fn().mockResolvedValue('provider-1'),
  };
  const catalog: any = {
    createData: jest.fn((providerId, dto, createdById) => ({ providerId, programId: dto.programId, code: dto.code, intakeName: dto.intakeName, timezone: dto.timezone, deliveryMode: dto.deliveryMode, attendanceMode: dto.attendanceMode, supportedActions: dto.supportedActions, createdById })),
    assertLocationsBelongToProvider: jest.fn(),
  };
  const campusBindings: any = {
    assertNewStages: jest.fn(),
    validateStages: jest.fn(),
  };
  const service = new AdminProgramOfferingsService(prisma, providers, catalog, campusBindings);
  return { service, prisma, providers, catalog, campusBindings };
}

describe('AdminProgramOfferingsService provider ownership', () => {
  it('creates a provider-owned offering with an explicit Campus binding', async () => {
    const { service, prisma, providers } = setup();
    jest.spyOn(service as any, 'context').mockResolvedValue({
      program: { id: 'program-1', providerId: 'provider-1' },
      curriculum: { id: 'curriculum-1' },
      cycle: { id: 'cycle-1' },
    });

    await service.create('org-1', {
      programId: 'program-1',
      code: 'BSCS-F26',
      intakeName: 'Fall 2026',
      timezone: 'Asia/Karachi',
      deliveryMode: ProgramOfferingDeliveryMode.ON_CAMPUS,
      attendanceMode: ProgramOfferingAttendanceMode.FULL_TIME,
      supportedActions: [ProgramOfferingAction.APPLY],
      status: ProgramOfferingStatus.DRAFT,
      campusBinding: {
        curriculumVersionId: 'curriculum-1',
        academicCycleId: 'cycle-1',
        stages: [{ programStageId: 'stage-1', status: ProgramStageOfferingStatus.PLANNED }],
      },
    }, actor);

    expect(providers.providerIdForOrganization).toHaveBeenCalledWith('org-1', 'provider-1');
    expect(prisma.programOffering.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        providerId: 'provider-1',
        campusBinding: { create: expect.objectContaining({ organizationId: 'org-1', academicCycleId: 'cycle-1' }) },
      }),
    }));
  });
});
