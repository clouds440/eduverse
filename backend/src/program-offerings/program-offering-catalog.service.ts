import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AdmissionApplicationVersionStatus,
  Prisma,
  ProgramOfferingAction,
  ProgramOfferingDeliveryMode,
  ProgramOfferingStatus,
  ProgramStatus,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramOfferingDto } from './dto/program-offering.dto';

export type PublicReadinessIssue = { code: string; message: string };

type GenericOfferingInput = Omit<CreateProgramOfferingDto, 'campusBinding'>;

@Injectable()
export class ProgramOfferingCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private slug(value: string | undefined) {
    const normalized = value?.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || null;
  }

  private optionalText(value: string | null | undefined) {
    if (value === undefined) return undefined;
    return value?.trim() || null;
  }

  validateDates(input: Pick<GenericOfferingInput, 'applicationOpensAt' | 'applicationClosesAt' | 'teachingStartsAt' | 'teachingEndsAt'>) {
    const opensAt = input.applicationOpensAt ? new Date(input.applicationOpensAt) : null;
    const closesAt = input.applicationClosesAt ? new Date(input.applicationClosesAt) : null;
    const startsAt = input.teachingStartsAt ? new Date(input.teachingStartsAt) : null;
    const endsAt = input.teachingEndsAt ? new Date(input.teachingEndsAt) : null;
    if (opensAt && closesAt && opensAt >= closesAt) {
      throw new BadRequestException('Application close date must be after its open date');
    }
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new BadRequestException('Teaching end date must be after its start date');
    }
  }

  createData(providerId: string, input: GenericOfferingInput, createdById: string): Prisma.ProgramOfferingUncheckedCreateInput {
    this.validateDates(input);
    return {
      providerId,
      programId: input.programId,
      code: input.code.trim().toUpperCase(),
      slug: this.slug(input.slug),
      intakeName: input.intakeName.trim(),
      status: input.status ?? ProgramOfferingStatus.DRAFT,
      applicationOpensAt: input.applicationOpensAt ? new Date(input.applicationOpensAt) : null,
      applicationClosesAt: input.applicationClosesAt ? new Date(input.applicationClosesAt) : null,
      teachingStartsAt: input.teachingStartsAt ? new Date(input.teachingStartsAt) : null,
      teachingEndsAt: input.teachingEndsAt ? new Date(input.teachingEndsAt) : null,
      timezone: input.timezone.trim(),
      capacity: input.capacity,
      waitlistEnabled: input.waitlistEnabled ?? false,
      deliveryMode: input.deliveryMode,
      attendanceMode: input.attendanceMode,
      scheduleSummary: this.optionalText(input.scheduleSummary),
      durationValue: input.durationValue,
      durationUnit: input.durationUnit,
      languageCodes: [...new Set((input.languageCodes ?? []).map((code) => code.trim().toLowerCase()).filter(Boolean))],
      publicSummary: this.optionalText(input.publicSummary),
      detailedInstructions: this.optionalText(input.detailedInstructions),
      contactEmail: this.optionalText(input.contactEmail)?.toLowerCase(),
      supportedActions: [...new Set(input.supportedActions)],
      notes: this.optionalText(input.notes),
      onlineAdmissionEnabled: input.onlineAdmissionEnabled ?? false,
      onlineAdmissionInstructions: this.optionalText(input.onlineAdmissionInstructions),
      createdById,
      locations: input.locationIds?.length
        ? { create: [...new Set(input.locationIds)].map((providerLocationId, sortOrder) => ({ providerLocationId, sortOrder })) }
        : undefined,
    };
  }

  async createStandalone(providerId: string, input: GenericOfferingInput, createdById: string) {
    if (input.status && input.status !== ProgramOfferingStatus.DRAFT) {
      throw new ConflictException('New program offerings must start as DRAFT');
    }
    const program = await this.prisma.program.findFirst({ where: { id: input.programId, providerId } });
    if (!program) throw new NotFoundException('Program not found');
    await this.assertLocationsBelongToProvider(providerId, input.locationIds);
    try {
      return await this.prisma.programOffering.create({
        data: this.createData(providerId, input, createdById),
      include: { program: true, locations: { include: { providerLocation: true } }, fees: true, fundingOptions: true, admissionRequirements: true, campusBinding: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An offering with this code or slug already exists for the provider');
      }
      throw error;
    }
  }

  async openApplications(providerId: string, id: string) {
    const offering = await this.prisma.programOffering.findFirst({
      where: { id, providerId },
      include: { program: true, locations: true, fees: true, admissionRequirements: true, applicationConfig: { include: { applicationVersion: true } } },
    });
    if (!offering) throw new NotFoundException('Program offering not found');
    if (!([ProgramOfferingStatus.DRAFT, ProgramOfferingStatus.PUBLISHED] as ProgramOfferingStatus[]).includes(offering.status)) {
      throw new ConflictException('Only a draft or published offering can open applications');
    }
    const readiness = this.publicReadiness(offering);
    if (!readiness.ready) {
      throw new ConflictException(readiness.blockers.map((blocker) => blocker.message).join(' '));
    }
    return this.prisma.programOffering.update({ where: { id }, data: { status: ProgramOfferingStatus.OPEN } });
  }

  async assertLocationsBelongToProvider(providerId: string, locationIds: string[] | undefined) {
    const ids = [...new Set(locationIds ?? [])];
    if (!ids.length) return;
    const count = await this.prisma.providerLocation.count({ where: { id: { in: ids }, providerId, isActive: true } });
    if (count !== ids.length) throw new BadRequestException('One or more locations do not belong to this provider');
  }

  publicReadiness(offering: {
    id: string;
    intakeName: string;
    timezone: string;
    deliveryMode: ProgramOfferingDeliveryMode;
    supportedActions: string[];
    applicationOpensAt: Date | null;
    applicationClosesAt: Date | null;
    teachingStartsAt: Date | null;
    teachingEndsAt: Date | null;
    publicSummary: string | null;
    onlineAdmissionEnabled?: boolean;
    program: { status: ProgramStatus };
    locations: unknown[];
    fees?: unknown[];
    admissionRequirements?: unknown[];
    applicationConfig?: { applicationVersion: { status: AdmissionApplicationVersionStatus } } | null;
  }) {
    const blockers: PublicReadinessIssue[] = [];
    if (offering.program.status !== ProgramStatus.ACTIVE) {
      blockers.push({ code: 'PROGRAM_NOT_ACTIVE', message: 'Activate the program before publishing this offering.' });
    }
    if (!offering.intakeName.trim()) blockers.push({ code: 'MISSING_INTAKE_NAME', message: 'Add an intake name.' });
    if (!offering.timezone.trim()) blockers.push({ code: 'MISSING_TIMEZONE', message: 'Select an offering timezone.' });
    if (!offering.publicSummary?.trim()) blockers.push({ code: 'MISSING_PUBLIC_SUMMARY', message: 'Add a public offering summary.' });
    if (!offering.supportedActions.length) blockers.push({ code: 'NO_SUPPORTED_ACTION', message: 'Enable at least one public action.' });
    if (offering.supportedActions.includes(ProgramOfferingAction.APPLY) && !offering.fees?.length) {
      blockers.push({ code: 'MISSING_FEE_DISCLOSURE', message: 'Add fee disclosure, even if the offering has no tuition or application fee.' });
    }
    if (offering.supportedActions.includes(ProgramOfferingAction.APPLY) && !offering.admissionRequirements?.length) {
      blockers.push({ code: 'MISSING_ELIGIBILITY_REQUIREMENTS', message: 'Add eligibility or admission requirements.' });
    }
    if ((offering.onlineAdmissionEnabled || offering.supportedActions.includes(ProgramOfferingAction.APPLY))
      && offering.applicationConfig?.applicationVersion.status !== AdmissionApplicationVersionStatus.PUBLISHED) {
      blockers.push({ code: 'MISSING_APPLICATION_FORM', message: 'Assign a published admission form before opening applications.' });
    }
    if (offering.applicationOpensAt && offering.applicationClosesAt && offering.applicationOpensAt >= offering.applicationClosesAt) {
      blockers.push({ code: 'INVALID_APPLICATION_WINDOW', message: 'Application close date must be after its open date.' });
    }
    if (offering.teachingStartsAt && offering.teachingEndsAt && offering.teachingStartsAt >= offering.teachingEndsAt) {
      blockers.push({ code: 'INVALID_TEACHING_DATES', message: 'Teaching end date must be after its start date.' });
    }
    if (([ProgramOfferingDeliveryMode.ON_CAMPUS, ProgramOfferingDeliveryMode.HYBRID] as ProgramOfferingDeliveryMode[]).includes(offering.deliveryMode) && !offering.locations.length) {
      blockers.push({ code: 'PHYSICAL_LOCATION_REQUIRED', message: 'Add a location for an on-campus or hybrid offering.' });
    }
    return { offeringId: offering.id, ready: blockers.length === 0, blockers };
  }
}
