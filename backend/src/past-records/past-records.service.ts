import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AcademicCycleArchiveStatus, AcademicCycleStatus, Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { formatPaginatedResponse, getPaginationOptions } from '../common/utils';
import { getDepartmentScope } from '../common/department-scope';
import { Role } from '../common/enums';
import { PastRecordFiltersDto } from './dto/past-records.dto';
import { FilesService } from '../files/files.service';
import { GRADE_ANSWERBOOK_ENTITY_TYPE } from '../files/file-upload-policy';

type Actor = { id: string; role: string };
type AccessContext = {
  departmentIds: string[] | null;
  teacherUserId: string | null;
  studentIds: string[] | null;
};

@Injectable()
export class PastRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  private paging(filters: PastRecordFiltersDto) {
    return getPaginationOptions({
      page: filters.page ? Number(filters.page) : 1,
      limit: filters.limit ? Number(filters.limit) : 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }

  private async access(orgId: string, actor: Actor): Promise<AccessContext> {
    if (actor.role === Role.ORG_ADMIN) {
      return { departmentIds: null, teacherUserId: null, studentIds: null };
    }
    if (actor.role === Role.SUB_ADMIN || actor.role === Role.ORG_MANAGER) {
      const scope = await getDepartmentScope(this.prisma, orgId, actor);
      return { departmentIds: scope.all ? null : scope.departmentIds, teacherUserId: null, studentIds: null };
    }
    if (actor.role === Role.TEACHER) {
      return { departmentIds: null, teacherUserId: actor.id, studentIds: null };
    }
    if (actor.role === Role.STUDENT) {
      const student = await this.prisma.student.findFirst({ where: { organizationId: orgId, userId: actor.id }, select: { id: true } });
      return { departmentIds: null, teacherUserId: null, studentIds: student ? [student.id] : [] };
    }
    if (actor.role === Role.GUARDIAN) {
      const guardian = await this.prisma.guardianProfile.findFirst({
        where: { organizationId: orgId, userId: actor.id },
        select: { studentLinks: { select: { studentId: true } } },
      });
      return { departmentIds: null, teacherUserId: null, studentIds: guardian?.studentLinks.map((link) => link.studentId) || [] };
    }
    throw new ForbiddenException('Past academic records are not available for this role');
  }

  private archiveSectionScope(access: AccessContext): Prisma.AcademicCycleArchiveSectionWhereInput {
    if (access.departmentIds) {
      if (!access.departmentIds.length) return { id: '__no_archive_department_scope__' };
      return { sourceDepartmentId: { in: access.departmentIds } };
    }
    if (access.teacherUserId) return { teacherUserIds: { has: access.teacherUserId } };
    if (access.studentIds) {
      if (!access.studentIds.length) return { id: '__no_archive_student_scope__' };
      return { studentIndexes: { some: { sourceStudentId: { in: access.studentIds } } } };
    }
    return {};
  }

  private currentArchiveWhere(): Prisma.AcademicCycleArchiveWhereInput {
    return {
      status: AcademicCycleArchiveStatus.READY,
      currentForCycle: { is: { status: AcademicCycleStatus.ARCHIVED } },
    };
  }

  private sectionWhere(
    orgId: string,
    filters: PastRecordFiltersDto,
    access: AccessContext,
  ): Prisma.AcademicCycleArchiveSectionWhereInput {
    return {
      organizationId: orgId,
      AND: [
        this.archiveSectionScope(access),
        ...(filters.departmentId ? [{ sourceDepartmentId: filters.departmentId }] : []),
      ],
      archive: {
        ...this.currentArchiveWhere(),
        ...(filters.cycleId ? { academicCycleId: filters.cycleId } : {}),
      },
      ...(filters.cohortId ? { sourceCohortId: filters.cohortId } : {}),
      ...(filters.classification ? { classificationStatus: filters.classification } : {}),
      ...(filters.programId || filters.programOfferingId || filters.programStageId || filters.programStageOfferingId
        ? {
            programIndexes: {
              some: {
                sourceProgramId: filters.programId,
                sourceProgramOfferingId: filters.programOfferingId,
                sourceProgramStageId: filters.programStageId,
                sourceProgramStageOfferingId: filters.programStageOfferingId,
              },
            },
          }
        : {}),
      ...(filters.studentId ? { studentIndexes: { some: { sourceStudentId: filters.studentId } } } : {}),
      ...(filters.search?.trim() ? { normalizedSearchText: { contains: filters.search.trim().toLowerCase() } } : {}),
    };
  }

  async sections(orgId: string, filters: PastRecordFiltersDto, actor: Actor) {
    const access = await this.access(orgId, actor);
    const { skip, take } = this.paging(filters);
    const where = this.sectionWhere(orgId, filters, access);
    const include = {
      archive: { include: { academicCycle: { select: { id: true, name: true, code: true, startDate: true, endDate: true } } } },
      programIndexes: { select: { sourceProgramId: true, programLabel: true, curriculumLabel: true, stageLabel: true, departmentLabel: true } },
      _count: { select: { studentIndexes: true } },
    } satisfies Prisma.AcademicCycleArchiveSectionInclude;
    const [rows, total] = await Promise.all([
      this.prisma.academicCycleArchiveSection.findMany({ where, include, skip, take, orderBy: [{ archive: { academicCycle: { startDate: 'desc' } } }, { sectionLabel: 'asc' }] }),
      this.prisma.academicCycleArchiveSection.count({ where }),
    ]);
    return formatPaginatedResponse(rows.map((row) => ({
      id: row.id,
      sourceSectionId: row.sourceSectionId,
      sourceDepartmentId: row.sourceDepartmentId,
      sourceCohortId: row.sourceCohortId,
      classificationStatus: row.classificationStatus,
      departmentLabel: row.departmentLabel,
      cohortLabel: row.cohortLabel,
      courseLabel: row.courseLabel,
      sectionLabel: row.sectionLabel,
      studentCount: row._count.studentIndexes,
      programs: row.programIndexes,
      cycle: row.archive.academicCycle,
      archiveRevision: row.archive.revision,
      schemaVersion: row.archive.schemaVersion,
      sourceMode: 'ARCHIVE' as const,
    })), total, filters.page ? Number(filters.page) : 1, filters.limit ? Number(filters.limit) : 20);
  }

  private sanitizePayload(payloadValue: Prisma.JsonValue, access: AccessContext, archiveSectionId: string) {
    const payload = JSON.parse(JSON.stringify(payloadValue)) as any;
    const publicFile = (file: any) => {
      if (!file) return file;
      const { publicId, lockedByArchiveId, ...safe } = file;
      void publicId;
      void lockedByArchiveId;
      return safe;
    };
    payload.files = (payload.files || []).map(publicFile);
    payload.assessments = (payload.assessments || []).map((assessment: any) => ({
      ...assessment,
      grades: assessment.grades.map((grade: any) => ({
        ...grade,
        answerbookAttachments: (grade.answerbookAttachments || []).map((attachment: any) => ({
          ...attachment,
          file: {
            ...publicFile(attachment.file),
            path: `/org/past-records/sections/${archiveSectionId}/grades/${grade.id}/answerbook-attachments/${attachment.id}/download`,
          },
        })),
      })),
    }));
    payload.evaluations = [];
    if (!access.studentIds) return payload;
    const allowed = new Set(access.studentIds);
    payload.enrollments = payload.enrollments.filter((item: any) => allowed.has(item.studentId));
    payload.enrollmentHistories = payload.enrollmentHistories.filter((item: any) => allowed.has(item.studentId));
    payload.assessments = payload.assessments.map((assessment: any) => ({
      ...assessment,
      grades: assessment.grades.filter((grade: any) => allowed.has(grade.studentId)),
      submissions: assessment.submissions.filter((submission: any) => allowed.has(submission.studentId)),
    }));
    payload.attendanceSessions = payload.attendanceSessions.map((session: any) => ({
      ...session,
      records: session.records.filter((record: any) => allowed.has(record.studentId)),
    }));
    return payload;
  }

  async section(orgId: string, archiveSectionId: string, actor: Actor) {
    const access = await this.access(orgId, actor);
    const row = await this.prisma.academicCycleArchiveSection.findFirst({
      where: { id: archiveSectionId, ...this.sectionWhere(orgId, {}, access) },
      include: {
        archive: { include: { academicCycle: { select: { id: true, name: true, code: true, startDate: true, endDate: true } } } },
        programIndexes: { select: { id: true, sourceProgramId: true, programLabel: true, curriculumLabel: true, stageLabel: true, departmentLabel: true } },
      },
    });
    if (!row) throw new NotFoundException('Archived section record not found');
    return {
      id: row.id,
      archiveId: row.archiveId,
      archiveRevision: row.archive.revision,
      schemaVersion: row.archive.schemaVersion,
      sourceMode: 'ARCHIVE' as const,
      checksum: row.sectionChecksum,
      cycle: row.archive.academicCycle,
      programs: row.programIndexes,
      payload: this.sanitizePayload(row.payload, access, row.id),
    };
  }

  async downloadAnswerbook(
    orgId: string,
    archiveSectionId: string,
    gradeId: string,
    attachmentId: string,
    actor: Actor,
  ) {
    const record = await this.section(orgId, archiveSectionId, actor);
    const grade = record.payload.assessments
      .flatMap((assessment: any) => assessment.grades || [])
      .find((item: any) => item.id === gradeId);
    const attachment = grade?.answerbookAttachments?.find((item: any) => item.id === attachmentId);
    if (!attachment?.file?.id) throw new NotFoundException('Archived answerbook attachment not found');
    return this.files.getManagedDownloadPayload(
      attachment.file.id,
      orgId,
      GRADE_ANSWERBOOK_ENTITY_TYPE,
      gradeId,
    );
  }

  async students(orgId: string, filters: PastRecordFiltersDto, actor: Actor) {
    const access = await this.access(orgId, actor);
    const { skip, take } = this.paging(filters);
    const sectionWhere = this.sectionWhere(orgId, { ...filters, search: undefined, studentId: undefined }, access);
    const where: Prisma.AcademicCycleArchiveStudentIndexWhereInput = {
      organizationId: orgId,
      archiveSection: sectionWhere,
      ...(filters.studentId ? { sourceStudentId: filters.studentId } : {}),
      ...(filters.search?.trim() ? { normalizedSearchText: { contains: filters.search.trim().toLowerCase() } } : {}),
      ...(access.studentIds ? { sourceStudentId: { in: access.studentIds } } : {}),
    };
    const distinctIds = await this.prisma.academicCycleArchiveStudentIndex.findMany({ where, distinct: ['sourceStudentId'], select: { sourceStudentId: true } });
    const rows = await this.prisma.academicCycleArchiveStudentIndex.findMany({
      where,
      distinct: ['sourceStudentId'],
      skip,
      take,
      orderBy: [{ studentName: 'asc' }, { sourceStudentId: 'asc' }],
      select: { sourceStudentId: true, studentName: true, registrationNumber: true, rollNumber: true, studentStatus: true },
    });
    return formatPaginatedResponse(rows, distinctIds.length, filters.page ? Number(filters.page) : 1, filters.limit ? Number(filters.limit) : 20);
  }

  async studentHistory(orgId: string, studentId: string, filters: PastRecordFiltersDto, actor: Actor) {
    const access = await this.access(orgId, actor);
    if (access.studentIds && !access.studentIds.includes(studentId)) throw new ForbiddenException('You cannot view this student record');
    const result = await this.sections(orgId, { ...filters, studentId, search: undefined }, actor);
    const student = await this.prisma.academicCycleArchiveStudentIndex.findFirst({
      where: { organizationId: orgId, sourceStudentId: studentId, archiveSection: this.sectionWhere(orgId, filters, access) },
      select: { sourceStudentId: true, studentName: true, registrationNumber: true, rollNumber: true, studentStatus: true },
    });
    if (!student) throw new NotFoundException('Archived student record not found');
    return { student, sections: result };
  }

  async cycles(orgId: string, filters: PastRecordFiltersDto, actor: Actor) {
    const access = await this.access(orgId, actor);
    const { skip, take } = this.paging(filters);
    const sectionScope = this.archiveSectionScope(access);
    const requiresSectionScope = Object.keys(sectionScope).length > 0;
    const where: Prisma.AcademicCycleWhereInput = {
      organizationId: orgId,
      status: AcademicCycleStatus.ARCHIVED,
      currentArchive: {
        is: {
          status: AcademicCycleArchiveStatus.READY,
          ...(requiresSectionScope ? { sections: { some: sectionScope } } : {}),
        },
      },
      ...(filters.cycleId ? { id: filters.cycleId } : {}),
      ...(filters.search?.trim() ? {
        OR: [
          { name: { contains: filters.search.trim(), mode: 'insensitive' } },
          { code: { contains: filters.search.trim(), mode: 'insensitive' } },
        ],
      } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.academicCycle.findMany({
        where,
        skip,
        take,
        orderBy: { startDate: 'desc' },
        include: { currentArchive: { select: { id: true, revision: true, schemaVersion: true, completedAt: true, checksum: true, recordCounts: true } } },
      }),
      this.prisma.academicCycle.count({ where }),
    ]);
    return formatPaginatedResponse(rows.map((row) => ({ ...row, sourceMode: 'ARCHIVE' as const })), total, filters.page ? Number(filters.page) : 1, filters.limit ? Number(filters.limit) : 20);
  }

  async options(orgId: string, filters: PastRecordFiltersDto, actor: Actor) {
    const access = await this.access(orgId, actor);
    const where = this.sectionWhere(orgId, filters, access);
    const [departments, cohorts, classifications, programs, offerings, stages, stageOfferings] = await Promise.all([
      this.prisma.academicCycleArchiveSection.findMany({ where: { ...where, sourceDepartmentId: { not: null } }, distinct: ['sourceDepartmentId'], select: { sourceDepartmentId: true, departmentLabel: true } }),
      this.prisma.academicCycleArchiveSection.findMany({ where: { ...where, sourceCohortId: { not: null } }, distinct: ['sourceCohortId'], select: { sourceCohortId: true, cohortLabel: true } }),
      this.prisma.academicCycleArchiveSection.findMany({ where, distinct: ['classificationStatus'], select: { classificationStatus: true } }),
      this.prisma.academicCycleArchiveSectionProgramIndex.findMany({ where: { archiveSection: where }, distinct: ['sourceProgramId'], select: { sourceProgramId: true, programLabel: true, departmentLabel: true } }),
      this.prisma.academicCycleArchiveSectionProgramIndex.findMany({ where: { archiveSection: where }, distinct: ['sourceProgramOfferingId'], select: { sourceProgramOfferingId: true, programLabel: true, curriculumLabel: true } }),
      this.prisma.academicCycleArchiveSectionProgramIndex.findMany({ where: { archiveSection: where }, distinct: ['sourceProgramStageId'], select: { sourceProgramStageId: true, sourceProgramId: true, stageLabel: true, programLabel: true } }),
      this.prisma.academicCycleArchiveSectionProgramIndex.findMany({ where: { archiveSection: where }, distinct: ['sourceProgramStageOfferingId'], select: { sourceProgramStageOfferingId: true, sourceProgramId: true, sourceProgramStageId: true, stageLabel: true, programLabel: true } }),
    ]);
    const unique = <T extends { id: string }>(items: T[]) => [...new Map(items.map((item) => [item.id, item])).values()];
    return {
      departments: unique(departments.map((row) => ({ id: row.sourceDepartmentId!, label: row.departmentLabel || 'Department' }))),
      programs: unique(programs.map((program) => ({ id: program.sourceProgramId, label: program.programLabel, departmentLabel: program.departmentLabel }))),
      programOfferings: unique(offerings.map((offering) => ({ id: offering.sourceProgramOfferingId, label: `${offering.programLabel} - ${offering.curriculumLabel}` }))),
      stages: unique(stages.map((stage) => ({ id: stage.sourceProgramStageId, programId: stage.sourceProgramId, label: `${stage.programLabel} - ${stage.stageLabel}` }))),
      stageOfferings: unique(stageOfferings.map((stage) => ({ id: stage.sourceProgramStageOfferingId, programId: stage.sourceProgramId, programStageId: stage.sourceProgramStageId, label: `${stage.programLabel} - ${stage.stageLabel}` }))),
      cohorts: unique(cohorts.map((row) => ({ id: row.sourceCohortId!, label: row.cohortLabel || 'Cohort' }))),
      classifications: classifications.map((row) => row.classificationStatus),
    };
  }
}
