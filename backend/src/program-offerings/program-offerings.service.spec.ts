import { NotFoundException } from '@nestjs/common';
import {
  AcademicCycleStatus,
  ProgramStructureType,
} from '@/prisma/prisma-client';
import { ProgramOfferingsService } from './program-offerings.service';
import { ProgramOfferingsController } from './program-offerings.controller';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

function program(overrides: Record<string, unknown> = {}) {
  return {
    id: 'program-1',
    name: 'Computer Science',
    code: 'BSCS',
    admissionsLabel: 'BS Computer Science',
    admissionsDescription: 'Four semester degree',
    requiredCycleCount: 2,
    configurationVersion: 3,
    structureType: ProgramStructureType.TERM_BASED,
    durationValue: 2,
    durationUnit: 'YEARS',
    department: { id: 'department-1', name: 'Computing', code: 'CS' },
    configurationRevisions: [{ id: 'revision-3', version: 3, requiredCycleCount: 2 }],
    academicCycles: [
      {
        id: 'program-cycle-1',
        sequence: 1,
        academicCycle: {
          id: 'cycle-shared',
          name: 'Fall 2026',
          code: 'FALL-2026',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-12-31'),
          status: AcademicCycleStatus.ACTIVE,
        },
      },
      {
        id: 'program-cycle-2',
        sequence: 2,
        academicCycle: {
          id: 'cycle-2',
          name: 'Spring 2027',
          code: 'SPRING-2027',
          startDate: new Date('2027-01-01'),
          endDate: new Date('2027-05-31'),
          status: AcademicCycleStatus.DRAFT,
        },
      },
    ],
    curriculumVersions: [{
      id: 'curriculum-1',
      name: 'BSCS 2026',
      code: 'BSCS-2026',
      programConfigurationRevisionId: 'revision-3',
      stages: [
        { id: 'stage-1', sequence: 1, programAcademicCycleId: 'program-cycle-1', isOptional: false, _count: { courseRequirements: 3 } },
        { id: 'stage-2', sequence: 2, programAcademicCycleId: 'program-cycle-2', isOptional: false, _count: { courseRequirements: 3 } },
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
  it('marks the offerings controller as public without weakening authenticated program CRUD', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ProgramOfferingsController)).toBe(true);
  });

  it('returns only the explicit admission-safe projection', async () => {
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
        requiredCycleCount: 2,
        structureType: 'TERM_BASED',
        duration: { value: 2, unit: 'YEARS' },
        curriculum: { id: 'curriculum-1', name: 'BSCS 2026', code: 'BSCS-2026' },
        programConfigurationRevision: { id: 'revision-3', version: 3 },
        eligibleEntryCycles: expect.arrayContaining([
          expect.objectContaining({ programAcademicCycleId: 'program-cycle-1', academicCycle: expect.objectContaining({ id: 'cycle-shared' }) }),
        ]),
      }],
    });
    expect(JSON.stringify(result)).not.toContain('org-private-id');
  });

  it.each([
    ['missing current revision', { configurationRevisions: [] }],
    ['wrong cycle count', { requiredCycleCount: 3 }],
    ['incomplete required stage', {
      curriculumVersions: [{
        id: 'curriculum-1', name: 'BSCS 2026', code: 'BSCS-2026', programConfigurationRevisionId: 'revision-3',
        stages: [
          { id: 'stage-1', sequence: 1, programAcademicCycleId: 'program-cycle-1', isOptional: false, _count: { courseRequirements: 0 } },
          { id: 'stage-2', sequence: 2, programAcademicCycleId: 'program-cycle-2', isOptional: false, _count: { courseRequirements: 3 } },
        ],
      }],
    }],
  ])('silently excludes a visible program with %s', async (_label, overrides) => {
    const prisma = { organization: { findFirst: jest.fn().mockResolvedValue(organization([program(overrides)])) } };
    const service = new ProgramOfferingsService(prisma as never);

    await expect(service.list('example-institute')).resolves.toMatchObject({ offerings: [] });
  });

  it('represents one shared institute cycle independently under multiple programs', async () => {
    const second = program({
      id: 'program-2',
      code: 'BBA',
      academicCycles: program().academicCycles.map((row, index) => ({
        ...row,
        id: `bba-program-cycle-${index + 1}`,
      })),
      curriculumVersions: [{
        ...program().curriculumVersions[0],
        id: 'curriculum-2',
        stages: program().curriculumVersions[0].stages.map((stage, index) => ({
          ...stage,
          programAcademicCycleId: `bba-program-cycle-${index + 1}`,
        })),
      }],
    });
    const prisma = { organization: { findFirst: jest.fn().mockResolvedValue(organization([program(), second])) } };
    const service = new ProgramOfferingsService(prisma as never);

    const result = await service.list('example-institute');

    expect(result.offerings).toHaveLength(2);
    expect(result.offerings.map((offering) => offering.eligibleEntryCycles[0].academicCycle.id)).toEqual([
      'cycle-shared',
      'cycle-shared',
    ]);
    expect(result.offerings.map((offering) => offering.eligibleEntryCycles[0].programAcademicCycleId)).toEqual([
      'program-cycle-1',
      'bba-program-cycle-1',
    ]);
  });

  it('returns not found for unapproved or unknown organization slugs', async () => {
    const service = new ProgramOfferingsService({ organization: { findFirst: jest.fn().mockResolvedValue(null) } } as never);
    await expect(service.list('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
