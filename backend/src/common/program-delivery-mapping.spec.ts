import { BadRequestException, ConflictException } from '@nestjs/common';
import { SectionsService } from '../sections/sections.service';

describe('section program delivery mapping invariants', () => {
  const mapping = {
    programStageOfferingId: 'stage-offering-1',
    stageCourseRequirementId: 'requirement-1',
  };

  it('accepts standalone delivery as an empty mapping list', async () => {
    const service = new SectionsService({} as never, {} as never);
    await expect((service as any).validateMappings({}, 'org-1', 'cycle-1', 'course-1', []))
      .resolves.toEqual([]);
  });

  it('rejects duplicate stage-offering and requirement pairs', async () => {
    const service = new SectionsService({} as never, {} as never);
    await expect((service as any).validateMappings({}, 'org-1', 'cycle-1', 'course-1', [mapping, mapping]))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('queries requirements by tenant and course in the selected cycle offering', async () => {
    const client = {
      stageCourseRequirement: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'requirement-1',
          programStage: { offerings: [{ id: 'stage-offering-1' }] },
        }]),
      },
    };
    const service = new SectionsService({} as never, {} as never);

    await expect((service as any).validateMappings(client, 'org-1', 'cycle-1', 'course-1', [mapping]))
      .resolves.toEqual([mapping]);
    expect(client.stageCourseRequirement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org-1', courseId: 'course-1' }),
      include: expect.objectContaining({ programStage: expect.any(Object) }),
    }));
  });

  it('rejects a requirement that is not served by the selected stage offering', async () => {
    const client = {
      stageCourseRequirement: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'requirement-1',
          programStage: { offerings: [] },
        }]),
      },
    };
    const service = new SectionsService({} as never, {} as never);
    await expect((service as any).validateMappings(client, 'org-1', 'cycle-1', 'course-1', [mapping]))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
