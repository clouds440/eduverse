import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CurriculumStatus,
  AssessmentLifecycleStatus,
  CohortOfferingStatus,
  EnrollmentSource,
  Prisma,
  ProgramCompletionMode,
  ProgramOfferingStatus,
  ProgramStageOfferingStatus,
  ProgramStatus,
  StudentProgramEnrollmentStatus,
  StudentProgressionOutcome,
  StudentStageEnrollmentStatus,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertDepartmentInScope,
  assertDepartmentIdsBelongToOrg,
  getDepartmentScope,
  type DepartmentScopedUser,
} from '../common/department-scope';
import {
  ActivateProgramStageDto,
  AdvanceProgramStageDto,
  AdmitStudentProgramDto,
  RepeatProgramStageDto,
  ResolveProgramStageDto,
  TransferStudentProgramDto,
  WithdrawStudentProgramDto,
} from './dto/student-program-enrollment.dto';
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';
import { runSerializableTransaction } from '../common/prisma-transaction';
import { Role } from '../common/enums';
import { evaluateProgression } from './progression-evaluator';
import { buildStageEvidence } from './progression-evidence';

type Transaction = Prisma.TransactionClient;
type Actor = DepartmentScopedUser & { id: string };

const OPEN_STATUSES: StudentProgramEnrollmentStatus[] = [
  StudentProgramEnrollmentStatus.ADMITTED,
  StudentProgramEnrollmentStatus.ACTIVE,
  StudentProgramEnrollmentStatus.ON_HOLD,
];

const ENROLLMENT_INCLUDE = {
  program: { include: { campusConfiguration: { include: { department: true } } } },
  curriculumVersion: {
    include: { stages: { orderBy: { sequence: 'asc' as const } } },
  },
  programConfigurationRevision: true,
  entryStage: true,
  stageEnrollments: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      programStage: true,
      programStageOffering: { include: { programOffering: { include: { campusBinding: { include: { academicCycle: true } } } } } },
      cohortOffering: { include: { cohort: true } },
    },
  },
  progressionDecisions: { orderBy: { decidedAt: 'asc' as const } },
} satisfies Prisma.StudentProgramEnrollmentInclude;

