import { createHash } from 'crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcademicCycleArchiveStatus,
  AcademicCycleStatus,
  ArchiveProgramSourceKind,
  Prisma,
  StudentStageEnrollmentStatus,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationActivityService } from '../activity-logs/organization-activity.service';
import { stableJsonStringify } from '../common/stable-json';
import { runSerializableTransaction } from '../common/prisma-transaction';

const ARCHIVE_SCHEMA_VERSION = 2;

type SnapshotPayload = {
  schemaVersion: number;
  cycle: Record<string, unknown>;
  section: Record<string, any>;
  enrollments: any[];
  enrollmentHistories: any[];
  assessments: any[];
  schedules: any[];
  attendanceSessions: any[];
  courseMaterials: any[];
  evaluations: any[];
  files: any[];
};

@Injectable()
export class AcademicCycleArchivesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: OrganizationActivityService,
  ) {}

  private runTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return runSerializableTransaction(this.prisma, operation, {
      conflictMessage:
        'Academic cycle archive changed concurrently; refresh and try again',
    });
  }

  private checksum(value: unknown) {
    return createHash('sha256')
      .update(stableJsonStringify(value))
      .digest('hex');
  }

  private json<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private searchText(values: Array<string | null | undefined>) {
    return values.filter(Boolean).join(' ').trim().toLowerCase();
  }

  private counts(payload: SnapshotPayload) {
    return {
      sections: 1,
      enrollments: payload.enrollments.length,
      enrollmentHistories: payload.enrollmentHistories.length,
      assessments: payload.assessments.length,
      grades: payload.assessments.reduce(
        (sum, item) => sum + item.grades.length,
        0,
      ),
      submissions: payload.assessments.reduce(
        (sum, item) => sum + item.submissions.length,
        0,
      ),
      schedules: payload.schedules.length,
      attendanceSessions: payload.attendanceSessions.length,
      attendanceRecords: payload.attendanceSessions.reduce(
        (sum, item) => sum + item.records.length,
        0,
      ),
      courseMaterials: payload.courseMaterials.length,
      evaluations: payload.evaluations.length,
      files: payload.files.length,
    };
  }

  private addCounts(
    target: Record<string, number>,
    source: Record<string, number>,
  ) {
    for (const [key, value] of Object.entries(source))
      target[key] = (target[key] || 0) + value;
  }

  private async assertFilesVerifiable(
    tx: Prisma.TransactionClient,
    orgId: string,
    fileIds: string[],
  ) {
    if (!fileIds.length) return;
    const unverifiableFiles = await tx.file.count({
      where: {
        id: { in: fileIds },
        orgId,
        OR: [{ sha256: null }, { sha256: '' }],
      },
    });
    if (unverifiableFiles) {
      throw new ConflictException(
        `Archive contains ${unverifiableFiles} file(s) without a SHA-256 checksum`,
      );
    }
  }

  private async sourceCounts(cycleId: string) {
    const [
      sections,
      enrollments,
      enrollmentHistories,
      assessments,
      grades,
      submissions,
      schedules,
      attendanceSessions,
      attendanceRecords,
      courseMaterials,
      evaluations,
    ] = await Promise.all([
      this.prisma.section.count({ where: { academicCycleId: cycleId } }),
      this.prisma.enrollment.count({ where: { academicCycleId: cycleId } }),
      this.prisma.enrollmentHistory.count({
        where: { academicCycleId: cycleId },
      }),
      this.prisma.assessment.count({ where: { academicCycleId: cycleId } }),
      this.prisma.grade.count({ where: { academicCycleId: cycleId } }),
      this.prisma.submission.count({ where: { academicCycleId: cycleId } }),
      this.prisma.sectionSchedule.count({
        where: { academicCycleId: cycleId },
      }),
      this.prisma.attendanceSession.count({
        where: { academicCycleId: cycleId },
      }),
      this.prisma.attendanceRecord.count({
        where: { session: { academicCycleId: cycleId } },
      }),
      this.prisma.courseMaterial.count({ where: { academicCycleId: cycleId } }),
      this.prisma.evaluation.count({ where: { academicCycleId: cycleId } }),
    ]);
    return {
      sections,
      enrollments,
      enrollmentHistories,
      assessments,
      grades,
      submissions,
      schedules,
      attendanceSessions,
      attendanceRecords,
      courseMaterials,
      evaluations,
    };
  }

  private async preflight(orgId: string, cycleId: string) {
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id: cycleId, organizationId: orgId },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        currentArchiveId: true,
      },
    });
    if (!cycle) throw new NotFoundException('Academic cycle not found');
    if (cycle.status === AcademicCycleStatus.ARCHIVED && cycle.currentArchiveId)
      return cycle;
    if (
      cycle.status !== AcademicCycleStatus.COMPLETED &&
      cycle.status !== AcademicCycleStatus.ARCHIVING
    ) {
      throw new ConflictException(
        'Only a completed academic cycle can be archived',
      );
    }
    const unresolved = await this.prisma.studentStageEnrollment.count({
      where: {
        programStageOffering: { programOffering: { campusBinding: { academicCycleId: cycleId } } },
        status: StudentStageEnrollmentStatus.IN_PROGRESS,
      },
    });
    if (unresolved) {
      throw new ConflictException(
        `Resolve ${unresolved} in-progress student stage enrollment(s) before archiving`,
      );
    }
    return cycle;
  }

  private async start(
    orgId: string,
    cycleId: string,
    actorId: string,
    retry: boolean,
  ) {
    return this.runTransaction(async (tx) => {
      const cycle = await tx.academicCycle.findFirst({
        where: { id: cycleId, organizationId: orgId },
        include: { archives: { orderBy: { revision: 'desc' }, take: 1 } },
      });
      if (!cycle) throw new NotFoundException('Academic cycle not found');
      if (
        cycle.status === AcademicCycleStatus.ARCHIVED &&
        cycle.currentArchiveId
      ) {
        return tx.academicCycleArchive.findUniqueOrThrow({
          where: { id: cycle.currentArchiveId },
        });
      }

      const latest = cycle.archives[0];
      if (cycle.status === AcademicCycleStatus.ARCHIVING) {
        if (!latest)
          throw new ConflictException(
            'Archive state is missing its build revision',
          );
        if (latest.status === AcademicCycleArchiveStatus.BUILDING) {
          throw new ConflictException('Archive generation is already running');
        }
        if (!retry || latest.status !== AcademicCycleArchiveStatus.FAILED) {
          throw new ConflictException(
            'The failed archive must be retried explicitly',
          );
        }
        await tx.academicCycleArchiveSectionProgramIndex.deleteMany({
          where: { archiveId: latest.id },
        });
        await tx.academicCycleArchiveStudentIndex.deleteMany({
          where: { archiveId: latest.id },
        });
        await tx.academicCycleArchiveSection.deleteMany({
          where: { archiveId: latest.id },
        });
        return tx.academicCycleArchive.update({
          where: { id: latest.id },
          data: {
            status: AcademicCycleArchiveStatus.BUILDING,
            failureReason: null,
            completedAt: null,
            manifest: Prisma.JsonNull,
            recordCounts: Prisma.JsonNull,
            checksum: null,
            cutoffAt: new Date(),
          },
        });
      }

      if (cycle.status !== AcademicCycleStatus.COMPLETED) {
        throw new ConflictException(
          'Only a completed academic cycle can be archived',
        );
      }
      const transitioned = await tx.academicCycle.updateMany({
        where: {
          id: cycleId,
          organizationId: orgId,
          status: AcademicCycleStatus.COMPLETED,
        },
        data: {
          status: AcademicCycleStatus.ARCHIVING,
          archiveReason: 'Archive snapshot requested',
        },
      });
      if (transitioned.count !== 1)
        throw new ConflictException(
          'Academic cycle archive state changed concurrently',
        );
      return tx.academicCycleArchive.create({
        data: {
          organizationId: orgId,
          academicCycleId: cycleId,
          revision: (latest?.revision || 0) + 1,
          status: AcademicCycleArchiveStatus.BUILDING,
          schemaVersion: ARCHIVE_SCHEMA_VERSION,
          cutoffAt: new Date(),
          createdById: actorId,
        },
      });
    });
  }

  private async sectionSource(
    orgId: string,
    cycleId: string,
    sectionId: string,
  ) {
    return this.prisma.section.findFirst({
      where: { id: sectionId, organizationId: orgId, academicCycleId: cycleId },
      include: {
        course: { include: { department: true } },
        cohortOfferingSections: {
          include: {
            cohortOffering: {
              include: {
                cohort: true,
                programStageOffering: {
                  include: {
                    programOffering: { include: { program: { include: { campusConfiguration: { include: { department: true } } } }, campusBinding: { include: { curriculumVersion: true } } } },
                    programStage: { include: { curriculumVersion: true } },
                  },
                },
              },
            },
          },
        },
        defaultRoom: { include: { building: true } },
        teachers: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        programMappings: {
          include: {
            programStageOffering: {
              include: {
                programOffering: { include: { program: { include: { campusConfiguration: { include: { department: true } } } }, campusBinding: { include: { curriculumVersion: true } } } },
                programStage: { include: { curriculumVersion: true } },
              },
            },
            stageCourseRequirement: {
              include: {
                programStage: { include: { curriculumVersion: true } },
              },
            },
          },
        },
        enrollments: {
          orderBy: { studentId: 'asc' },
          include: {
            student: {
              include: {
                user: { select: { id: true, name: true, email: true } },
                primaryDepartment: true,
                programEnrollments: {
                  include: {
                    program: true,
                    curriculumVersion: true,
                    stageEnrollments: { orderBy: { createdAt: 'asc' } },
                    progressionDecisions: { orderBy: { decidedAt: 'asc' } },
                  },
                  orderBy: { admittedAt: 'asc' },
                },
              },
            },
            studentProgramEnrollment: {
              include: { program: true, curriculumVersion: true },
            },
            studentStageEnrollment: { include: { programStage: true, programStageOffering: { include: { programOffering: true } } } },
            studentCohortMembership: { include: { cohortOffering: { include: { cohort: true } } } },
          },
        },
        enrollmentHistories: {
          orderBy: { enrolledAt: 'asc' },
          include: {
            student: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
            studentProgramEnrollment: {
              include: { program: true, curriculumVersion: true },
            },
            studentStageEnrollment: { include: { programStage: true, programStageOffering: { include: { programOffering: true } } } },
            studentCohortMembership: { include: { cohortOffering: { include: { cohort: true } } } },
          },
        },
        assessments: {
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
          include: {
            grades: {
              orderBy: { studentId: 'asc' },
              include: {
                student: {
                  include: {
                    user: { select: { id: true, name: true, email: true } },
                  },
                },
                answerbookAttachments: { include: { file: true } },
              },
            },
            submissions: {
              orderBy: { submittedAt: 'asc' },
              include: {
                student: {
                  include: {
                    user: { select: { id: true, name: true, email: true } },
                  },
                },
              },
            },
          },
        },
        schedules: {
          orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
          include: {
            roomRef: { include: { building: true } },
            teacher: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        attendanceSessions: {
          orderBy: { date: 'asc' },
          include: {
            schedule: true,
            records: {
              orderBy: { studentId: 'asc' },
              include: {
                student: {
                  include: {
                    user: { select: { id: true, name: true, email: true } },
                  },
                },
              },
            },
          },
        },
        courseMaterials: { orderBy: { createdAt: 'asc' } },
        evaluations: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  private async genericFiles(
    orgId: string,
    source: Awaited<ReturnType<AcademicCycleArchivesService['sectionSource']>>,
  ) {
    if (!source) return [];
    const materialIds = source.courseMaterials.map((item) => item.id);
    const assessmentIds = source.assessments.map((item) => item.id);
    const submissionIds = source.assessments.flatMap((item) =>
      item.submissions.map((submission) => submission.id),
    );
    return this.prisma.file.findMany({
      where: {
        orgId,
        OR: [
          ...(materialIds.length
            ? [{ entityType: 'COURSE_MATERIAL', entityId: { in: materialIds } }]
            : []),
          ...(assessmentIds.length
            ? [{ entityType: 'ASSESSMENT', entityId: { in: assessmentIds } }]
            : []),
          ...(submissionIds.length
            ? [{ entityType: 'SUBMISSION', entityId: { in: submissionIds } }]
            : []),
          {
            gradeAnswerbookAttachment: {
              grade: { assessment: { sectionId: source.id } },
            },
          },
        ],
      },
      orderBy: { id: 'asc' },
    });
  }

  private async buildSection(
    orgId: string,
    cycle: any,
    archiveId: string,
    sourceSectionId: string,
  ) {
    const source = await this.sectionSource(orgId, cycle.id, sourceSectionId);
    if (!source)
      throw new NotFoundException(
        `Archive source section ${sourceSectionId} disappeared`,
      );
    const files = await this.genericFiles(orgId, source);
    const payload = this.json<SnapshotPayload>({
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      cycle: {
        id: cycle.id,
        name: cycle.name,
        code: cycle.code,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        gpaPolicySnapshot: cycle.gpaPolicySnapshot,
      },
      section: {
        id: source.id,
        name: source.name,
        code: source.code,
        color: source.color,
        room: source.room,
        status: source.status,
        programClassificationStatus: source.programMappings.length ? 'PROGRAM_MAPPED' : 'STANDALONE',
        course: source.course,
        cohortOfferings: source.cohortOfferingSections,
        defaultRoom: source.defaultRoom,
        teachers: source.teachers,
        programMappings: source.programMappings,
      },
      enrollments: source.enrollments,
      enrollmentHistories: source.enrollmentHistories,
      assessments: source.assessments,
      schedules: source.schedules,
      attendanceSessions: source.attendanceSessions,
      courseMaterials: source.courseMaterials,
      evaluations: source.evaluations,
      files,
    });
    const sectionChecksum = this.checksum(payload);
    const teacherUserIds = source.teachers
      .map((teacher) => teacher.userId)
      .sort();
    const cohortPrograms = source.cohortOfferingSections.flatMap((link) => {
      const stageOffering = link.cohortOffering.programStageOffering;
      if (!stageOffering) return [];
      return [{
        sourceKind: ArchiveProgramSourceKind.COHORT_OFFERING,
        sourceMappingId: link.cohortOffering.id,
        sourceProgramOfferingId: stageOffering.programOffering.id,
        sourceProgramStageOfferingId: stageOffering.id,
        sourceProgramId: stageOffering.programOffering.program.id,
        sourceCurriculumVersionId: stageOffering.programOffering.campusBinding!.curriculumVersion.id,
        sourceProgramStageId: stageOffering.programStage.id,
        sourceStageCourseRequirementId: null,
        departmentLabel: stageOffering.programOffering.program.campusConfiguration?.department.name || 'Unassigned',
        programLabel: stageOffering.programOffering.program.name,
        curriculumLabel: stageOffering.programOffering.campusBinding!.curriculumVersion.name,
        stageLabel: stageOffering.programStage.name,
      }];
    });
    const requirementPrograms = source.programMappings.map((mapping) => ({
      sourceKind: ArchiveProgramSourceKind.SECTION_MAPPING,
      sourceMappingId: mapping.id,
      sourceProgramOfferingId: mapping.programStageOffering.programOffering.id,
      sourceProgramStageOfferingId: mapping.programStageOffering.id,
      sourceProgramId: mapping.programStageOffering.programOffering.program.id,
      sourceCurriculumVersionId: mapping.programStageOffering.programOffering.campusBinding!.curriculumVersion.id,
      sourceProgramStageId: mapping.programStageOffering.programStage.id,
      sourceStageCourseRequirementId: mapping.stageCourseRequirementId,
      departmentLabel: mapping.programStageOffering.programOffering.program.campusConfiguration?.department.name || 'Unassigned',
      programLabel: mapping.programStageOffering.programOffering.program.name,
      curriculumLabel: mapping.programStageOffering.programOffering.campusBinding!.curriculumVersion.name,
      stageLabel: mapping.programStageOffering.programStage.name,
    }));
    const programIndexes = [...cohortPrograms, ...requirementPrograms];
    const primaryCohort = source.cohortOfferingSections[0]?.cohortOffering.cohort || null;
    const sourceDepartmentId =
      source.course.departmentId ||
      source.programMappings[0]?.programStageOffering.programOffering.program.campusConfiguration?.departmentId ||
      null;
    const archiveSection = await this.prisma.academicCycleArchiveSection.upsert(
      {
        where: {
          archiveId_sourceSectionId: { archiveId, sourceSectionId: source.id },
        },
        create: {
          organizationId: orgId,
          archiveId,
          sourceSectionId: source.id,
          sourceDepartmentId,
          sourceCohortId: primaryCohort?.id || null,
          sourceCourseId: source.courseId,
          classificationStatus: source.programMappings.length ? 'PROGRAM_MAPPED' : 'STANDALONE',
          departmentLabel:
            source.course.department?.name ||
            programIndexes[0]?.departmentLabel ||
            null,
          cohortLabel: primaryCohort?.name || null,
          courseLabel: source.course.name,
          sectionLabel: source.name,
          normalizedSearchText: this.searchText([
            source.name,
            source.code,
            source.course.name,
            source.course.code,
            ...source.cohortOfferingSections.flatMap((link) => [link.cohortOffering.cohort.name, link.cohortOffering.cohort.code]),
          ]),
          teacherUserIds,
          sectionChecksum,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
        update: {
          sourceDepartmentId,
          sourceCohortId: primaryCohort?.id || null,
          teacherUserIds,
          sectionChecksum,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      },
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.academicCycleArchiveSectionProgramIndex.deleteMany({
        where: { archiveSectionId: archiveSection.id },
      });
      await tx.academicCycleArchiveStudentIndex.deleteMany({
        where: { archiveSectionId: archiveSection.id },
      });
      if (programIndexes.length) {
        await tx.academicCycleArchiveSectionProgramIndex.createMany({
          data: programIndexes.map((item) => ({
            organizationId: orgId,
            archiveId,
            archiveSectionId: archiveSection.id,
            ...item,
          })),
        });
      }
      const indexedStudents = new Map<
        string,
        (typeof source.enrollments)[number]['student']
      >();
      source.enrollments.forEach((enrollment) =>
        indexedStudents.set(enrollment.student.id, enrollment.student),
      );
      source.enrollmentHistories.forEach((history) =>
        indexedStudents.set(
          history.student.id,
          history.student as (typeof source.enrollments)[number]['student'],
        ),
      );
      if (indexedStudents.size) {
        await tx.academicCycleArchiveStudentIndex.createMany({
          data: [...indexedStudents.values()].map((student) => ({
            organizationId: orgId,
            archiveId,
            archiveSectionId: archiveSection.id,
            sourceStudentId: student.id,
            studentName: student.user.name || student.user.email,
            registrationNumber: student.registrationNumber,
            rollNumber: student.rollNumber,
            studentStatus: student.status,
            normalizedSearchText: this.searchText([
              student.user.name,
              student.user.email,
              student.registrationNumber,
              student.rollNumber,
            ]),
            cohortLabel: primaryCohort?.name || null,
            sectionLabel: source.name,
          })),
        });
      }
    });
    return {
      sectionId: source.id,
      checksum: sectionChecksum,
      counts: this.counts(payload),
      fileIds: files.map((file) => file.id),
    };
  }

  async archive(
    orgId: string,
    cycleId: string,
    actorId: string,
    retry = false,
  ) {
    const cycle = await this.preflight(orgId, cycleId);
    if (
      cycle.status === AcademicCycleStatus.ARCHIVED &&
      cycle.currentArchiveId
    ) {
      return this.getStatus(orgId, cycleId);
    }
    const archive = await this.start(orgId, cycleId, actorId, retry);
    if (archive.status === AcademicCycleArchiveStatus.READY) return archive;
    try {
      const frozenCycle = await this.prisma.academicCycle.findUniqueOrThrow({
        where: { id: cycleId },
      });
      const sectionIds = (
        await this.prisma.section.findMany({
          where: { organizationId: orgId, academicCycleId: cycleId },
          select: { id: true },
          orderBy: { id: 'asc' },
        })
      ).map((section) => section.id);
      const aggregate: Record<string, number> = {};
      const built: Array<{ sectionId: string; checksum: string }> = [];
      const fileIds = new Set<string>();
      for (const sectionId of sectionIds) {
        const result = await this.buildSection(
          orgId,
          frozenCycle,
          archive.id,
          sectionId,
        );
        built.push({ sectionId: result.sectionId, checksum: result.checksum });
        this.addCounts(aggregate, result.counts);
        result.fileIds.forEach((id) => fileIds.add(id));
      }
      aggregate.files = fileIds.size;
      const sourceCounts = await this.sourceCounts(cycleId);
      for (const [key, value] of Object.entries(sourceCounts)) {
        if ((aggregate[key] || 0) !== value) {
          throw new ConflictException(
            `Archive ${key} count verification failed: expected ${value}, received ${aggregate[key] || 0}`,
          );
        }
      }
      const checksum = this.checksum(built);
      const manifest = this.json({
        schemaVersion: ARCHIVE_SCHEMA_VERSION,
        academicCycleId: cycleId,
        cutoffAt: archive.cutoffAt,
        sections: built,
        fileIds: [...fileIds].sort(),
        sourceCounts,
      });
      await this.runTransaction(async (tx) => {
        const current = await tx.academicCycleArchive.findUnique({
          where: { id: archive.id },
        });
        const currentCycle = await tx.academicCycle.findUnique({
          where: { id: cycleId },
        });
        if (
          current?.status !== AcademicCycleArchiveStatus.BUILDING ||
          currentCycle?.status !== AcademicCycleStatus.ARCHIVING
        ) {
          throw new ConflictException(
            'Archive state changed before final verification',
          );
        }
        const snapshotSections = await tx.academicCycleArchiveSection.count({
          where: { archiveId: archive.id },
        });
        if (snapshotSections !== sectionIds.length)
          throw new ConflictException(
            'Archive section count verification failed',
          );
        if (fileIds.size) {
          await this.assertFilesVerifiable(tx, orgId, [...fileIds]);
          await tx.file.updateMany({
            where: {
              id: { in: [...fileIds] },
              orgId,
              lockedByArchiveId: null,
            },
            data: { lockedByArchiveId: archive.id, lockedAt: new Date() },
          });
          const lockedFiles = await tx.file.count({
            where: {
              id: { in: [...fileIds] },
              lockedByArchiveId: archive.id,
            },
          });
          if (lockedFiles !== fileIds.size)
            throw new ConflictException(
              'Archive file lock verification failed',
            );
        }
        await tx.academicCycleArchive.update({
          where: { id: archive.id },
          data: {
            status: AcademicCycleArchiveStatus.READY,
            completedAt: new Date(),
            manifest: manifest as Prisma.InputJsonValue,
            recordCounts: aggregate as Prisma.InputJsonValue,
            checksum,
          },
        });
        await tx.academicCycle.update({
          where: { id: cycleId },
          data: {
            status: AcademicCycleStatus.ARCHIVED,
            currentArchiveId: archive.id,
            archivedAt: new Date(),
            archivedById: actorId,
          },
        });
      });
      await this.activity
        .record({
          organizationId: orgId,
          actorUserId: actorId,
          action: 'academic_cycle_archived',
          module: 'academic-cycles',
          resourceType: 'AcademicCycle',
          resourceId: cycleId,
          resourceTitle: frozenCycle.name,
          details: {
            archiveId: archive.id,
            revision: archive.revision,
            checksum,
            recordCounts: aggregate,
          },
        })
        .catch(() => undefined);
      return this.getStatus(orgId, cycleId);
    } catch (error) {
      await this.prisma.academicCycleArchive.updateMany({
        where: { id: archive.id, status: AcademicCycleArchiveStatus.BUILDING },
        data: {
          status: AcademicCycleArchiveStatus.FAILED,
          failureReason:
            error instanceof Error
              ? error.message.slice(0, 1000)
              : 'Archive generation failed',
        },
      });
      throw error;
    }
  }

  async getStatus(orgId: string, cycleId: string) {
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id: cycleId, organizationId: orgId },
      include: {
        currentArchive: true,
        archives: { orderBy: { revision: 'desc' }, take: 1 },
      },
    });
    if (!cycle) throw new NotFoundException('Academic cycle not found');
    return {
      cycle,
      archive: cycle.currentArchive || cycle.archives[0] || null,
    };
  }

  async verifyCurrent(orgId: string, cycleId: string) {
    const cycle = await this.prisma.academicCycle.findFirst({
      where: {
        id: cycleId,
        organizationId: orgId,
        status: AcademicCycleStatus.ARCHIVED,
      },
      include: {
        currentArchive: {
          include: {
            sections: { orderBy: { sourceSectionId: 'asc' } },
            lockedFiles: { select: { id: true } },
          },
        },
      },
    });
    if (!cycle?.currentArchive)
      throw new NotFoundException('Ready archive not found');
    const manifest = cycle.currentArchive.manifest as any;
    const rebuilt = cycle.currentArchive.sections.map((section) => ({
      sectionId: section.sourceSectionId,
      checksum: this.checksum(section.payload),
    }));
    const checksum = this.checksum(rebuilt);
    const expectedFileIds = new Set<string>(manifest?.fileIds || []);
    const lockedFileIds = new Set(
      cycle.currentArchive.lockedFiles.map((file) => file.id),
    );
    const sectionChecksumsMatch = rebuilt.every(
      (item, index) =>
        item.checksum === cycle.currentArchive!.sections[index].sectionChecksum,
    );
    const filesLocked =
      expectedFileIds.size === lockedFileIds.size &&
      [...expectedFileIds].every((id) => lockedFileIds.has(id));
    return {
      archiveId: cycle.currentArchive.id,
      revision: cycle.currentArchive.revision,
      schemaVersion: cycle.currentArchive.schemaVersion,
      valid:
        sectionChecksumsMatch &&
        checksum === cycle.currentArchive.checksum &&
        filesLocked,
      sectionChecksumsMatch,
      archiveChecksumMatches: checksum === cycle.currentArchive.checksum,
      filesLocked,
      expectedSections: manifest?.sections?.length || 0,
      actualSections: rebuilt.length,
      checksum,
    };
  }
}
