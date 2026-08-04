import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GradeStatus, Prisma } from '@/prisma/prisma-client';
import { OrganizationActivityService } from '../activity-logs/organization-activity.service';
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';
import { getDepartmentScope } from '../common/department-scope';
import { runSerializableTransaction } from '../common/prisma-transaction';
import { Role } from '../common/enums';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  GRADE_ANSWERBOOK_ENTITY_TYPE,
  GradeEvidenceActor,
  MAX_GRADE_ANSWERBOOK_ATTACHMENTS,
  normalizeAnswerbookReference,
  toPublicGradeEvidenceAttachment,
} from './grade-evidence.types';

type PrismaClient = PrismaService | Prisma.TransactionClient;

const attachmentInclude = {
  file: {
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      fileKind: true,
      extension: true,
      createdAt: true,
    },
  },
} satisfies Prisma.GradeAnswerbookAttachmentInclude;

@Injectable()
export class GradeEvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly activity: OrganizationActivityService,
  ) {}

  private runTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return runSerializableTransaction(this.prisma, operation, {
      conflictMessage:
        'Answerbook evidence changed concurrently; refresh and try again',
    });
  }

  normalizeReference(value: string | null | undefined) {
    return normalizeAnswerbookReference(value);
  }

  publicAttachment(
    record: Parameters<typeof toPublicGradeEvidenceAttachment>[0],
  ) {
    return toPublicGradeEvidenceAttachment(record);
  }

  async recordReferenceChange(
    organizationId: string,
    gradeId: string,
    actorUserId: string,
    previousValue: string | null,
    nextValue: string | null,
  ) {
    if (previousValue === nextValue) return;
    await this.activity
      .record({
        organizationId,
        actorUserId,
        action: 'grade_answerbook_reference_updated',
        module: 'grade-evidence',
        resourceType: 'Grade',
        resourceId: gradeId,
        details: { previousValue, nextValue },
      })
      .catch(() => undefined);
  }

  async list(
    organizationId: string,
    gradeId: string,
    actor: GradeEvidenceActor,
  ) {
    await this.assertAccess(
      this.prisma,
      organizationId,
      gradeId,
      actor,
      'READ',
    );
    await this.cleanupDetachedFiles(organizationId, gradeId);
    const attachments = await this.prisma.gradeAnswerbookAttachment.findMany({
      where: { organizationId, gradeId },
      include: attachmentInclude,
      orderBy: { createdAt: 'asc' },
    });
    return attachments.map(toPublicGradeEvidenceAttachment);
  }

  async upload(
    organizationId: string,
    gradeId: string,
    file: Express.Multer.File,
    actor: GradeEvidenceActor,
  ) {
    const initial = await this.assertMutable(
      this.prisma,
      organizationId,
      gradeId,
      actor,
    );
    await this.cleanupDetachedFiles(organizationId, gradeId);
    if (initial.attachmentCount >= MAX_GRADE_ANSWERBOOK_ATTACHMENTS) {
      throw new ConflictException(
        `A grade can have at most ${MAX_GRADE_ANSWERBOOK_ATTACHMENTS} answerbook attachments`,
      );
    }

    const stored = await this.files.saveManagedFile(
      {
        orgId: organizationId,
        entityType: GRADE_ANSWERBOOK_ENTITY_TYPE,
        entityId: gradeId,
      },
      file,
      actor.id,
      GRADE_ANSWERBOOK_ENTITY_TYPE,
    );

    let attachment;
    try {
      attachment = await this.runTransaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Grade" WHERE id = ${gradeId} FOR UPDATE`;
        const current = await this.assertMutable(
          tx,
          organizationId,
          gradeId,
          actor,
        );
        if (current.attachmentCount >= MAX_GRADE_ANSWERBOOK_ATTACHMENTS) {
          throw new ConflictException(
            `A grade can have at most ${MAX_GRADE_ANSWERBOOK_ATTACHMENTS} answerbook attachments`,
          );
        }
        const managedFile = await tx.file.findFirst({
          where: {
            id: stored.id,
            orgId: organizationId,
            entityType: GRADE_ANSWERBOOK_ENTITY_TYPE,
            entityId: gradeId,
            uploadedBy: actor.id,
            lockedByArchiveId: null,
          },
          select: { id: true },
        });
        if (!managedFile)
          throw new ConflictException(
            'Uploaded answerbook file is no longer available',
          );
        return tx.gradeAnswerbookAttachment.create({
          data: {
            organizationId,
            gradeId,
            fileId: managedFile.id,
            uploadedById: actor.id,
          },
          include: attachmentInclude,
        });
      });
    } catch (error) {
      await this.files
        .deleteManagedFile(
          stored.id,
          organizationId,
          GRADE_ANSWERBOOK_ENTITY_TYPE,
        )
        .catch(() => undefined);
      throw error;
    }
    await this.activity
      .record({
        organizationId,
        actorUserId: actor.id,
        action: 'grade_answerbook_attachment_added',
        module: 'grade-evidence',
        resourceType: 'Grade',
        resourceId: gradeId,
        details: {
          attachmentId: attachment.id,
          fileId: attachment.file.id,
          filename: attachment.file.filename,
        },
      })
      .catch(() => undefined);
    return toPublicGradeEvidenceAttachment(attachment);
  }

  async download(
    organizationId: string,
    gradeId: string,
    attachmentId: string,
    actor: GradeEvidenceActor,
  ) {
    await this.assertAccess(
      this.prisma,
      organizationId,
      gradeId,
      actor,
      'READ',
    );
    const attachment = await this.prisma.gradeAnswerbookAttachment.findFirst({
      where: { id: attachmentId, organizationId, gradeId },
      select: { fileId: true },
    });
    if (!attachment)
      throw new NotFoundException('Answerbook attachment not found');
    return this.files.getManagedDownloadPayload(
      attachment.fileId,
      organizationId,
      GRADE_ANSWERBOOK_ENTITY_TYPE,
      gradeId,
    );
  }

  async remove(
    organizationId: string,
    gradeId: string,
    attachmentId: string,
    actor: GradeEvidenceActor,
  ) {
    const detached = await this.runTransaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Grade" WHERE id = ${gradeId} FOR UPDATE`;
      await this.assertMutable(tx, organizationId, gradeId, actor);
      const attachment = await tx.gradeAnswerbookAttachment.findFirst({
        where: { id: attachmentId, organizationId, gradeId },
        include: { file: true },
      });
      if (!attachment)
        throw new NotFoundException('Answerbook attachment not found');
      if (attachment.file.lockedByArchiveId) {
        throw new ForbiddenException(
          'Archived answerbook attachments are immutable',
        );
      }
      await tx.gradeAnswerbookAttachment.delete({
        where: { id: attachment.id },
      });
      return attachment;
    });

    const cleanupPending = !(await this.files
      .deleteManagedFile(
        detached.fileId,
        organizationId,
        GRADE_ANSWERBOOK_ENTITY_TYPE,
      )
      .then(() => true)
      .catch(() => false));

    await this.activity
      .record({
        organizationId,
        actorUserId: actor.id,
        action: 'grade_answerbook_attachment_removed',
        module: 'grade-evidence',
        resourceType: 'Grade',
        resourceId: gradeId,
        details: { attachmentId, fileId: detached.fileId, cleanupPending },
      })
      .catch(() => undefined);
    return { deleted: true, cleanupPending };
  }

  private async cleanupDetachedFiles(organizationId: string, gradeId: string) {
    const detached = await this.prisma.file.findMany({
      where: {
        orgId: organizationId,
        entityType: GRADE_ANSWERBOOK_ENTITY_TYPE,
        entityId: gradeId,
        gradeAnswerbookAttachment: null,
        lockedByArchiveId: null,
      },
      select: { id: true },
    });
    await Promise.allSettled(
      detached.map((file) =>
        this.files.deleteManagedFile(
          file.id,
          organizationId,
          GRADE_ANSWERBOOK_ENTITY_TYPE,
        ),
      ),
    );
  }

  private async assertMutable(
    client: PrismaClient,
    organizationId: string,
    gradeId: string,
    actor: GradeEvidenceActor,
  ) {
    const context = await this.assertAccess(
      client,
      organizationId,
      gradeId,
      actor,
      'MANAGE',
    );
    if (context.status === GradeStatus.FINALIZED) {
      throw new ConflictException(
        'Answerbook attachments cannot be changed after grade finalization',
      );
    }
    if (!context.isStudentEnrolled) {
      throw new ConflictException(
        'The student is not enrolled in this assessment section',
      );
    }
    await assertAcademicCycleWritable(
      client,
      organizationId,
      context.academicCycleId,
      'CLOSEOUT',
    );
    return context;
  }

  private async assertAccess(
    client: PrismaClient,
    organizationId: string,
    gradeId: string,
    actor: GradeEvidenceActor,
    mode: 'READ' | 'MANAGE',
  ) {
    const grade = await client.grade.findFirst({
      where: { id: gradeId, assessment: { organizationId } },
      select: {
        id: true,
        studentId: true,
        status: true,
        academicCycleId: true,
        student: {
          select: {
            userId: true,
            guardianLinks: {
              select: { guardian: { select: { userId: true } } },
            },
          },
        },
        assessment: {
          select: {
            section: {
              select: {
                course: { select: { departmentId: true } },
                teachers: { select: { userId: true } },
                enrollments: { select: { studentId: true } },
              },
            },
          },
        },
        _count: { select: { answerbookAttachments: true } },
      },
    });
    if (!grade) throw new NotFoundException('Grade not found');

    const role = actor.role as Role;
    const released =
      grade.status === GradeStatus.PUBLISHED ||
      grade.status === GradeStatus.FINALIZED;
    const assigned = grade.assessment.section.teachers.some(
      (teacher) => teacher.userId === actor.id,
    );
    const departmentId = grade.assessment.section.course.departmentId;
    const scopedRoles = role === Role.SUB_ADMIN || role === Role.ORG_MANAGER;
    if (scopedRoles) {
      const scope = await getDepartmentScope(client, organizationId, actor);
      if (
        scope.applies &&
        !scope.all &&
        (!departmentId || !scope.departmentIds.includes(departmentId))
      ) {
        throw new ForbiddenException(
          'You do not have access to this grade department',
        );
      }
    }

    let allowed = role === Role.ORG_ADMIN || role === Role.SUB_ADMIN;
    if (role === Role.ORG_MANAGER) allowed = mode === 'READ' || assigned;
    if (role === Role.TEACHER) allowed = assigned;
    if (mode === 'READ' && role === Role.STUDENT)
      allowed = released && grade.student.userId === actor.id;
    if (mode === 'READ' && role === Role.GUARDIAN) {
      allowed =
        released &&
        grade.student.guardianLinks.some(
          (link) => link.guardian.userId === actor.id,
        );
    }
    if (!allowed)
      throw new ForbiddenException(
        'You do not have permission to access this answerbook evidence',
      );

    return {
      id: grade.id,
      status: grade.status,
      academicCycleId: grade.academicCycleId,
      attachmentCount: grade._count.answerbookAttachments,
      isStudentEnrolled: grade.assessment.section.enrollments.some(
        (enrollment) => enrollment.studentId === grade.studentId,
      ),
    };
  }
}
