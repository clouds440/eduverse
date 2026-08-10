import { NotFoundException } from '@nestjs/common';
import {
  AcademicCycleStatus,
  ProgramOfferingStatus,
  ProgramStructureType,
} from '@/prisma/prisma-client';
import { ProgramOfferingsService } from './program-offerings.service';
import { ProgramOfferingsController } from './program-offerings.controller';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

const sharedCycle = {
  id: 'cycle-shared',
  name: 'Fall 2026',
  code: 'FALL-2026',
  startDate: new Date('2026-09-01'),
  endDate: new Date('2026-12-31'),
  status: AcademicCycleStatus.ACTIVE,
};

function program(overrides: Record<string, unknown> = {}) {
  return {
    id: 'program-1',
    name: 'Computer Science',
    code: 'BSCS',
    admissionsLabel: 'BS Computer Science',
    admissionsDescription: 'Four semester degree',
    configurationVersion: 3,
    structureType: ProgramStructureType.TERM_BASED,
    durationValue: 2,
    durationUnit: 'YEARS',
    department: { id: 'department-1', name: 'Computing', code: 'CS' },
    configurationRevisions: [{ id: 'revision-3', version: 3 }],
    offerings: [{ id: 'offering-1', status: ProgramOfferingStatus.OPEN, academicCycle: sharedCycle }],
    curriculumVersions: [{
      id: 'curriculum-1',
      name: 'BSCS 2026',
      code: 'BSCS-2026',
      programConfigurationRevisionId: 'revision-3',
      stages: [
        { id: 'stage-1', sequence: 1, isOptional: false, _count: { courseRequirements: 3 } },
        { id: 'stage-2', sequence: 2, isOptional: false, _count: { courseRequirements: 3 } },
      ],
    }],
    ...overrides,
  };
}

function organization(programs = [program()]) {
  return {
    id: 'org-private-id',
    name: 'Example Institute',
    slug: 'example-institute',
    logoUrl: '/logo.png',
    programs,
  };
}

describe('ProgramOfferingsService', () => {
  it('marks the public admissions controller as public', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ProgramOfferingsController)).toBe(true);
  });

  it('returns stable program details with independently shared cycle offerings', async () => {
    const prisma = { organization: { findFirst: jest.fn().mockResolvedValue(organization()) } };
    const service = new ProgramOfferingsService(prisma as never);

    const result = await service.list('EXAMPLE-INSTITUTE');

    expect(prisma.organization.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ slug: 'example-institute', status: 'APPROVED' }),
    }));
    expect(result).toEqual({
      organization: { name: 'Example Institute', slug: 'example-institute', logoUrl: '/logo.png' },
      offerings: [{
        programId: 'program-1',
        name: 'BS Computer Science',
        code: 'BSCS',
        description: 'Four semester degree',
        department: { id: 'department-1', name: 'Computing', code: 'CS' },
        requiredStageCount: 2,
        structureType: 'TERM_BASED',
        duration: { value: 2, unit: 'YEARS' },
        curriculum: { id: 'curriculum-1', name: 'BSCS 2026', code: 'BSCS-2026' },
        programConfigurationRevision: { id: 'revision-3', version: 3 },
        eligibleEntryCycles: [{ programOfferingId: 'offering-1', academicCycle: sharedCycle }],
      }],
    });
    expect(JSON.stringify(result)).not.toContain('org-private-id');
  });

  it.each([
    ['missing current revision', { configurationRevisions: [] }],
    ['missing admissions curriculum', { curriculumVersions: [] }],
    ['incomplete required stage', {
      curriculumVersions: [{
        id: 'curriculum-1', name: 'BSCS 2026', code: 'BSCS-2026', programConfigurationRevisionId: 'revision-3',
        stages: [{ id: 'stage-1', sequence: 1, isOptional: false, _count: { courseRequirements: 0 } }],
      }],
    }],
  ])('silently excludes a visible program with %s', async (_label, overrides) => {
    const prisma = { organization: { findFirst: jest.fn().mockResolvedValue(organization([program(overrides)])) } };
    const service = new ProgramOfferingsService(prisma as never);
    await expect(service.list('example-institute')).resolves.toMatchObject({ offerings: [] });
  });

  it('reuses one institute cycle across multiple programs without duplicating it', async () => {
    const second = program({
      id: 'program-2',
      code: 'BBA',
      offerings: [{ id: 'offering-2', status: ProgramOfferingStatus.OPEN, academicCycle: sharedCycle }],
    });
    const prisma = { organization: { findFirst: jest.fn().mockResolvedValue(organization([program(), second])) } };
    const result = await new ProgramOfferingsService(prisma as never).list('example-institute');

    expect(result.offerings.map((offering) => offering.eligibleEntryCycles[0])).toEqual([
      { programOfferingId: 'offering-1', academicCycle: sharedCycle },
      { programOfferingId: 'offering-2', academicCycle: sharedCycle },
    ]);
  });

  it('returns not found for an unavailable organization slug', async () => {
    const service = new ProgramOfferingsService({ organization: { findFirst: jest.fn().mockResolvedValue(null) } } as never);
    await expect(service.list('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
