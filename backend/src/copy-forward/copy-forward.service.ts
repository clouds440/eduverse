import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CopyForwardDto } from './dto/copy-forward.dto';

@Injectable()
export class CopyForwardService {
  constructor(private readonly prisma: PrismaService) {}

  private getOptions(dto: CopyForwardDto) {
    return {
      copySchedules: dto.options?.copySchedules ?? dto.copySchedules ?? false,
      copyAssessments: dto.options?.copyAssessments ?? dto.copyAssessments ?? false,
      copyMaterials: dto.options?.copyMaterials ?? dto.copyMaterials ?? false,
    };
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

  async previewCopyForward(orgId: string, dto: CopyForwardDto) {
    const options = this.getOptions(dto);
    await this.validateCycles(orgId, dto);

    const sectionWhere = {
      academicCycleId: dto.fromCycleId,
      course: { organizationId: orgId },
    };

    const [sections, schedules, assessments, materials] = await Promise.all([
      this.prisma.section.count({ where: sectionWhere }),
      options.copySchedules
        ? this.prisma.sectionSchedule.count({ where: { section: sectionWhere } })
        : Promise.resolve(0),
      options.copyAssessments
        ? this.prisma.assessment.count({ where: { section: sectionWhere } })
        : Promise.resolve(0),
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
   * Optionally duplicates schedules, assessments, and materials.
   * No link back to old records — all new IDs.
   */
  async copyForward(orgId: string, dto: CopyForwardDto) {
    const options = this.getOptions(dto);
    await this.validateCycles(orgId, dto);

    // Get all sections from the source cycle
    const sourceSections = await this.prisma.section.findMany({
      where: { academicCycleId: dto.fromCycleId, course: { organizationId: orgId } },
      include: {
        teachers: { select: { id: true } },
        ...(options.copySchedules
          ? {
              schedules: {
                select: {
                  day: true,
                  startTime: true,
                  endTime: true,
                  room: true,
                },
              },
            }
          : {}),
        ...(options.copyAssessments
          ? {
              assessments: {
                select: {
                  courseId: true,
                  title: true,
                  type: true,
                  totalMarks: true,
                  weightage: true,
                  dueDate: true,
                  allowSubmissions: true,
                  externalLink: true,
                  isVideoLink: true,
                  organizationId: true,
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
        // Create new section with same data but new cycle
        const newSection = await tx.section.create({
          data: {
            name: sourceSection.name,
            color: sourceSection.color,
            room: sourceSection.room,
            courseId: sourceSection.courseId,
            academicCycleId: dto.toCycleId,
            teachers: {
              connect: sourceSection.teachers.map((t) => ({ id: t.id })),
            },
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
          }>;

          for (const schedule of schedules) {
            await tx.sectionSchedule.create({
              data: {
                sectionId: newSection.id,
                academicCycleId: dto.toCycleId,
                day: schedule.day,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                room: schedule.room,
              },
            });
            results.schedulesCopied++;
          }
        }

        // Copy assessments
        if (options.copyAssessments && 'assessments' in sourceSection) {
          const assessments = sourceSection.assessments as Array<{
            courseId: string;
            title: string;
            type: string;
            totalMarks: number;
            weightage: number;
            dueDate: Date | null;
            allowSubmissions: boolean;
            externalLink: string | null;
            isVideoLink: boolean;
            organizationId: string;
          }>;

          for (const assessment of assessments) {
            await tx.assessment.create({
              data: {
                sectionId: newSection.id,
                courseId: assessment.courseId,
                title: assessment.title,
                type: assessment.type as any,
                totalMarks: assessment.totalMarks,
                weightage: assessment.weightage,
                allowSubmissions: assessment.allowSubmissions,
                externalLink: assessment.externalLink,
                isVideoLink: assessment.isVideoLink,
                organizationId: assessment.organizationId,
                academicCycleId: dto.toCycleId,
              },
            });
            results.assessmentsCopied++;
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
