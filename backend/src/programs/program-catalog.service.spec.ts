import { ProgramType } from '@/prisma/prisma-client';
import { ProgramCatalogService } from './program-catalog.service';

describe('ProgramCatalogService', () => {
  it('creates a standalone provider program without Campus records', async () => {
    const created = {
      id: 'program-1',
      providerId: 'provider-standalone',
      name: 'Practical Product Design',
      code: 'PPD',
      slug: 'practical-product-design',
      programType: ProgramType.COURSE,
    };
    const prisma = {
      program: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const service = new ProgramCatalogService(prisma as never);

    await expect(service.createStandalone('provider-standalone', {
      name: 'Practical Product Design',
      code: 'ppd',
      programType: ProgramType.COURSE,
      subjectArea: 'Design',
      languageCodes: ['EN', 'en'],
      learningOutcomes: ['Build a product prototype'],
    })).resolves.toEqual(created);

    expect(prisma.program.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerId: 'provider-standalone',
        code: 'PPD',
        slug: 'practical-product-design',
        programType: ProgramType.COURSE,
        languageCodes: ['en'],
      }),
    });
    expect(prisma.program.create.mock.calls[0][0].data).not.toHaveProperty('organizationId');
    expect(prisma.program.create.mock.calls[0][0].data).not.toHaveProperty('campusConfiguration');
  });
});
