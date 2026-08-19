import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EducationProviderKind,
  EducationProviderMembershipStatus,
  EducationProviderStatus,
  OrgStatus,
  Prisma,
  Role,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import {
  capabilitiesForProviderActor,
  EducationProviderActorContext,
  EducationProviderCapability,
} from './education-provider.types';

type ProviderClient = Pick<
  Prisma.TransactionClient,
  'organization' | 'educationProvider' | 'educationProviderMembership'
>;

@Injectable()
export class EducationProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  private kind(type: string): EducationProviderKind {
    if (type === 'ACADEMY') return EducationProviderKind.ACADEMY;
    if (['VOCATIONAL_SCHOOL', 'INSTITUTE', 'TUTORING_CENTER'].includes(type)) {
      return EducationProviderKind.TRAINING_PROVIDER;
    }
    if (type === 'ONLINE_SCHOOL') return EducationProviderKind.ONLINE_PROVIDER;
    return EducationProviderKind.INSTITUTION;
  }

  private status(status: OrgStatus): EducationProviderStatus {
    if (status === OrgStatus.APPROVED) return EducationProviderStatus.ACTIVE;
    if (status === OrgStatus.SUSPENDED) return EducationProviderStatus.SUSPENDED;
    return EducationProviderStatus.DRAFT;
  }

  async ensureCampusProvider(
    organizationId: string,
    client: ProviderClient = this.prisma,
  ) {
    const organization = await client.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        currency: true,
        contactEmail: true,
      },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    return client.educationProvider.upsert({
      where: { campusOrganizationId: organizationId },
      update: {
        displayName: organization.name,
        kind: this.kind(organization.type),
        status: this.status(organization.status),
        defaultCurrency: organization.currency,
        contactEmail: organization.contactEmail,
      },
      create: {
        kind: this.kind(organization.type),
        displayName: organization.name,
        slug: organization.slug,
        status: this.status(organization.status),
        campusOrganizationId: organization.id,
        defaultCurrency: organization.currency,
        contactEmail: organization.contactEmail,
      },
    });
  }

  async actorContext(input: {
    providerId?: string;
    organizationId?: string;
    userId: string;
    campusRole?: Role | null;
  }): Promise<EducationProviderActorContext> {
    const provider = input.providerId
      ? await this.prisma.educationProvider.findUnique({ where: { id: input.providerId } })
      : input.organizationId
        ? await this.ensureCampusProvider(input.organizationId)
        : null;
    if (!provider) throw new NotFoundException('Education provider not found');

    const membership = await this.prisma.educationProviderMembership.findUnique({
      where: { providerId_userId: { providerId: provider.id, userId: input.userId } },
    });
    if (membership && membership.status !== EducationProviderMembershipStatus.ACTIVE) {
      throw new ForbiddenException('Education provider membership is not active');
    }

    const capabilities = capabilitiesForProviderActor(
      membership?.role || null,
      input.campusRole || null,
    );
    if (!capabilities.length) throw new ForbiddenException('You do not have access to this education provider');

    return {
      providerId: provider.id,
      userId: input.userId,
      campusOrganizationId: provider.campusOrganizationId,
      membershipRole: membership?.role || null,
      membershipStatus: membership?.status || null,
      capabilities,
    };
  }

  async providerIdForOrganization(
    organizationId: string,
    recordProviderId?: string | null,
  ) {
    const provider = await this.ensureCampusProvider(organizationId);
    if (recordProviderId && recordProviderId !== provider.id) {
      throw new ConflictException('Education provider ownership does not match the Campus organization');
    }
    return provider.id;
  }

  assertCapability(
    context: EducationProviderActorContext,
    capability: EducationProviderCapability,
  ) {
    if (!context.capabilities.includes(capability)) {
      throw new ForbiddenException(`Missing education provider capability: ${capability}`);
    }
  }
}
