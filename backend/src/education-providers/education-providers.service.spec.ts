import { ForbiddenException } from '@nestjs/common';
import {
  EducationProviderKind,
  EducationProviderMembershipStatus,
  EducationProviderRole,
  EducationProviderStatus,
  OrgStatus,
  Role,
} from '@/prisma/prisma-client';
import { EducationProviderCapability } from './education-provider.types';
import { EducationProvidersService } from './education-providers.service';

function setup() {
  const prisma: any = {
    organization: { findUnique: jest.fn() },
    educationProvider: { upsert: jest.fn(), findUnique: jest.fn() },
    educationProviderMembership: { findUnique: jest.fn() },
  };
  return { service: new EducationProvidersService(prisma), prisma };
}

describe('EducationProvidersService', () => {
  it('provisions a Campus provider from organization identity', async () => {
    const { service, prisma } = setup();
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      name: 'North Academy',
      slug: 'north-academy',
      type: 'ACADEMY',
      status: OrgStatus.APPROVED,
      currency: 'PKR',
      contactEmail: 'contact@example.test',
    });
    prisma.educationProvider.upsert.mockResolvedValue({ id: 'provider-1' });

    await service.ensureCampusProvider('org-1');

    expect(prisma.educationProvider.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { campusOrganizationId: 'org-1' },
      create: expect.objectContaining({
        kind: EducationProviderKind.ACADEMY,
        status: EducationProviderStatus.ACTIVE,
        campusOrganizationId: 'org-1',
      }),
    }));
  });

  it('maps an existing Campus administrator into provider capabilities', async () => {
    const { service, prisma } = setup();
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-1', name: 'School', slug: 'school', type: 'HIGH_SCHOOL',
      status: OrgStatus.APPROVED, currency: 'USD', contactEmail: 'school@example.test',
    });
    prisma.educationProvider.upsert.mockResolvedValue({ id: 'provider-1', campusOrganizationId: 'org-1' });
    prisma.educationProviderMembership.findUnique.mockResolvedValue(null);

    const context = await service.actorContext({
      organizationId: 'org-1',
      userId: 'admin-1',
      campusRole: Role.ORG_ADMIN,
    });

    expect(context.capabilities).toContain(EducationProviderCapability.MANAGE_PROGRAMS);
    expect(context.capabilities).toContain(EducationProviderCapability.MANAGE_ADMISSIONS);
  });

  it('rejects a suspended direct provider membership', async () => {
    const { service, prisma } = setup();
    prisma.educationProvider.findUnique.mockResolvedValue({ id: 'provider-1', campusOrganizationId: null });
    prisma.educationProviderMembership.findUnique.mockResolvedValue({
      role: EducationProviderRole.OWNER,
      status: EducationProviderMembershipStatus.SUSPENDED,
    });

    await expect(service.actorContext({ providerId: 'provider-1', userId: 'owner-1' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('authorizes an active standalone provider owner without a Campus organization', async () => {
    const { service, prisma } = setup();
    prisma.educationProvider.findUnique.mockResolvedValue({ id: 'provider-standalone', campusOrganizationId: null });
    prisma.educationProviderMembership.findUnique.mockResolvedValue({
      role: EducationProviderRole.OWNER,
      status: EducationProviderMembershipStatus.ACTIVE,
    });

    const context = await service.actorContext({
      providerId: 'provider-standalone',
      userId: 'educator-1',
    });

    expect(context.campusOrganizationId).toBeNull();
    expect(context.capabilities).toEqual(expect.arrayContaining([
      EducationProviderCapability.MANAGE_PROGRAMS,
      EducationProviderCapability.MANAGE_ADMISSIONS,
    ]));
  });

  it('rejects a record whose provider belongs to another organization', async () => {
    const { service, prisma } = setup();
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-1', name: 'School', slug: 'school', type: 'HIGH_SCHOOL',
      status: OrgStatus.APPROVED, currency: 'USD', contactEmail: 'school@example.test',
    });
    prisma.educationProvider.upsert.mockResolvedValue({ id: 'provider-1' });

    await expect(service.providerIdForOrganization('org-1', 'provider-2'))
      .rejects.toThrow('ownership does not match');
  });
});
