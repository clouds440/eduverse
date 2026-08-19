import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@/prisma/prisma-client';
import { normalizeEntityCode } from '../common/entity-code';
import { PrismaService } from '../prisma/prisma.service';
import { ProgramCatalogInputDto, UpdateProgramDto } from './dto/program.dto';

type ProgramClient = PrismaService | Prisma.TransactionClient;

function normalizeProgramSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'program';
}

@Injectable()
export class ProgramCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private text(value?: string | null) {
    return value?.trim() || null;
  }

  async assertUnique(
    client: ProgramClient,
    providerId: string,
    input: { name: string; code: string; slug?: string },
    excludeId?: string,
  ) {
    const name = input.name.trim();
    const code = normalizeEntityCode(input.code)!;
    const slug = normalizeProgramSlug(input.slug || input.name);
    const duplicate = await client.program.findFirst({
      where: {
        providerId,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [
          { name: { equals: name, mode: Prisma.QueryMode.insensitive } },
          { code: { equals: code, mode: Prisma.QueryMode.insensitive } },
          { slug },
        ],
      },
      select: { name: true, code: true, slug: true },
    });
    if (!duplicate) return;
    if (duplicate.name.toLowerCase() === name.toLowerCase()) throw new ConflictException('Program name already exists');
    if (duplicate.code.toLowerCase() === code.toLowerCase()) throw new ConflictException('Program code already exists');
    throw new ConflictException('Program URL slug already exists');
  }

  createData(providerId: string, dto: ProgramCatalogInputDto): Prisma.ProgramUncheckedCreateInput {
    return {
      providerId,
      name: dto.name.trim(),
      code: normalizeEntityCode(dto.code)!,
      slug: normalizeProgramSlug(dto.slug || dto.name),
      programType: dto.programType,
      subjectArea: this.text(dto.subjectArea),
      educationLevel: this.text(dto.educationLevel),
      summary: this.text(dto.summary),
      description: this.text(dto.description),
      languageCodes: [...new Set((dto.languageCodes || []).map((code) => code.trim().toLowerCase()).filter(Boolean))],
      credentialType: this.text(dto.credentialType),
      credentialAwarded: this.text(dto.credentialAwarded),
      targetAudience: this.text(dto.targetAudience),
      learningOutcomes: dto.learningOutcomes?.map((outcome) => outcome.trim()).filter(Boolean) ?? Prisma.JsonNull,
      entryOverview: this.text(dto.entryOverview),
      awardingBody: this.text(dto.awardingBody),
      accreditationSummary: this.text(dto.accreditationSummary),
      durationValue: dto.durationValue,
      durationUnit: dto.durationUnit,
    };
  }

  async createStandalone(providerId: string, dto: ProgramCatalogInputDto) {
    await this.assertUnique(this.prisma, providerId, dto);
    return this.prisma.program.create({ data: this.createData(providerId, dto) });
  }

  updateData(dto: UpdateProgramDto): Prisma.ProgramUpdateInput {
    return {
      name: dto.name?.trim(),
      code: dto.code ? normalizeEntityCode(dto.code)! : undefined,
      slug: dto.slug === undefined ? undefined : normalizeProgramSlug(dto.slug),
      programType: dto.programType,
      subjectArea: dto.subjectArea === undefined ? undefined : this.text(dto.subjectArea),
      educationLevel: dto.educationLevel === undefined ? undefined : this.text(dto.educationLevel),
      summary: dto.summary === undefined ? undefined : this.text(dto.summary),
      description: dto.description === undefined ? undefined : this.text(dto.description),
      languageCodes: dto.languageCodes === undefined
        ? undefined
        : [...new Set(dto.languageCodes.map((code) => code.trim().toLowerCase()).filter(Boolean))],
      credentialType: dto.credentialType === undefined ? undefined : this.text(dto.credentialType),
      credentialAwarded: dto.credentialAwarded === undefined ? undefined : this.text(dto.credentialAwarded),
      targetAudience: dto.targetAudience === undefined ? undefined : this.text(dto.targetAudience),
      learningOutcomes: dto.learningOutcomes === undefined
        ? undefined
        : dto.learningOutcomes.map((outcome) => outcome.trim()).filter(Boolean),
      entryOverview: dto.entryOverview === undefined ? undefined : this.text(dto.entryOverview),
      awardingBody: dto.awardingBody === undefined ? undefined : this.text(dto.awardingBody),
      accreditationSummary: dto.accreditationSummary === undefined ? undefined : this.text(dto.accreditationSummary),
      durationValue: dto.durationValue,
      durationUnit: dto.durationUnit,
    };
  }
}