@Injectable()
export class StudentProgramEnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private runTransaction<T>(operation: (tx: Transaction) => Promise<T>) {
    return runSerializableTransaction(this.prisma, operation, {
      conflictMessage: 'Student program state changed concurrently; refresh and try again',
    });
  }

  private openSlot(studentId: string) {
    return `student:${studentId}`;
  }

  private async progressionEvaluation(tx: Transaction | PrismaService, orgId: string, enrollmentId: string) {
    const enrollment = await tx.studentProgramEnrollment.findFirst({
      where: { id: enrollmentId, organizationId: orgId },
      include: {
        curriculumVersion: {
          include: {
            stages: {
              orderBy: { sequence: 'asc' },
              include: { courseRequirements: { select: { creditHoursSnapshot: true, requirementType: true, groupKey: true, minCourses: true, minCredits: true } } },
            },
          },
        },
        stageEnrollments: { select: { id: true, programStageId: true, status: true } },
      },
    });
    if (!enrollment) throw new NotFoundException('Student program enrollment not found');
    return {
      enrollment,
      evaluation: evaluateProgression({
        progressionMode: enrollment.progressionModeSnapshot,
        completionMode: enrollment.completionModeSnapshot,
        stages: enrollment.curriculumVersion.stages,
        attempts: enrollment.stageEnrollments,
        entryStageId: enrollment.entryStageId,
      }),
    };
  }

  private async stageEvidenceSnapshot(tx: Transaction | PrismaService, orgId: string, enrollmentId: string, stageEnrollmentId: string) {
    const stageEnrollment = await tx.studentStageEnrollment.findFirst({
      where: { id: stageEnrollmentId, organizationId: orgId, studentProgramEnrollmentId: enrollmentId },
      include: {
        studentProgramEnrollment: {
          select: {
            studentId: true,
            minimumPassingPercentageSnapshot: true,
            minimumAttendancePercentageSnapshot: true,
          },
        },
        programStage: {
          include: { courseRequirements: { include: { course: { select: { code: true, name: true } } } } },
        },
      },
    });
    if (!stageEnrollment) throw new NotFoundException('Stage enrollment not found');
    const sectionEnrollments = await tx.enrollment.findMany({
      where: { studentStageEnrollmentId: stageEnrollmentId, studentId: stageEnrollment.studentProgramEnrollment.studentId },
      select: { sectionId: true },
    });
    const sectionIds = [...new Set(sectionEnrollments.map((row) => row.sectionId))];
    const courseIds = [...new Set(stageEnrollment.programStage.courseRequirements.map((row) => row.courseId))];
    const [assessments, attendance] = await Promise.all([
      tx.assessment.findMany({
        where: { sectionId: { in: sectionIds }, courseId: { in: courseIds }, status: AssessmentLifecycleStatus.ACTIVE },
        select: {
          courseId: true,
          totalMarks: true,
          weightage: true,
          grades: {
            where: { studentId: stageEnrollment.studentProgramEnrollment.studentId },
            select: { status: true, marksObtained: true },
            take: 1,
          },
        },
      }),
      tx.attendanceRecord.findMany({
        where: { studentId: stageEnrollment.studentProgramEnrollment.studentId, session: { sectionId: { in: sectionIds } } },
        select: { status: true },
      }),
    ]);
    return buildStageEvidence({
      requirements: stageEnrollment.programStage.courseRequirements.map((requirement) => ({
        courseId: requirement.courseId,
        courseCode: requirement.course.code,
        courseName: requirement.course.name,
        requirementType: requirement.requirementType,
        groupKey: requirement.groupKey,
        minCourses: requirement.minCourses,
        minCredits: requirement.minCredits,
        creditHoursSnapshot: requirement.creditHoursSnapshot,
      })),
      assessments: assessments.map((assessment) => ({
        courseId: assessment.courseId,
        totalMarks: assessment.totalMarks,
        weightage: assessment.weightage,
        grade: assessment.grades[0] ?? null,
      })),
      attendance: attendance.map((record) => record.status),
      minimumPassingPercentage: stageEnrollment.studentProgramEnrollment.minimumPassingPercentageSnapshot,
      minimumAttendancePercentage: stageEnrollment.studentProgramEnrollment.minimumAttendancePercentageSnapshot,
      stageMinimumCredits: stageEnrollment.programStage.minCredits,
    });
  }

  private async admissionProgram(tx: Transaction, orgId: string, programId: string, programOfferingId?: string) {
    if (programOfferingId) {
      const offering = await tx.programOffering.findFirst({
        where: {
          id: programOfferingId,
          campusBinding: { organizationId: orgId },
          programId,
          program: { status: ProgramStatus.ACTIVE },
        },
        include: {
          program: { include: { campusConfiguration: { include: { department: true } } } },
          campusBinding: {
            include: {
              curriculumVersion: {
                include: {
                  stages: { orderBy: { sequence: 'asc' } },
                  programConfigurationRevision: true,
                },
              },
            },
          },
        },
      });
      if (!offering) throw new NotFoundException('Program offering not found');
      if (!offering.campusBinding || offering.campusBinding.curriculumVersion.stages.length === 0) {
        throw new ConflictException('The program offering curriculum has no stages');
      }
      return {
        program: offering.program,
        revision: offering.campusBinding.curriculumVersion.programConfigurationRevision,
        curriculum: offering.campusBinding.curriculumVersion,
      };
    }
    const program = await tx.program.findFirst({
      where: { id: programId, campusConfiguration: { organizationId: orgId }, status: ProgramStatus.ACTIVE },
      include: {
        campusConfiguration: { include: { department: true } },
        configurationRevisions: { orderBy: { version: 'desc' }, take: 1 },
        curriculumVersions: {
          where: { status: CurriculumStatus.ACTIVE, isDefaultForAdmissions: true },
          include: { stages: { orderBy: { sequence: 'asc' } } },
          take: 1,
        },
      },
    });
    if (!program) throw new NotFoundException('Active program not found');
    if (!program.campusConfiguration) throw new NotFoundException('Campus program configuration not found');
    const revision = program.configurationRevisions.find((row) => row.version === program.campusConfiguration!.configurationVersion);
    if (!revision) throw new ConflictException('The current program configuration revision is unavailable');
    const curriculum = program.curriculumVersions.find((row) => row.programConfigurationRevisionId === revision.id);
    if (!curriculum || curriculum.stages.length === 0) {
      throw new ConflictException('The program needs an active default admissions curriculum with stages');
    }
    return { program, revision, curriculum };
  }

  async resolveAdmissionDepartment(orgId: string, programId: string, actor?: Actor, programOfferingId?: string) {
    return this.runTransaction(async (tx) => {
      const { program } = await this.admissionProgram(tx, orgId, programId, programOfferingId);
      const scope = await getDepartmentScope(this.prisma, orgId, actor);
      if (!program.campusConfiguration) throw new NotFoundException('Campus program configuration not found');
      assertDepartmentInScope(scope, program.campusConfiguration.departmentId, 'You cannot assign a program outside your department scope');
      return program.campusConfiguration.department;
    });
  }

  async admitInTransaction(
    tx: Transaction,
    orgId: string,
    studentId: string,
    dto: AdmitStudentProgramDto,
    actorId: string,
  ) {
    const student = await tx.student.findFirst({ where: { id: studentId, organizationId: orgId }, select: { id: true } });
    if (!student) throw new NotFoundException('Student not found');
    const open = await tx.studentProgramEnrollment.findFirst({
      where: { studentId, organizationId: orgId, status: { in: OPEN_STATUSES } },
      select: { id: true },
    });
    if (open) throw new ConflictException('Student already has an active major');

    const { program, revision, curriculum } = await this.admissionProgram(tx, orgId, dto.programId, dto.programOfferingId);
    const entryStage = dto.entryStageId
      ? curriculum.stages.find((stage) => stage.id === dto.entryStageId)
      : curriculum.stages[0];
    if (dto.entryStageId && !entryStage) throw new BadRequestException('Entry stage does not belong to the admissions curriculum');

    return tx.studentProgramEnrollment.create({
      data: {
        organizationId: orgId,
        studentId,
        programId: program.id,
        curriculumVersionId: curriculum.id,
        programConfigurationRevisionId: revision.id,
        status: StudentProgramEnrollmentStatus.ADMITTED,
        openSlot: this.openSlot(studentId),
        requiredStageCountSnapshot: curriculum.stages.filter((stage) => !stage.isOptional && stage.sequence >= (entryStage?.sequence ?? 0)).length,
        programConfigurationVersionSnapshot: program.campusConfiguration!.configurationVersion,
        curriculumSnapshotHash: revision.checksum,
        progressionModeSnapshot: program.campusConfiguration!.progressionMode,
        completionModeSnapshot: program.campusConfiguration!.completionMode,
        minimumPassingPercentageSnapshot: program.campusConfiguration!.minimumPassingPercentage,
        minimumAttendancePercentageSnapshot: program.campusConfiguration!.minimumAttendancePercentage,
        entryStageId: entryStage?.id,
        admittedById: actorId,
      },
      include: ENROLLMENT_INCLUDE,
    });
  }

  async admit(orgId: string, studentId: string, dto: AdmitStudentProgramDto, actor: Actor) {
    const department = await this.resolveAdmissionDepartment(orgId, dto.programId, actor, dto.programOfferingId);
    return this.runTransaction(async (tx) => {
      const enrollment = await this.admitInTransaction(tx, orgId, studentId, dto, actor.id);
      await tx.student.update({ where: { id: studentId }, data: { primaryDepartmentId: department.id } });
      return enrollment;
    });
  }

  async list(orgId: string, studentId: string, actor?: Actor) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, organizationId: orgId } });
    if (!student) throw new NotFoundException('Student not found');
    if (actor?.role === Role.STUDENT && student.userId !== actor.id) {
      throw new NotFoundException('Student not found');
    }
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    return this.prisma.studentProgramEnrollment.findMany({
      where: {
        organizationId: orgId,
        studentId,
        program: {
          campusConfiguration: {
            departmentId: !scope.applies || scope.all ? undefined : { in: scope.departmentIds },
          },
        },
      },
      include: ENROLLMENT_INCLUDE,
      orderBy: { admittedAt: 'desc' },
    });
  }

  async getOpen(orgId: string, studentId: string) {
    return this.prisma.studentProgramEnrollment.findFirst({
      where: { organizationId: orgId, studentId, status: { in: OPEN_STATUSES } },
      include: ENROLLMENT_INCLUDE,
    });
  }

  async progressionPreview(orgId: string, studentId: string, enrollmentId: string, actor: Actor) {
    await this.ownedEnrollment(orgId, studentId, enrollmentId, actor);
    const { enrollment, evaluation } = await this.progressionEvaluation(this.prisma, orgId, enrollmentId);
    const offeringStageIds = enrollment.stageEnrollments.some((stage) => stage.status === StudentStageEnrollmentStatus.IN_PROGRESS)
      ? evaluation.nextStageIdsAfterResolution
      : evaluation.eligibleStageIds;
    const offerings = offeringStageIds.length
      ? await this.prisma.programStageOffering.findMany({
          where: {
            organizationId: orgId,
            programStageId: { in: offeringStageIds },
            status: ProgramStageOfferingStatus.OPEN,
            programOffering: {
              status: ProgramOfferingStatus.OPEN,
              programId: enrollment.programId,
              campusBinding: { curriculumVersionId: enrollment.curriculumVersionId },
            },
          },
          include: { programStage: true, programOffering: { include: { campusBinding: { include: { academicCycle: true } } } } },
          orderBy: [{ programStage: { sequence: 'asc' } }, { programOffering: { campusBinding: { academicCycle: { startDate: 'asc' } } } }],
        })
      : [];
    const currentStage = enrollment.stageEnrollments.find((stage) => stage.status === StudentStageEnrollmentStatus.IN_PROGRESS);
    const currentStageEvidence = currentStage
      ? await this.stageEvidenceSnapshot(this.prisma, orgId, enrollmentId, currentStage.id)
      : null;
    const evaluationAfterCurrentStage = currentStage && currentStageEvidence?.eligibleToComplete
      ? evaluateProgression({
          progressionMode: enrollment.progressionModeSnapshot,
          completionMode: enrollment.completionModeSnapshot,
          stages: enrollment.curriculumVersion.stages,
          attempts: enrollment.stageEnrollments.map((stage) => ({
            programStageId: stage.programStageId,
            status: stage.id === currentStage.id ? StudentStageEnrollmentStatus.COMPLETED : stage.status,
          })),
          entryStageId: enrollment.entryStageId,
        })
      : null;
    const canCompleteAfterCurrentStage = Boolean(evaluationAfterCurrentStage?.canCompleteProgram);
    return {
      ...evaluation,
      recommendation: currentStageEvidence
        ? currentStageEvidence.eligibleToComplete
          ? canCompleteAfterCurrentStage ? StudentProgressionOutcome.COMPLETE : StudentProgressionOutcome.ADVANCE
          : StudentProgressionOutcome.REPEAT
        : evaluation.recommendation,
      canCompleteAfterCurrentStage,
      currentStageEvidence,
      offerings,
    };
  }

  private async ownedEnrollment(orgId: string, studentId: string, enrollmentId: string, actor: Actor) {
    const enrollment = await this.prisma.studentProgramEnrollment.findFirst({
      where: { id: enrollmentId, organizationId: orgId, studentId },
      include: { program: { include: { campusConfiguration: true } } },
    });
    if (!enrollment) throw new NotFoundException('Student program enrollment not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    if (!enrollment.program.campusConfiguration) throw new NotFoundException('Campus program configuration not found');
    assertDepartmentInScope(scope, enrollment.program.campusConfiguration.departmentId, 'You cannot manage this program outside your assigned departments');
    return enrollment;
  }

  async transfer(orgId: string, studentId: string, dto: TransferStudentProgramDto, actor: Actor, idempotencyKey?: string) {
    const targetDepartment = await this.resolveAdmissionDepartment(orgId, dto.programId, actor);
    return this.runTransaction(async (tx) => {
      if (idempotencyKey) {
        const existingDecision = await tx.studentProgressionDecision.findFirst({ where: { organizationId: orgId, idempotencyKey } });
        if (existingDecision) {
          return tx.studentProgramEnrollment.findFirstOrThrow({ where: { organizationId: orgId, studentId, status: { in: OPEN_STATUSES } }, include: ENROLLMENT_INCLUDE });
        }
      }
      const current = await tx.studentProgramEnrollment.findFirst({
        where: { organizationId: orgId, studentId, status: { in: OPEN_STATUSES } },
        include: { program: { include: { campusConfiguration: true } } },
      });
      if (!current) throw new ConflictException('Student does not have an active major to transfer');
      const scope = await getDepartmentScope(tx, orgId, actor);
      if (!current.program.campusConfiguration) throw new NotFoundException('Campus program configuration not found');
      assertDepartmentInScope(scope, current.program.campusConfiguration.departmentId, 'You cannot transfer a student from a program outside your assigned departments');
      await tx.studentStageEnrollment.updateMany({
        where: { studentProgramEnrollmentId: current.id, status: { in: [StudentStageEnrollmentStatus.PLANNED, StudentStageEnrollmentStatus.IN_PROGRESS] } },
        data: { status: StudentStageEnrollmentStatus.WITHDRAWN, completedAt: new Date(), resolvedById: actor.id, reason: dto.reason },
      });
      await tx.studentProgressionDecision.create({
        data: {
          organizationId: orgId,
          studentProgramEnrollmentId: current.id,
          outcome: StudentProgressionOutcome.TRANSFER,
          reason: dto.reason,
          decidedById: actor.id,
          idempotencyKey,
        },
      });
      await tx.studentProgramEnrollment.update({
        where: { id: current.id },
        data: { status: StudentProgramEnrollmentStatus.TRANSFERRED_OUT, openSlot: null, endedAt: new Date(), endedById: actor.id, exitReason: dto.reason },
      });
      const next = await this.admitInTransaction(tx, orgId, studentId, dto, actor.id);
      await tx.student.update({ where: { id: studentId }, data: { primaryDepartmentId: targetDepartment.id } });
      return next;
    });
  }

  async hold(orgId: string, studentId: string, enrollmentId: string, reason: string, actor: Actor, idempotencyKey?: string) {
    await this.ownedEnrollment(orgId, studentId, enrollmentId, actor);
    return this.runTransaction(async (tx) => {
      if (idempotencyKey) {
        const existingDecision = await tx.studentProgressionDecision.findFirst({ where: { organizationId: orgId, idempotencyKey } });
        if (existingDecision) return tx.studentProgramEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
      }
      const enrollment = await tx.studentProgramEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
      if (![StudentProgramEnrollmentStatus.ADMITTED, StudentProgramEnrollmentStatus.ACTIVE].includes(enrollment.status as never)) {
        throw new ConflictException('Only admitted or active majors can be placed on hold');
      }
      await tx.studentProgressionDecision.create({
        data: { organizationId: orgId, studentProgramEnrollmentId: enrollmentId, outcome: StudentProgressionOutcome.PAUSE, reason, decidedById: actor.id, idempotencyKey },
      });
      return tx.studentProgramEnrollment.update({ where: { id: enrollmentId }, data: { status: StudentProgramEnrollmentStatus.ON_HOLD } });
    });
  }

  async resume(orgId: string, studentId: string, enrollmentId: string, actor: Actor) {
    await this.ownedEnrollment(orgId, studentId, enrollmentId, actor);
    return this.runTransaction(async (tx) => {
      const enrollment = await tx.studentProgramEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
      if (enrollment.status !== StudentProgramEnrollmentStatus.ON_HOLD) throw new ConflictException('Only a major on hold can be resumed');
      await tx.studentProgressionDecision.create({
        data: { organizationId: orgId, studentProgramEnrollmentId: enrollmentId, outcome: StudentProgressionOutcome.REMAIN, reason: 'Program enrollment resumed', decidedById: actor.id },
      });
      return tx.studentProgramEnrollment.update({ where: { id: enrollmentId }, data: { status: StudentProgramEnrollmentStatus.ACTIVE } });
    });
  }

  async withdraw(orgId: string, studentId: string, enrollmentId: string, dto: WithdrawStudentProgramDto, actor: Actor) {
    const enrollment = await this.ownedEnrollment(orgId, studentId, enrollmentId, actor);
    if (!OPEN_STATUSES.includes(enrollment.status)) throw new ConflictException('This major is already closed');
    if (dto.replacementPrimaryDepartmentId) {
      await assertDepartmentIdsBelongToOrg(this.prisma, orgId, [dto.replacementPrimaryDepartmentId]);
      const scope = await getDepartmentScope(this.prisma, orgId, actor);
      assertDepartmentInScope(scope, dto.replacementPrimaryDepartmentId, 'You cannot assign a replacement department outside your scope');
    }
    return this.runTransaction(async (tx) => {
      const current = await tx.studentProgramEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
      if (!OPEN_STATUSES.includes(current.status)) throw new ConflictException('This major is already closed');
      await tx.studentStageEnrollment.updateMany({
        where: { studentProgramEnrollmentId: enrollmentId, status: { in: [StudentStageEnrollmentStatus.PLANNED, StudentStageEnrollmentStatus.IN_PROGRESS] } },
        data: { status: StudentStageEnrollmentStatus.WITHDRAWN, completedAt: new Date(), resolvedById: actor.id, reason: dto.reason },
      });
      await tx.studentProgressionDecision.create({
        data: { organizationId: orgId, studentProgramEnrollmentId: enrollmentId, outcome: StudentProgressionOutcome.WITHDRAW, reason: dto.reason, decidedById: actor.id },
      });
      const result = await tx.studentProgramEnrollment.update({
        where: { id: enrollmentId },
        data: { status: StudentProgramEnrollmentStatus.WITHDRAWN, openSlot: null, endedAt: new Date(), endedById: actor.id, exitReason: dto.reason },
      });
      if (!dto.retainPrimaryDepartment) {
        await tx.student.update({ where: { id: studentId }, data: { primaryDepartmentId: dto.replacementPrimaryDepartmentId ?? null } });
      }
      return result;
    });
  }

  private async activateStageInTransaction(
    tx: Transaction,
    orgId: string,
    enrollment: { id: string; curriculumVersionId: string; programId: string; status: StudentProgramEnrollmentStatus },
    programStageOfferingId: string,
    cohortOfferingId: string | undefined,
    actorId: string,
    reason?: string,
  ) {
    if (!OPEN_STATUSES.includes(enrollment.status)) throw new ConflictException('The student major is not open');
    if (enrollment.status === StudentProgramEnrollmentStatus.ON_HOLD) throw new ConflictException('Resume the major before starting a stage');
    const offering = await tx.programStageOffering.findFirst({
      where: {
        id: programStageOfferingId,
        organizationId: orgId,
        status: ProgramStageOfferingStatus.OPEN,
        programOffering: { status: ProgramOfferingStatus.OPEN, programId: enrollment.programId, campusBinding: { curriculumVersionId: enrollment.curriculumVersionId } },
      },
      include: { programStage: true, programOffering: { include: { campusBinding: { include: { academicCycle: true } } } } },
    });
    if (!offering) throw new BadRequestException('Open stage offering does not match the student program and curriculum');
    if (!offering.programOffering.campusBinding) throw new ConflictException('Campus offering binding not found');
    await assertAcademicCycleWritable(tx, orgId, offering.programOffering.campusBinding.academicCycleId, 'DELIVERY');
    if (cohortOfferingId) {
      const cohort = await tx.cohortOffering.findFirst({
        where: { id: cohortOfferingId, organizationId: orgId, status: CohortOfferingStatus.ACTIVE, academicCycleId: offering.programOffering.campusBinding.academicCycleId, programStageOfferingId },
      });
      if (!cohort) throw new BadRequestException('Cohort offering does not match the selected stage offering');
    }
    const existing = await tx.studentStageEnrollment.findFirst({
      where: { studentProgramEnrollmentId: enrollment.id, programStageOfferingId, status: { in: [StudentStageEnrollmentStatus.PLANNED, StudentStageEnrollmentStatus.IN_PROGRESS] } },
    });
    if (existing) return existing;
    const { evaluation } = await this.progressionEvaluation(tx, orgId, enrollment.id);
    if (!evaluation.eligibleStageIds.includes(offering.programStageId)) {
      throw new ConflictException('This stage is not currently eligible under the program progression policy');
    }
    if (offering.capacity) {
      const occupied = await tx.studentStageEnrollment.count({
        where: {
          programStageOfferingId,
          status: { in: [StudentStageEnrollmentStatus.PLANNED, StudentStageEnrollmentStatus.IN_PROGRESS] },
        },
      });
      if (occupied >= offering.capacity) throw new ConflictException('The selected stage offering is at capacity');
    }
    const attemptNumber = await tx.studentStageEnrollment.count({
      where: { studentProgramEnrollmentId: enrollment.id, programStageId: offering.programStageId },
    });
    const stageEnrollment = await tx.studentStageEnrollment.create({
      data: {
        organizationId: orgId,
        studentProgramEnrollmentId: enrollment.id,
        programStageId: offering.programStageId,
        programStageOfferingId,
        cohortOfferingId,
        attemptNumber: attemptNumber + 1,
        status: StudentStageEnrollmentStatus.IN_PROGRESS,
        stageNameSnapshot: offering.programStage.name,
        stageCodeSnapshot: offering.programStage.code,
        cycleNameSnapshot: offering.programOffering.campusBinding.academicCycle.name,
        cycleCodeSnapshot: offering.programOffering.campusBinding.academicCycle.code,
        reason,
        startedAt: new Date(),
      },
    });
    await tx.studentProgramEnrollment.update({
      where: { id: enrollment.id },
      data: { status: StudentProgramEnrollmentStatus.ACTIVE, startedAt: { set: new Date() } },
    });
    return stageEnrollment;
  }

  async activateStage(orgId: string, studentId: string, enrollmentId: string, dto: ActivateProgramStageDto, actor: Actor) {
    const enrollment = await this.ownedEnrollment(orgId, studentId, enrollmentId, actor);
    return this.runTransaction((tx) => this.activateStageInTransaction(tx, orgId, enrollment, dto.programStageOfferingId, dto.cohortOfferingId, actor.id, dto.reason));
  }

  async ensureCohortOfferingPlacement(tx: Transaction, orgId: string, studentId: string, cohortOfferingId: string, actorId: string) {
    const cohort = await tx.cohortOffering.findFirst({
      where: { id: cohortOfferingId, organizationId: orgId },
      include: { programStageOffering: { include: { programOffering: { include: { campusBinding: true } } } } },
    });
    if (!cohort?.programStageOffering) return null;
    const enrollment = await tx.studentProgramEnrollment.findFirst({
      where: {
        organizationId: orgId,
        studentId,
        programId: cohort.programStageOffering.programOffering.programId,
        curriculumVersionId: cohort.programStageOffering.programOffering.campusBinding!.curriculumVersionId,
        status: { in: OPEN_STATUSES },
      },
    });
    if (!enrollment) throw new ConflictException('Student is not admitted to the program and curriculum used by this cohort offering');
    return this.activateStageInTransaction(tx, orgId, enrollment, cohort.programStageOfferingId!, cohortOfferingId, actorId);
  }

  async ensureMappedCohortPlacement(
    tx: Transaction,
    orgId: string,
    studentId: string,
    cohort: { id: string },
    actorId: string,
  ) {
    return this.ensureCohortOfferingPlacement(tx, orgId, studentId, cohort.id, actorId);
  }

  async ensureMappedSectionEnrollment(
    tx: Transaction,
    orgId: string,
    studentId: string,
    section: { id: string; academicCycleId: string; programMappings?: Array<{ programStageOfferingId: string }> },
    _actorId: string,
  ) {
    const mappings = section.programMappings ?? await tx.sectionProgramMapping.findMany({ where: { sectionId: section.id } });
    if (!mappings.length) return null;
    const active = await tx.studentStageEnrollment.findFirst({
      where: {
        organizationId: orgId,
        studentProgramEnrollment: { studentId, status: { in: OPEN_STATUSES } },
        programStageOfferingId: { in: mappings.map((mapping) => mapping.programStageOfferingId) },
        status: StudentStageEnrollmentStatus.IN_PROGRESS,
      },
      include: { studentProgramEnrollment: true },
    });
    if (!active) throw new ConflictException('Student must have an active stage enrollment served by this section');
    return { enrollment: active.studentProgramEnrollment, stageEnrollment: active, attempt: active };
  }

  private async resolveStage(
    orgId: string,
    studentId: string,
    enrollmentId: string,
    stageEnrollmentId: string,
    dto: ResolveProgramStageDto,
    actor: Actor,
    status: StudentStageEnrollmentStatus,
    outcome: StudentProgressionOutcome,
    idempotencyKey?: string,
    target?: { programStageOfferingId: string; cohortOfferingId?: string },
    completeProgramAfterResolution = false,
  ) {
    const enrollment = await this.ownedEnrollment(orgId, studentId, enrollmentId, actor);
    const targetCohortOfferingId = target?.cohortOfferingId;
    return this.runTransaction(async (tx) => {
      if (idempotencyKey) {
        const existingDecision = await tx.studentProgressionDecision.findFirst({ where: { organizationId: orgId, idempotencyKey } });
        if (existingDecision) return tx.studentStageEnrollment.findUniqueOrThrow({ where: { id: stageEnrollmentId } });
      }
      const stage = await tx.studentStageEnrollment.findFirst({
        where: { id: stageEnrollmentId, studentProgramEnrollmentId: enrollmentId, status: StudentStageEnrollmentStatus.IN_PROGRESS },
      });
      if (!stage) throw new ConflictException('Only an in-progress stage can be resolved');
      const evidence = await this.stageEvidenceSnapshot(tx, orgId, enrollmentId, stage.id);
      const isSkip = status === StudentStageEnrollmentStatus.SKIPPED;
      const isOverride = isSkip || (!evidence.eligibleToComplete && Boolean(dto.overrideReason?.trim()));
      if (status === StudentStageEnrollmentStatus.COMPLETED && !evidence.eligibleToComplete && !isOverride) {
        throw new ConflictException(`${evidence.blockers.map((blocker) => blocker.message).join(' ')} Supply an override reason to continue.`);
      }
      let resultSnapshot: Record<string, unknown> = { evidence, operator: dto.resultSnapshot ?? null };
      const targetOffering = target
        ? await tx.programStageOffering.findFirst({
            where: {
              id: target.programStageOfferingId,
              organizationId: orgId,
              status: ProgramStageOfferingStatus.OPEN,
              programOffering: { status: ProgramOfferingStatus.OPEN },
            },
            select: { id: true, programStageId: true },
          })
        : null;
      if (target && !targetOffering) throw new BadRequestException('Target stage offering is not open');
      const updated = await tx.studentStageEnrollment.update({
        where: { id: stage.id },
        data: { status, completedAt: new Date(), resolvedById: actor.id, reason: dto.overrideReason?.trim() || dto.reason, resultSnapshot: resultSnapshot as unknown as Prisma.InputJsonValue },
      });
      if (completeProgramAfterResolution) {
        const completion = await this.progressionEvaluation(tx, orgId, enrollmentId);
        if (!completion.evaluation.canCompleteProgram && completion.enrollment.completionModeSnapshot !== ProgramCompletionMode.MANUAL) {
          throw new ConflictException('The configured program completion requirements have not been met after resolving this stage');
        }
        resultSnapshot = { ...resultSnapshot, completion: completion.evaluation };
      }
      await tx.studentProgressionDecision.create({
        data: {
          organizationId: orgId,
          studentProgramEnrollmentId: enrollmentId,
          sourceStageEnrollmentId: stage.id,
          sourceStageId: stage.programStageId,
          outcome,
          targetStageId: targetOffering?.programStageId,
          targetStageOfferingId: targetOffering?.id,
          recommendationSnapshot: { outcome: evidence.eligibleToComplete ? StudentProgressionOutcome.ADVANCE : StudentProgressionOutcome.REPEAT, blockers: evidence.blockers } as Prisma.InputJsonValue,
          reason: dto.overrideReason?.trim() || dto.reason,
          resultSnapshot: resultSnapshot as unknown as Prisma.InputJsonValue,
          isOverride,
          idempotencyKey,
          decidedById: actor.id,
        },
      });
      if (completeProgramAfterResolution) {
        const completedEnrollment = await tx.studentProgramEnrollment.update({
          where: { id: enrollmentId },
          data: { status: StudentProgramEnrollmentStatus.COMPLETED, openSlot: null, endedAt: new Date(), endedById: actor.id, exitReason: dto.overrideReason?.trim() || dto.reason },
        });
        return { resolvedStage: updated, completedEnrollment };
      }
      if (!targetOffering) return updated;
      const next = await this.activateStageInTransaction(tx, orgId, enrollment, targetOffering.id, targetCohortOfferingId, actor.id, dto.overrideReason?.trim() || dto.reason);
      return { resolvedStage: updated, targetStageEnrollment: next };
    });
  }

  async completeStage(orgId: string, studentId: string, enrollmentId: string, stageId: string, dto: ResolveProgramStageDto, actor: Actor, idempotencyKey?: string) {
    return this.resolveStage(orgId, studentId, enrollmentId, stageId, dto, actor, StudentStageEnrollmentStatus.COMPLETED, StudentProgressionOutcome.ADVANCE, idempotencyKey);
  }

  async advanceStage(orgId: string, studentId: string, enrollmentId: string, stageId: string, dto: AdvanceProgramStageDto, actor: Actor, idempotencyKey?: string) {
    return this.resolveStage(orgId, studentId, enrollmentId, stageId, dto, actor, StudentStageEnrollmentStatus.COMPLETED, StudentProgressionOutcome.ADVANCE, idempotencyKey, {
      programStageOfferingId: dto.targetProgramStageOfferingId,
      cohortOfferingId: dto.cohortOfferingId,
    });
  }

  async completeStageAndProgram(orgId: string, studentId: string, enrollmentId: string, stageId: string, dto: ResolveProgramStageDto, actor: Actor, idempotencyKey?: string) {
    return this.resolveStage(
      orgId,
      studentId,
      enrollmentId,
      stageId,
      dto,
      actor,
      StudentStageEnrollmentStatus.COMPLETED,
      StudentProgressionOutcome.COMPLETE,
      idempotencyKey,
      undefined,
      true,
    );
  }

  async skipStage(orgId: string, studentId: string, enrollmentId: string, stageId: string, dto: ResolveProgramStageDto, actor: Actor, idempotencyKey?: string) {
    return this.resolveStage(orgId, studentId, enrollmentId, stageId, dto, actor, StudentStageEnrollmentStatus.SKIPPED, StudentProgressionOutcome.ADVANCE, idempotencyKey);
  }

  async repeatStage(orgId: string, studentId: string, enrollmentId: string, stageEnrollmentId: string, dto: RepeatProgramStageDto, actor: Actor, idempotencyKey?: string) {
    const enrollment = await this.ownedEnrollment(orgId, studentId, enrollmentId, actor);
    if (!dto.targetProgramStageOfferingId) throw new BadRequestException('Choose an open offering for the repeated stage');
    const targetProgramStageOfferingId = dto.targetProgramStageOfferingId;
    return this.runTransaction(async (tx) => {
      if (idempotencyKey) {
        const existingDecision = await tx.studentProgressionDecision.findFirst({ where: { organizationId: orgId, idempotencyKey } });
        if (existingDecision) return tx.studentStageEnrollment.findUniqueOrThrow({ where: { id: stageEnrollmentId } });
      }
      const source = await tx.studentStageEnrollment.findFirst({ where: { id: stageEnrollmentId, studentProgramEnrollmentId: enrollmentId } });
      if (!source) throw new NotFoundException('Stage enrollment not found');
      if (![StudentStageEnrollmentStatus.IN_PROGRESS, StudentStageEnrollmentStatus.FAILED].includes(source.status as never)) {
        throw new ConflictException('Only an in-progress or failed stage can be repeated');
      }
      const target = await tx.programStageOffering.findFirst({
        where: {
          id: targetProgramStageOfferingId,
          organizationId: orgId,
          programStageId: source.programStageId,
          status: ProgramStageOfferingStatus.OPEN,
          programOffering: { status: ProgramOfferingStatus.OPEN, programId: enrollment.programId, campusBinding: { curriculumVersionId: enrollment.curriculumVersionId } },
        },
        select: { id: true },
      });
      if (!target) throw new BadRequestException('The repeat target must be an open offering of the same program stage');
      const evidence = await this.stageEvidenceSnapshot(tx, orgId, enrollmentId, source.id);
      if (source.status === StudentStageEnrollmentStatus.IN_PROGRESS) {
        await tx.studentStageEnrollment.update({
          where: { id: source.id },
          data: { status: StudentStageEnrollmentStatus.FAILED, completedAt: new Date(), resolvedById: actor.id, reason: dto.reason },
        });
      }
      await tx.studentProgressionDecision.create({
        data: {
          organizationId: orgId,
          studentProgramEnrollmentId: enrollmentId,
          sourceStageEnrollmentId: source.id,
          sourceStageId: source.programStageId,
          outcome: StudentProgressionOutcome.REPEAT,
          targetStageId: source.programStageId,
          targetStageOfferingId: targetProgramStageOfferingId,
          recommendationSnapshot: { outcome: evidence.eligibleToComplete ? StudentProgressionOutcome.ADVANCE : StudentProgressionOutcome.REPEAT, blockers: evidence.blockers } as Prisma.InputJsonValue,
          resultSnapshot: { evidence } as unknown as Prisma.InputJsonValue,
          reason: dto.reason,
          decidedById: actor.id,
          idempotencyKey,
        },
      });
      return this.activateStageInTransaction(tx, orgId, enrollment, targetProgramStageOfferingId, dto.cohortOfferingId, actor.id, dto.reason);
    });
  }

  async completeProgram(orgId: string, studentId: string, enrollmentId: string, dto: ResolveProgramStageDto, actor: Actor, idempotencyKey?: string) {
    await this.ownedEnrollment(orgId, studentId, enrollmentId, actor);
    return this.runTransaction(async (tx) => {
      if (idempotencyKey) {
        const existingDecision = await tx.studentProgressionDecision.findFirst({ where: { organizationId: orgId, idempotencyKey } });
        if (existingDecision) return tx.studentProgramEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
      }
      const { enrollment: context, evaluation } = await this.progressionEvaluation(tx, orgId, enrollmentId);
      if (!OPEN_STATUSES.includes(context.status)) throw new ConflictException('This major is already closed');
      if (!evaluation.canCompleteProgram && context.completionModeSnapshot !== ProgramCompletionMode.MANUAL) {
        throw new ConflictException('The configured program completion requirements have not been met');
      }
      await tx.studentProgressionDecision.create({
        data: {
          organizationId: orgId,
          studentProgramEnrollmentId: enrollmentId,
          outcome: StudentProgressionOutcome.COMPLETE,
          reason: dto.reason,
          recommendationSnapshot: evaluation as unknown as Prisma.InputJsonValue,
          resultSnapshot: { progression: evaluation, operator: dto.resultSnapshot ?? null } as unknown as Prisma.InputJsonValue,
          decidedById: actor.id,
          idempotencyKey,
        },
      });
      return tx.studentProgramEnrollment.update({
        where: { id: enrollmentId },
        data: { status: StudentProgramEnrollmentStatus.COMPLETED, openSlot: null, endedAt: new Date(), endedById: actor.id, exitReason: dto.reason },
      });
    });
  }
}
