import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CopyForwardDto } from './dto/copy-forward.dto';
import { ScheduleType } from '@/prisma/prisma-client';
import { ProgramClassificationStatus } from '../common/enums';
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';

@Injectable()
export class CopyForwardService {
  constructor(private readonly prisma: PrismaService) {}

  private getOptions(dto: CopyForwardDto) {
    return {
      copySchedules: dto.options?.copySchedules ?? dto.copySchedules ?? false,
      copyMaterials: dto.options?.copyMaterials ?? dto.copyMaterials ?? false,
    };
  }

  private cycleSuffix(cycle: { code?: string | null; id: string }) {
    return (cycle.code || cycle.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase() || 'COPY';
  }

  private copyCodeBase(sourceCode: string, targetCycle: { code?: string | null; id: string }) {
    const suffix = this.cycleSuffix(targetCycle);
    const base = `${sourceCode}-${suffix}`.toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
    return base.slice(0, 32);
  }

  private copyName(sourceName: string, targetCycle: { name: string; code?: string | null }) {
    const suffix = targetCycle.code || targetCycle.name;
    const name = `${sourceName} (${suffix})`;
    return name.length > 120 ? name.slice(0, 120) : name;
  }

  private codeWithSuffix(base: string, index: number) {
    if (index === 0) return base;
    const suffix = `-${index + 1}`;
    return `${base.slice(0, 32 - suffix.length)}${suffix}`;
  }

  private async validateCycles(orgId: string, dto: CopyForwardDto) {
    const fromCycle = await this.prisma.academicCycle.findFirst({
      where: { id: dto.fromCycleId, organizationId: orgId },
    });
    if (!fromCycle) throw new NotFoundException('Source academic cycle not found');

    const toCycle = await this.prisma.academicCycle.findFirst({
      where: { id: dto.toCycleId, organizationId: orgId },
    });
    if (!toCycle) throw new NotFoundException('Target academic cycle not found');

    if (dto.fromCycleId === dto.toCycleId) {
      throw new BadRequestException('Source and target cycles must be different');
    }

    return { fromCycle, toCycle };
  }

  private async validateProgramMapping(orgId: string, dto: CopyForwardDto) {
    if (dto.programClassificationStatus === ProgramClassificationStatus.STANDALONE) return null;
    if (!dto.sourceProgramAcademicCycleId || !dto.targetProgramAcademicCycleId || !dto.targetProgramStageId) {
      throw new BadRequestException('Source program association, target program association, and target stage are required');
    }
    const [source, targetStage] = await Promise.all([
      this.prisma.programAcademicCycle.findFirst({
        where: { id: dto.sourceProgramAcademicCycleId, organizationId: orgId, academicCycleId: dto.fromCycleId, status: 'ACTIVE' },
      }),
      this.prisma.programStage.findFirst({
        where: {
          id: dto.targetProgramStageId,
          organizationId: orgId,
          programAcademicCycleId: dto.targetProgramAcademicCycleId,
          programAcademicCycle: { academicCycleId: dto.toCycleId, status: 'ACTIVE' },
          curriculumVersion: { status: 'ACTIVE' },
        },
        include: {
          programAcademicCycle: true,
          courseRequirements: true,
          curriculumVersion: { include: { programConfigurationRevision: true } },
        },
      }),
    ]);
    if (!source || !targetStage) throw new BadRequestException('Selected program copy-forward mapping is not eligible');
    if (source.programId !== targetStage.programAcademicCycle.programId) {
      throw new BadRequestException('Source and target associations must belong to the same program');
    }
    return { source, targetStage };
  }

  async previewCopyForward(orgId: string, dto: CopyForwardDto) {
    const options = this.getOptions(dto);
    await this.validateCycles(orgId, dto);
    await this.validateProgramMapping(orgId, dto);

    const sectionWhere = {
      academicCycleId: dto.fromCycleId,
      course: { organizationId: orgId },
      programClassificationStatus: dto.programClassificationStatus,
      ...(dto.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED
        ? { requirementMappings: { some: { programAcademicCycleId: dto.sourceProgramAcademicCycleId } } }
        : {}),
    };

    const [sections, schedules, assessments, materials] = await Promise.all([
      this.prisma.section.count({ where: sectionWhere }),
      options.copySchedules
        ? this.prisma.sectionSchedule.count({ where: { section: sectionWhere, type: ScheduleType.OFFICIAL, date: null } })
        : Promise.resolve(0),
      Promise.resolve(0),
      options.copyMaterials
        ? this.prisma.courseMaterial.count({ where: { section: sectionWhere } })
        : Promise.resolve(0),
    ]);

    return {
      sections,
      schedules,
      assessments,
      materials,
    };
  }

  /**
   * Copy academic data from one cycle to another.
   * Duplicates sections (under same courses) with new academicCycleId.
   * Optionally duplicates weekly schedules and course materials.
   * Teacher assignments are copied so schedule rows remain valid, but schedules
   * with target-cycle teacher or room conflicts are skipped.
   * Assessments, grades, submissions, and attendance sessions are not copied.
   */
  async copyForward(orgId: string, dto: CopyForwardDto) {
    const options = this.getOptions(dto);
    const { toCycle } = await this.validateCycles(orgId, dto);
    await assertAcademicCycleWritable(this.prisma, orgId, dto.toCycleId, 'SETUP');
    const programMapping = await this.validateProgramMapping(orgId, dto);

    // Get all sections from the source cycle
    const sourceSections = await this.prisma.section.findMany({
      where: {
        academicCycleId: dto.fromCycleId,
        course: { organizationId: orgId },
        programClassificationStatus: dto.programClassificationStatus,
        ...(programMapping ? { requirementMappings: { some: { programAcademicCycleId: programMapping.source.id } } } : {}),
      },
      include: {
        teachers: { select: { id: true } },
        ...(options.copySchedules
          ? {
              schedules: {
                where: { type: ScheduleType.OFFICIAL, date: null },
                select: {
                  day: true,
                  startTime: true,
                  endTime: true,
                  room: true,
                  roomId: true,
                  teacherId: true,
                },
              },
            }
          : {}),
        ...(options.copyMaterials
          ? {
              courseMaterials: {
                select: {
                  title: true,
                  description: true,
                  links: true,
                  isVideoLink: true,
                  createdBy: true,
                },
              },
            }
          : {}),
      },
    });

    const results = {
      sectionsCopied: 0,
      schedulesCopied: 0,
      assessmentsCopied: 0,
      materialsCopied: 0,
    };

    await this.prisma.$transaction(async (tx) => {
      for (const sourceSection of sourceSections) {
        const targetRequirements = programMapping
          ? programMapping.targetStage.courseRequirements.filter((requirement) => requirement.courseId === sourceSection.courseId)
          : [];
        if (programMapping && targetRequirements.length === 0) {
          throw new BadRequestException(`Target stage has no requirement for section course ${sourceSection.courseId}`);
        }
        // Create new section with same data but new cycle
        const codeBase = this.copyCodeBase(sourceSection.code, toCycle);
        let code = codeBase;
        for (let index = 0; index < 100; index += 1) {
          const candidate = this.codeWithSuffix(codeBase, index);
          const exists = await tx.section.findFirst({
            where: { organizationId: orgId, code: { equals: candidate, mode: 'insensitive' } },
            select: { id: true },
          });
          if (!exists) {
            code = candidate;
            break;
          }
          if (index === 99) throw new BadRequestException('Could not generate a unique section code for copy-forward');
        }

        const newSection = await tx.section.create({
          data: {
            organizationId: orgId,
            name: this.copyName(sourceSection.name, toCycle),
            code,
            color: sourceSection.color,
            room: sourceSection.room,
            defaultRoomId: sourceSection.defaultRoomId,
            courseId: sourceSection.courseId,
            academicCycleId: dto.toCycleId,
            status: 'ACTIVE',
            programClassificationStatus: dto.programClassificationStatus,
            teachers: {
              connect: sourceSection.teachers.map((teacher) => ({ id: teacher.id })),
            },
            requirementMappings: programMapping ? {
              create: targetRequirements.map((requirement) => ({
                  organizationId: orgId,
                  stageCourseRequirementId: requirement.id,
                  programAcademicCycleId: programMapping.targetStage.programAcademicCycleId,
                })),
            } : undefined,
          },
        });
        results.sectionsCopied++;

        // Copy schedules
        if (options.copySchedules && 'schedules' in sourceSection) {
          const schedules = sourceSection.schedules as Array<{
            day: number;
            startTime: string;
            endTime: string;
            room: string | null;
            roomId: string | null;
            teacherId: string;
          }>;

          for (const schedule of schedules) {
            const conflict = await tx.sectionSchedule.findFirst({
              where: {
                academicCycleId: dto.toCycleId,
                type: ScheduleType.OFFICIAL,
                date: null,
                day: schedule.day,
                startTime: { lt: schedule.endTime },
                endTime: { gt: schedule.startTime },
                OR: [
                  { teacherId: schedule.teacherId },
                  ...(schedule.roomId ? [{ roomId: schedule.roomId }] : []),
                ],
              },
              select: { id: true },
            });
            if (conflict) continue;

            await tx.sectionSchedule.create({
              data: {
                sectionId: newSection.id,
                academicCycleId: dto.toCycleId,
                day: schedule.day,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                room: schedule.room,
                roomId: schedule.roomId,
                teacherId: schedule.teacherId,
                type: ScheduleType.OFFICIAL,
              },
            });
            results.schedulesCopied++;
          }
        }

        // Copy materials
        if (options.copyMaterials && 'courseMaterials' in sourceSection) {
          const materials = sourceSection.courseMaterials as Array<{
            title: string;
            description: string | null;
            links: string[];
            isVideoLink: boolean;
            createdBy: string;
          }>;

          for (const material of materials) {
            await tx.courseMaterial.create({
              data: {
                sectionId: newSection.id,
                academicCycleId: dto.toCycleId,
                title: material.title,
                description: material.description,
                links: material.links,
                isVideoLink: material.isVideoLink,
                createdBy: material.createdBy,
              },
            });
            results.materialsCopied++;
          }
        }
      }
    });

    return {
      message: 'Copy forward complete',
      ...results,
    };
  }
}

