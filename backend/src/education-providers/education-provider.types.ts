import {
  EducationProviderMembershipStatus,
  EducationProviderRole,
  Role,
} from '@/prisma/prisma-client';

export enum EducationProviderCapability {
  MANAGE_PROGRAMS = 'MANAGE_PROGRAMS',
  MANAGE_ADMISSIONS = 'MANAGE_ADMISSIONS',
  REVIEW_APPLICATIONS = 'REVIEW_APPLICATIONS',
  VIEW = 'VIEW',
}

const PROVIDER_ROLE_CAPABILITIES: Record<EducationProviderRole, EducationProviderCapability[]> = {
  [EducationProviderRole.OWNER]: Object.values(EducationProviderCapability),
  [EducationProviderRole.ADMIN]: Object.values(EducationProviderCapability),
  [EducationProviderRole.PROGRAM_MANAGER]: [
    EducationProviderCapability.MANAGE_PROGRAMS,
    EducationProviderCapability.VIEW,
  ],
  [EducationProviderRole.ADMISSIONS_MANAGER]: [
    EducationProviderCapability.MANAGE_ADMISSIONS,
    EducationProviderCapability.REVIEW_APPLICATIONS,
    EducationProviderCapability.VIEW,
  ],
  [EducationProviderRole.REVIEWER]: [
    EducationProviderCapability.REVIEW_APPLICATIONS,
    EducationProviderCapability.VIEW,
  ],
  [EducationProviderRole.VIEWER]: [EducationProviderCapability.VIEW],
};

const CAMPUS_ROLE_CAPABILITIES: Partial<Record<Role, EducationProviderCapability[]>> = {
  [Role.ORG_ADMIN]: Object.values(EducationProviderCapability),
  [Role.SUB_ADMIN]: Object.values(EducationProviderCapability),
  [Role.ORG_MANAGER]: [
    EducationProviderCapability.REVIEW_APPLICATIONS,
    EducationProviderCapability.VIEW,
  ],
};

export type EducationProviderActorContext = {
  providerId: string;
  userId: string;
  campusOrganizationId: string | null;
  membershipRole: EducationProviderRole | null;
  membershipStatus: EducationProviderMembershipStatus | null;
  capabilities: EducationProviderCapability[];
};

export function capabilitiesForProviderActor(
  membershipRole: EducationProviderRole | null,
  campusRole: Role | null,
) {
  if (membershipRole) return PROVIDER_ROLE_CAPABILITIES[membershipRole];
  return campusRole ? CAMPUS_ROLE_CAPABILITIES[campusRole] || [] : [];
}
