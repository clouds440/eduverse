import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, ProgressionBulkOperationStatus, StudentStageEnrollmentStatus } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { assertDepartmentInScope, getDepartmentScope, type DepartmentScopedUser } from '../common/department-scope';
import { stableJsonStringify } from '../common/stable-json';
import { StudentProgramEnrollmentsService } from './student-program-enrollments.service';
import { ApplyBulkProgressionDto, BulkProgressionAction, ProgressionWorkbenchPreviewDto } from './dto/progression-workbench.dto';

type Actor = DepartmentScopedUser & { id: string };

@Injectable()
export class ProgressionWorkbenchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentPrograms: StudentProgramEnrollmentsService,
  ) {}

  private async sourceOffering(orgId: string, id: string, actor: Actor) {
    const offering = await this.prisma.programStageOffering.findFirst({
      where: { id, organizationId: orgId },
      include: { programStage: true, programOffering: { include: { program: { include: { campusConfiguration: true } }, campusBinding: { include: { academicCycle: true } } } } },
    });
    if (!offering) throw new NotFoundException('Program stage offering not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    if (!offering.programOffering.program.campusConfiguration) throw new NotFoundException('Campus program configuration not found');
    assertDepartmentInScope(scope, offering.programOffering.program.campusConfiguration.departmentId, 'You cannot manage progression outside your assigned departments');
    return offering;
  }

  async preview(orgId: string, dto: ProgressionWorkbenchPreviewDto, actor: Actor) {
    const offering = await this.sourceOffering(orgId, dto.programStageOfferingId, actor);
    if (dto.cohortOfferingId) {
      const cohort = await this.prisma.cohortOffering.findFirst({
        where: { id: dto.cohortOfferingId, organizationId: orgId, programStageOfferingId: offering.id },
        select: { id: true },
      });
      if (!cohort) throw new BadRequestException('Cohort offering does not belong to the source stage offering');
    }
    const attempts = await this.prisma.studentStageEnrollment.findMany({
      where: {
        organizationId: orgId,
        programStageOfferingId: offering.id,
        cohortOfferingId: dto.cohortOfferingId,
        status: StudentStageEnrollmentStatus.IN_PROGRESS,
      },
      include: {
        studentProgramEnrollment: {
          include: { student: { include: { user: { select: { id: true, name: true, email: true } } } }, program: true },
        },
      },
      orderBy: { studentProgramEnrollment: { student: { registrationNumber: 'asc' } } },
    });
    const rows: Array<Record<string, unknown>> = [];
    for (const attempt of attempts) {
      const preview = await this.studentPrograms.progressionPreview(orgId, attempt.studentProgramEnrollment.studentId, attempt.studentProgramEnrollmentId, actor);
      rows.push({
        stageEnrollmentId: attempt.id,
        studentId: attempt.studentProgramEnrollment.studentId,
        enrollmentId: attempt.studentProgramEnrollmentId,
        student: attempt.studentProgramEnrollment.student,
        program: attempt.studentProgramEnrollment.program,
        recommendation: preview.currentStageEvidence?.eligibleToComplete
          ? preview.canCompleteAfterCurrentStage ? BulkProgressionAction.COMPLETE_PROGRAM : BulkProgressionAction.ADVANCE
          : BulkProgressionAction.REPEAT,
        evidence: preview.currentStageEvidence,
        nextOfferings: preview.offerings,
      });
    }
    return { offering, rows };
  }

  async apply(orgId: string, dto: ApplyBulkProgressionDto, actor: Actor) {
    await this.sourceOffering(orgId, dto.programStageOfferingId, actor);
    const requestHash = createHash('sha256').update(stableJsonStringify({
      programStageOfferingId: dto.programStageOfferingId,
      cohortOfferingId: dto.cohortOfferingId ?? null,
      items: dto.items,
    })).digest('hex');
    try {
      await this.prisma.progressionBulkOperation.create({
        data: {
          organizationId: orgId,
          idempotencyKey: dto.idempotencyKey,
          sourceProgramStageOfferingId: dto.programStageOfferingId,
          requestHash,
          createdById: actor.id,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const existing = await this.prisma.progressionBulkOperation.findUnique({
        where: { organizationId_idempotencyKey: { organizationId: orgId, idempotencyKey: dto.idempotencyKey } },
      });
      if (!existing || existing.requestHash !== requestHash) throw new ConflictException('This idempotency key was already used for a different bulk request');
      if (existing.status === ProgressionBulkOperationStatus.COMPLETED) return existing.result;
      if (existing.status === ProgressionBulkOperationStatus.FAILED) {
        throw new ConflictException(`This bulk progression request previously failed: ${existing.failureReason || 'unknown failure'}`);
      }
      throw new ConflictException('This bulk progression request is already running; retry after it completes');
    }

    try {
      const attempts = await this.prisma.studentStageEnrollment.findMany({
        where: { id: { in: dto.items.map((item) => item.stageEnrollmentId) }, organizationId: orgId, programStageOfferingId: dto.programStageOfferingId },
        include: { studentProgramEnrollment: true },
      });
      const byId = new Map(attempts.map((attempt) => [attempt.id, attempt]));
      const results: Array<{ stageEnrollmentId: string; success: boolean; error?: string }> = [];
      for (const item of dto.items) {
        const attempt = byId.get(item.stageEnrollmentId);
        if (!attempt || (dto.cohortOfferingId && attempt.cohortOfferingId !== dto.cohortOfferingId)) {
          results.push({ stageEnrollmentId: item.stageEnrollmentId, success: false, error: 'Stage enrollment is outside the selected workbench context' });
          continue;
        }
        const itemKey = `${dto.idempotencyKey}:${item.stageEnrollmentId}`;
        try {
          if (item.action === BulkProgressionAction.ADVANCE) {
            if (!item.targetProgramStageOfferingId) throw new BadRequestException('Choose a target stage offering for advancement');
            await this.studentPrograms.advanceStage(orgId, attempt.studentProgramEnrollment.studentId, attempt.studentProgramEnrollmentId, attempt.id, { ...item, targetProgramStageOfferingId: item.targetProgramStageOfferingId }, actor, itemKey);
          } else if (item.action === BulkProgressionAction.SKIP) {
            await this.studentPrograms.skipStage(orgId, attempt.studentProgramEnrollment.studentId, attempt.studentProgramEnrollmentId, attempt.id, item, actor, itemKey);
          } else if (item.action === BulkProgressionAction.REPEAT) {
            await this.studentPrograms.repeatStage(orgId, attempt.studentProgramEnrollment.studentId, attempt.studentProgramEnrollmentId, attempt.id, item, actor, itemKey);
          } else if (item.action === BulkProgressionAction.PAUSE) {
            await this.studentPrograms.hold(orgId, attempt.studentProgramEnrollment.studentId, attempt.studentProgramEnrollmentId, item.reason, actor, itemKey);
          } else if (item.action === BulkProgressionAction.TRANSFER) {
            if (!item.targetProgramId) throw new BadRequestException('Choose a target program for transfer');
            await this.studentPrograms.transfer(orgId, attempt.studentProgramEnrollment.studentId, { programId: item.targetProgramId, entryStageId: item.entryStageId, reason: item.reason }, actor, itemKey);
          } else if (item.action === BulkProgressionAction.COMPLETE_PROGRAM) {
            await this.studentPrograms.completeStageAndProgram(orgId, attempt.studentProgramEnrollment.studentId, attempt.studentProgramEnrollmentId, attempt.id, item, actor, itemKey);
          }
          results.push({ stageEnrollmentId: item.stageEnrollmentId, success: true });
        } catch (error) {
          results.push({ stageEnrollmentId: item.stageEnrollmentId, success: false, error: error instanceof Error ? error.message : 'Progression failed' });
        }
      }
      const result = { idempotencyKey: dto.idempotencyKey, succeeded: results.filter((row) => row.success).length, failed: results.filter((row) => !row.success).length, results };
      await this.prisma.progressionBulkOperation.update({
        where: { organizationId_idempotencyKey: { organizationId: orgId, idempotencyKey: dto.idempotencyKey } },
        data: { status: ProgressionBulkOperationStatus.COMPLETED, result: result as unknown as Prisma.InputJsonValue, completedAt: new Date() },
      });
      return result;
    } catch (error) {
      await this.prisma.progressionBulkOperation.update({
        where: { organizationId_idempotencyKey: { organizationId: orgId, idempotencyKey: dto.idempotencyKey } },
        data: { status: ProgressionBulkOperationStatus.FAILED, failureReason: error instanceof Error ? error.message : 'Bulk progression failed', completedAt: new Date() },
      });
      throw error;
    }
  }
}
