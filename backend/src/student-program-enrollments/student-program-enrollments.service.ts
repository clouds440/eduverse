import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CurriculumStatus,
  Prisma,
  ProgramAcademicCycleStatus,
  ProgramStatus,
  StudentProgramCycleStatus,
  StudentProgramEnrollmentStatus,
  StudentStageAttemptStatus,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertDepartmentInScope,
  getDepartmentScope,
  type DepartmentScopedUser,
} from '../common/department-scope';
import {
  ActivateProgramCycleDto,
  AdmitStudentProgramDto,
  RepeatProgramCycleDto,
  ResolveProgramCycleDto,
  TransferStudentProgramDto,
  WithdrawStudentProgramDto,
} from './dto/student-program-enrollment.dto';
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';
import { runSerializableTransaction } from '../common/prisma-transaction';

type Transaction = Prisma.TransactionClient;
type Actor = DepartmentScopedUser & { id: string };

const OPEN_STATUSES: StudentProgramEnrollmentStatus[] = [
  StudentProgramEnrollmentStatus.ADMITTED,
  StudentProgramEnrollmentStatus.ACTIVE,
  StudentProgramEnrollmentStatus.ON_HOLD,
];

const ENROLLMENT_INCLUDE = {
  program: { include: { department: true } },
  curriculumVersion: true,
  programConfigurationRevision: true,
  entryAcademicCycle: true,
  cycles: {
    include: {
      academicCycle: true,
      programStage: true,
      cohort: true,
      stageAttempts: { orderBy: { attemptNumber: 'asc' as const } },
    },
    orderBy: { sequenceSnapshot: 'asc' as const },
  },
  stageAttempts: {
    orderBy: [{ createdAt: 'asc' as const }, { attemptNumber: 'asc' as const }],
  },
} satisfies Prisma.StudentProgramEnrollmentInclude;

@Injectable()
export class StudentProgramEnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private runTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return runSerializableTransaction(this.prisma, operation, {
      conflictMessage:
        'Student program state changed concurrently; refresh and try again',
    });
  }

  private openSlot(studentId: string) {
    return `student:${studentId}`;
  }

  private async admissionProgram(
    tx: Transaction,
    orgId: string,
    programId: string,
  ) {
    const program = await tx.program.findFirst({
      where: {
        id: programId,
        organizationId: orgId,
        status: ProgramStatus.ACTIVE,
      },
      include: {
        department: true,
        configurationRevisions: { orderBy: { version: 'desc' }, take: 1 },
        curriculumVersions: {
          where: {
            status: CurriculumStatus.ACTIVE,
            isDefaultForAdmissions: true,
          },
          include: { stages: true },
          take: 1,
        },
        academicCycles: {
          where: { status: ProgramAcademicCycleStatus.ACTIVE },
          include: { academicCycle: true },
          orderBy: { sequence: 'asc' },
        },
      },
    });
    if (!program) throw new NotFoundException('Active program not found');

    const revision = program.configurationRevisions.find(
      (candidate) => candidate.version === program.configurationVersion,
    );
    if (!revision)
      throw new ConflictException(
        'The current program configuration revision is unavailable',
      );

    const curriculum = program.curriculumVersions.find(
      (candidate) => candidate.programConfigurationRevisionId === revision.id,
    );
    if (!curriculum) {
      throw new ConflictException(
        'The program does not have an active default admissions curriculum for its current configuration',
      );
    }

    if (program.academicCycles.length !== program.requiredCycleCount) {
      throw new ConflictException('The program cycle plan is incomplete');
    }
    const stagesByAssociation = new Map(
      curriculum.stages.map((stage) => [stage.programAcademicCycleId, stage]),
    );
    if (
      program.academicCycles.some(
        (association) => !stagesByAssociation.has(association.id),
      )
    ) {
      throw new ConflictException(
        'Every required program cycle must have a curriculum stage before admission',
      );
    }

    return { program, revision, curriculum, stagesByAssociation };
  }

  async resolveAdmissionDepartment(
    orgId: string,
    programId: string,
    actor?: Actor,
  ) {
    return this.runTransaction(async (tx) => {
      const { program } = await this.admissionProgram(tx, orgId, programId);
      const scope = await getDepartmentScope(this.prisma, orgId, actor);
      assertDepartmentInScope(
        scope,
        program.departmentId,
        'You cannot assign a program outside your department scope',
      );
      return program.department;
    });
  }

  async admitInTransaction(
    tx: Transaction,
    orgId: string,
    studentId: string,
    dto: AdmitStudentProgramDto,
    actorId: string,
  ) {
    const student = await tx.student.findFirst({
      where: { id: studentId, organizationId: orgId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const open = await tx.studentProgramEnrollment.findFirst({
      where: {
        studentId,
        organizationId: orgId,
        status: { in: OPEN_STATUSES },
      },
      select: { id: true },
    });
    if (open)
      throw new ConflictException('Student already has an active major');

    const { program, revision, curriculum, stagesByAssociation } =
      await this.admissionProgram(tx, orgId, dto.programId);
    const requestedEntry = dto.entryAcademicCycleId
      ? program.academicCycles.find(
          (association) =>
            association.academicCycleId === dto.entryAcademicCycleId,
        )
      : undefined;
    if (dto.entryAcademicCycleId && !requestedEntry) {
      throw new BadRequestException(
        'Entry academic cycle is not part of the selected program plan',
      );
    }
    if (
      dto.entryStageSequence &&
      dto.entryStageSequence > program.requiredCycleCount
    ) {
      throw new BadRequestException(
        'Entry stage sequence is outside the selected program plan',
      );
    }

    const entryAssociation =
      requestedEntry ??
      (dto.entryStageSequence
        ? program.academicCycles.find(
            (association) => association.sequence === dto.entryStageSequence,
          )
        : program.academicCycles[0]);

    return tx.studentProgramEnrollment.create({
      data: {
        organizationId: orgId,
        studentId,
        programId: program.id,
        curriculumVersionId: curriculum.id,
        programConfigurationRevisionId: revision.id,
        status: StudentProgramEnrollmentStatus.ADMITTED,
        openSlot: this.openSlot(studentId),
        requiredCycleCountSnapshot: program.requiredCycleCount,
        programConfigurationVersionSnapshot: program.configurationVersion,
        programCyclePlanSnapshotHash: revision.checksum,
        entryProgramAcademicCycleId: entryAssociation?.id,
        entryAcademicCycleId: entryAssociation?.academicCycleId,
        entryStageSequence: entryAssociation?.sequence,
        admittedById: actorId,
        cycles: {
          create: program.academicCycles.map((association) => {
            const stage = stagesByAssociation.get(association.id)!;
            return {
              organizationId: orgId,
              programAcademicCycleId: association.id,
              academicCycleId: association.academicCycleId,
              programStageId: stage.id,
              sequenceSnapshot: association.sequence,
              isRequiredSnapshot: association.isRequired,
              cycleNameSnapshot: association.academicCycle.name,
              cycleCodeSnapshot: association.academicCycle.code,
              cycleStartDateSnapshot: association.academicCycle.startDate,
              cycleEndDateSnapshot: association.academicCycle.endDate,
              stageNameSnapshot: stage.name,
              stageCodeSnapshot: stage.code,
            };
          }),
        },
      },
      include: ENROLLMENT_INCLUDE,
    });
  }

  async admit(
    orgId: string,
    studentId: string,
    dto: AdmitStudentProgramDto,
    actor: Actor,
  ) {
    const department = await this.resolveAdmissionDepartment(
      orgId,
      dto.programId,
      actor,
    );
    return runSerializableTransaction(
      this.prisma,
      async (tx) => {
        const enrollment = await this.admitInTransaction(
          tx,
          orgId,
          studentId,
          dto,
          actor.id,
        );
        await tx.student.update({
          where: { id: studentId },
          data: { primaryDepartmentId: department.id },
        });
        return enrollment;
      },
      {
        conflictMessage: 'Student already has an open program enrollment',
      },
    );
  }

  async list(orgId: string, studentId: string, actor?: Actor) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId: orgId },
      select: { id: true, primaryDepartmentId: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    assertDepartmentInScope(
      scope,
      student.primaryDepartmentId,
      'You cannot view this student program history',
    );
    return this.prisma.studentProgramEnrollment.findMany({
      where: { organizationId: orgId, studentId },
      include: ENROLLMENT_INCLUDE,
      orderBy: { admittedAt: 'desc' },
    });
  }

  async getOpen(orgId: string, studentId: string) {
    return this.prisma.studentProgramEnrollment.findFirst({
      where: {
        organizationId: orgId,
        studentId,
        status: { in: OPEN_STATUSES },
      },
      include: ENROLLMENT_INCLUDE,
    });
  }

  async transfer(
    orgId: string,
    studentId: string,
    dto: TransferStudentProgramDto,
    actor: Actor,
  ) {
    const department = await this.resolveAdmissionDepartment(
      orgId,
      dto.programId,
      actor,
    );
    return runSerializableTransaction(
      this.prisma,
      async (tx) => {
        const current = await tx.studentProgramEnrollment.findFirst({
          where: {
            organizationId: orgId,
            studentId,
            status: { in: OPEN_STATUSES },
          },
          select: { id: true, programId: true },
        });
        if (!current)
          throw new ConflictException(
            'Student does not have a current major to transfer',
          );
        if (current.programId === dto.programId)
          throw new BadRequestException(
            'Choose a different program for transfer',
          );

        const now = new Date();
        await tx.studentStageAttempt.updateMany({
          where: {
            studentProgramEnrollmentId: current.id,
            status: StudentStageAttemptStatus.IN_PROGRESS,
          },
          data: {
            status: StudentStageAttemptStatus.WITHDRAWN,
            reason: dto.reason.trim(),
            completedAt: now,
            resolvedById: actor.id,
          },
        });
        await tx.studentProgramEnrollmentCycle.updateMany({
          where: {
            studentProgramEnrollmentId: current.id,
            status: StudentProgramCycleStatus.IN_PROGRESS,
          },
          data: {
            status: StudentProgramCycleStatus.WITHDRAWN,
            reason: dto.reason.trim(),
            completedAt: now,
            resolvedById: actor.id,
          },
        });
        await tx.studentProgramEnrollment.update({
          where: { id: current.id },
          data: {
            status: StudentProgramEnrollmentStatus.TRANSFERRED_OUT,
            openSlot: null,
            endedAt: now,
            endedById: actor.id,
            exitReason: dto.reason.trim(),
          },
        });
        const next = await this.admitInTransaction(
          tx,
          orgId,
          studentId,
          dto,
          actor.id,
        );
        await tx.student.update({
          where: { id: studentId },
          data: { primaryDepartmentId: department.id },
        });
        return next;
      },
      {
        conflictMessage:
          'Student program transfer changed concurrently; refresh and try again',
      },
    );
  }

  private async ownedEnrollment(
    tx: Transaction,
    orgId: string,
    studentId: string,
    enrollmentId: string,
  ) {
    const enrollment = await tx.studentProgramEnrollment.findFirst({
      where: { id: enrollmentId, organizationId: orgId, studentId },
      include: { cycles: { orderBy: { sequenceSnapshot: 'asc' } } },
    });
    if (!enrollment)
      throw new NotFoundException('Student program enrollment not found');
    return enrollment;
  }

  async hold(
    orgId: string,
    studentId: string,
    enrollmentId: string,
    reason: string,
    actorId: string,
  ) {
    return this.runTransaction(async (tx) => {
      const enrollment = await this.ownedEnrollment(
        tx,
        orgId,
        studentId,
        enrollmentId,
      );
      if (enrollment.status !== StudentProgramEnrollmentStatus.ACTIVE) {
        throw new ConflictException(
          'Only an active program enrollment can be put on hold',
        );
      }
      return tx.studentProgramEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: StudentProgramEnrollmentStatus.ON_HOLD,
          exitReason: reason.trim(),
        },
        include: ENROLLMENT_INCLUDE,
      });
    });
  }

  async resume(
    orgId: string,
    studentId: string,
    enrollmentId: string,
    actorId: string,
  ) {
    return this.runTransaction(async (tx) => {
      const enrollment = await this.ownedEnrollment(
        tx,
        orgId,
        studentId,
        enrollmentId,
      );
      if (enrollment.status !== StudentProgramEnrollmentStatus.ON_HOLD) {
        throw new ConflictException(
          'Only an enrollment on hold can be resumed',
        );
      }
      return tx.studentProgramEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: StudentProgramEnrollmentStatus.ACTIVE,
          exitReason: null,
          startedAt: enrollment.startedAt ?? new Date(),
        },
        include: ENROLLMENT_INCLUDE,
      });
    });
  }

  async withdraw(
    orgId: string,
    studentId: string,
    enrollmentId: string,
    dto: WithdrawStudentProgramDto,
    actor: Actor,
  ) {
    if (!dto.retainPrimaryDepartment && !dto.replacementPrimaryDepartmentId) {
      throw new BadRequestException(
        'Confirm retaining the last primary department or choose a replacement department',
      );
    }
    if (dto.replacementPrimaryDepartmentId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: dto.replacementPrimaryDepartmentId,
          organizationId: orgId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!department)
        throw new NotFoundException('Replacement primary department not found');
      const scope = await getDepartmentScope(this.prisma, orgId, actor);
      assertDepartmentInScope(
        scope,
        department.id,
        'You cannot move the student outside your department scope',
      );
    }
    return this.runTransaction(async (tx) => {
      const enrollment = await this.ownedEnrollment(
        tx,
        orgId,
        studentId,
        enrollmentId,
      );
      if (!OPEN_STATUSES.includes(enrollment.status))
        throw new ConflictException('Program enrollment is already closed');
      const now = new Date();
      await tx.studentStageAttempt.updateMany({
        where: {
          studentProgramEnrollmentId: enrollment.id,
          status: {
            in: [
              StudentStageAttemptStatus.PLANNED,
              StudentStageAttemptStatus.IN_PROGRESS,
            ],
          },
        },
        data: {
          status: StudentStageAttemptStatus.WITHDRAWN,
          reason: dto.reason.trim(),
          completedAt: now,
          resolvedById: actor.id,
        },
      });
      await tx.studentProgramEnrollmentCycle.updateMany({
        where: {
          studentProgramEnrollmentId: enrollment.id,
          status: {
            in: [
              StudentProgramCycleStatus.PLANNED,
              StudentProgramCycleStatus.IN_PROGRESS,
            ],
          },
        },
        data: {
          status: StudentProgramCycleStatus.WITHDRAWN,
          reason: dto.reason.trim(),
          completedAt: now,
          resolvedById: actor.id,
        },
      });
      const closed = await tx.studentProgramEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: StudentProgramEnrollmentStatus.WITHDRAWN,
          openSlot: null,
          endedAt: now,
          endedById: actor.id,
          exitReason: dto.reason.trim(),
        },
        include: ENROLLMENT_INCLUDE,
      });
      if (dto.replacementPrimaryDepartmentId) {
        await tx.student.update({
          where: { id: studentId },
          data: { primaryDepartmentId: dto.replacementPrimaryDepartmentId },
        });
      }
      return closed;
    });
  }

  private async activateCycleInTransaction(
    tx: Transaction,
    orgId: string,
    studentId: string,
    enrollmentId: string,
    dto: ActivateProgramCycleDto,
    actorId: string,
  ) {
    const enrollment = await this.ownedEnrollment(
      tx,
      orgId,
      studentId,
      enrollmentId,
    );
    if (!OPEN_STATUSES.includes(enrollment.status))
      throw new ConflictException('Program enrollment is closed');
    if (enrollment.status === StudentProgramEnrollmentStatus.ON_HOLD)
      throw new ConflictException(
        'Resume the program enrollment before activating a cycle',
      );
    const plan = enrollment.cycles.find(
      (cycle) => cycle.id === dto.studentProgramEnrollmentCycleId,
    );
    if (!plan) throw new NotFoundException('Program cycle plan row not found');
    await assertAcademicCycleWritable(
      tx,
      orgId,
      plan.academicCycleId,
      'DELIVERY',
    );
    if (plan.status !== StudentProgramCycleStatus.PLANNED)
      throw new ConflictException('Only a planned cycle can be activated');
    if (
      enrollment.cycles.some(
        (cycle) => cycle.status === StudentProgramCycleStatus.IN_PROGRESS,
      )
    ) {
      throw new ConflictException(
        'Complete the current program cycle before activating another',
      );
    }
    const unresolvedPrior = enrollment.cycles.find(
      (cycle) =>
        cycle.sequenceSnapshot < plan.sequenceSnapshot &&
        cycle.isRequiredSnapshot &&
        cycle.status !== StudentProgramCycleStatus.COMPLETED &&
        cycle.status !== StudentProgramCycleStatus.SKIPPED,
    );
    if (unresolvedPrior)
      throw new ConflictException(
        'Resolve all earlier required program cycles first',
      );

    let cohortId = dto.cohortId;
    if (cohortId) {
      const cohort = await tx.cohort.findFirst({
        where: {
          id: cohortId,
          organizationId: orgId,
          programAcademicCycleId: plan.programAcademicCycleId,
          programStageId: plan.programStageId,
          academicCycleId: plan.academicCycleId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!cohort)
        throw new BadRequestException(
          'Cohort does not match this program cycle and stage',
        );
    } else {
      const matches = await tx.cohort.findMany({
        where: {
          organizationId: orgId,
          programAcademicCycleId: plan.programAcademicCycleId,
          programStageId: plan.programStageId,
          academicCycleId: plan.academicCycleId,
          status: 'ACTIVE',
        },
        select: { id: true },
        take: 2,
      });
      if (matches.length > 1)
        throw new ConflictException(
          'Choose a cohort because multiple compatible cohorts are available',
        );
      cohortId = matches[0]?.id;
    }

    const now = new Date();
    const attempt = await tx.studentStageAttempt.create({
      data: {
        organizationId: orgId,
        studentProgramEnrollmentId: enrollment.id,
        studentProgramEnrollmentCycleId: plan.id,
        programStageId: plan.programStageId,
        cohortId: cohortId ?? null,
        attemptNumber: 1,
        status: StudentStageAttemptStatus.IN_PROGRESS,
        reason: dto.reason?.trim(),
        startedAt: now,
      },
    });
    await tx.studentProgramEnrollmentCycle.update({
      where: { id: plan.id },
      data: {
        status: StudentProgramCycleStatus.IN_PROGRESS,
        cohortId: cohortId ?? null,
        reason: dto.reason?.trim(),
        startedAt: now,
      },
    });
    await tx.studentProgramEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: StudentProgramEnrollmentStatus.ACTIVE,
        startedAt: enrollment.startedAt ?? now,
      },
    });
    if (cohortId) {
      await tx.student.update({ where: { id: studentId }, data: { cohortId } });
    }
    return attempt;
  }

  async activateCycle(
    orgId: string,
    studentId: string,
    enrollmentId: string,
    dto: ActivateProgramCycleDto,
    actorId: string,
  ) {
    return this.runTransaction((tx) =>
      this.activateCycleInTransaction(
        tx,
        orgId,
        studentId,
        enrollmentId,
        dto,
        actorId,
      ),
    );
  }

  async ensureMappedCohortPlacement(
    tx: Transaction,
    orgId: string,
    studentId: string,
    cohort: {
      id: string;
      academicCycleId: string;
      programAcademicCycleId: string | null;
      programStageId: string | null;
    },
    actorId: string,
  ) {
    if (!cohort.programAcademicCycleId || !cohort.programStageId) {
      throw new BadRequestException(
        'Program-mapped cohort is missing its program association or stage',
      );
    }
    const enrollment = await tx.studentProgramEnrollment.findFirst({
      where: {
        organizationId: orgId,
        studentId,
        status: { in: OPEN_STATUSES },
      },
      include: { cycles: true },
    });
    if (!enrollment)
      throw new ConflictException(
        'Student must have the matching program as their major first',
      );
    const plan = enrollment.cycles.find(
      (cycle) =>
        cycle.programAcademicCycleId === cohort.programAcademicCycleId &&
        cycle.programStageId === cohort.programStageId &&
        cycle.academicCycleId === cohort.academicCycleId,
    );
    if (!plan)
      throw new ConflictException(
        'Student major does not contain this program cycle and stage',
      );

    let attempt = await tx.studentStageAttempt.findFirst({
      where: {
        studentProgramEnrollmentCycleId: plan.id,
        programStageId: cohort.programStageId,
        status: StudentStageAttemptStatus.IN_PROGRESS,
      },
      orderBy: { attemptNumber: 'desc' },
    });
    if (!attempt) {
      if (plan.status !== StudentProgramCycleStatus.PLANNED) {
        throw new ConflictException(
          'The matching student program cycle is not available for cohort placement',
        );
      }
      attempt = await this.activateCycleInTransaction(
        tx,
        orgId,
        studentId,
        enrollment.id,
        {
          studentProgramEnrollmentCycleId: plan.id,
          cohortId: cohort.id,
          reason: 'Activated by cohort placement',
        },
        actorId,
      );
    } else if (attempt.cohortId && attempt.cohortId !== cohort.id) {
      throw new ConflictException(
        'The current stage attempt is already assigned to another cohort',
      );
    } else if (!attempt.cohortId) {
      attempt = await tx.studentStageAttempt.update({
        where: { id: attempt.id },
        data: { cohortId: cohort.id },
      });
      await tx.studentProgramEnrollmentCycle.update({
        where: { id: plan.id },
        data: { cohortId: cohort.id },
      });
    }
    return { enrollment, plan, attempt };
  }

  async ensureMappedSectionEnrollment(
    tx: Transaction,
    orgId: string,
    studentId: string,
    section: {
      academicCycleId: string;
      cohort: {
        id: string;
        academicCycleId: string;
        programAcademicCycleId: string | null;
        programStageId: string | null;
      } | null;
      requirementMappings: Array<{
        programAcademicCycleId: string;
        stageCourseRequirement: { programStageId: string };
      }>;
    },
    actorId: string,
  ) {
    if (section.cohort) {
      return this.ensureMappedCohortPlacement(
        tx,
        orgId,
        studentId,
        section.cohort,
        actorId,
      );
    }
    const mapping = section.requirementMappings[0];
    if (!mapping)
      throw new ConflictException(
        'Program-mapped section has no curriculum requirement mapping',
      );
    const enrollment = await tx.studentProgramEnrollment.findFirst({
      where: {
        organizationId: orgId,
        studentId,
        status: { in: OPEN_STATUSES },
      },
      include: { cycles: true },
    });
    if (!enrollment)
      throw new ConflictException(
        'Student must have the matching program as their major first',
      );
    const plan = enrollment.cycles.find(
      (cycle) =>
        cycle.academicCycleId === section.academicCycleId &&
        cycle.programAcademicCycleId === mapping.programAcademicCycleId &&
        cycle.programStageId === mapping.stageCourseRequirement.programStageId,
    );
    if (!plan)
      throw new ConflictException(
        'Student major does not contain this section program cycle and stage',
      );
    if (plan.status !== StudentProgramCycleStatus.IN_PROGRESS) {
      throw new ConflictException(
        'Activate the matching program cycle before manual section enrollment',
      );
    }
    const attempt = await tx.studentStageAttempt.findFirst({
      where: {
        studentProgramEnrollmentCycleId: plan.id,
        programStageId: plan.programStageId,
        status: StudentStageAttemptStatus.IN_PROGRESS,
      },
      orderBy: { attemptNumber: 'desc' },
    });
    if (!attempt)
      throw new ConflictException(
        'No in-progress stage attempt exists for this section',
      );
    return { enrollment, plan, attempt };
  }

  async completeCycle(
    orgId: string,
    studentId: string,
    enrollmentId: string,
    cycleId: string,
    dto: ResolveProgramCycleDto,
    actorId: string,
  ) {
    return this.runTransaction(async (tx) => {
      const enrollment = await this.ownedEnrollment(
        tx,
        orgId,
        studentId,
        enrollmentId,
      );
      const plan = enrollment.cycles.find((cycle) => cycle.id === cycleId);
      if (!plan)
        throw new NotFoundException('Program cycle plan row not found');
      await assertAcademicCycleWritable(
        tx,
        orgId,
        plan.academicCycleId,
        'CLOSEOUT',
      );
      if (plan.status !== StudentProgramCycleStatus.IN_PROGRESS)
        throw new ConflictException(
          'Only an in-progress program cycle can be completed',
        );
      const attempt = await tx.studentStageAttempt.findFirst({
        where: {
          studentProgramEnrollmentCycleId: plan.id,
          status: StudentStageAttemptStatus.IN_PROGRESS,
        },
        orderBy: { attemptNumber: 'desc' },
      });
      if (!attempt)
        throw new ConflictException(
          'No in-progress stage attempt exists for this cycle',
        );
      const now = new Date();
      await tx.studentStageAttempt.update({
        where: { id: attempt.id },
        data: {
          status: StudentStageAttemptStatus.COMPLETED,
          reason: dto.reason.trim(),
          resultSnapshot: dto.resultSnapshot as
            | Prisma.InputJsonValue
            | undefined,
          completedAt: now,
          resolvedById: actorId,
        },
      });
      return tx.studentProgramEnrollmentCycle.update({
        where: { id: plan.id },
        data: {
          status: StudentProgramCycleStatus.COMPLETED,
          reason: dto.reason.trim(),
          resultSnapshot: dto.resultSnapshot as
            | Prisma.InputJsonValue
            | undefined,
          completedAt: now,
          resolvedById: actorId,
        },
      });
    });
  }

  async skipCycle(
    orgId: string,
    studentId: string,
    enrollmentId: string,
    cycleId: string,
    dto: ResolveProgramCycleDto,
    actorId: string,
  ) {
    return this.runTransaction(async (tx) => {
      const enrollment = await this.ownedEnrollment(
        tx,
        orgId,
        studentId,
        enrollmentId,
      );
      const plan = enrollment.cycles.find((cycle) => cycle.id === cycleId);
      if (!plan)
        throw new NotFoundException('Program cycle plan row not found');
      await assertAcademicCycleWritable(
        tx,
        orgId,
        plan.academicCycleId,
        'CLOSEOUT',
      );
      if (
        plan.status !== StudentProgramCycleStatus.PLANNED &&
        plan.status !== StudentProgramCycleStatus.FAILED
      ) {
        throw new ConflictException(
          'Only a planned or failed program cycle can be skipped',
        );
      }
      const attemptNumber =
        (await tx.studentStageAttempt.count({
          where: { studentProgramEnrollmentCycleId: plan.id },
        })) + 1;
      const now = new Date();
      await tx.studentStageAttempt.create({
        data: {
          organizationId: orgId,
          studentProgramEnrollmentId: enrollment.id,
          studentProgramEnrollmentCycleId: plan.id,
          programStageId: plan.programStageId,
          cohortId: plan.cohortId,
          attemptNumber,
          status: StudentStageAttemptStatus.SKIPPED,
          reason: dto.reason.trim(),
          resultSnapshot: dto.resultSnapshot as
            | Prisma.InputJsonValue
            | undefined,
          completedAt: now,
          resolvedById: actorId,
        },
      });
      return tx.studentProgramEnrollmentCycle.update({
        where: { id: plan.id },
        data: {
          status: StudentProgramCycleStatus.SKIPPED,
          reason: dto.reason.trim(),
          resultSnapshot: dto.resultSnapshot as
            | Prisma.InputJsonValue
            | undefined,
          completedAt: now,
          resolvedById: actorId,
        },
      });
    });
  }

  async repeatCycle(
    orgId: string,
    studentId: string,
    enrollmentId: string,
    cycleId: string,
    dto: RepeatProgramCycleDto,
    actorId: string,
  ) {
    return this.runTransaction(async (tx) => {
      const enrollment = await this.ownedEnrollment(
        tx,
        orgId,
        studentId,
        enrollmentId,
      );
      const plan = enrollment.cycles.find((cycle) => cycle.id === cycleId);
      if (!plan)
        throw new NotFoundException('Program cycle plan row not found');
      await assertAcademicCycleWritable(
        tx,
        orgId,
        plan.academicCycleId,
        'DELIVERY',
      );
      if (
        plan.status !== StudentProgramCycleStatus.FAILED &&
        plan.status !== StudentProgramCycleStatus.COMPLETED
      ) {
        throw new ConflictException(
          'Only a failed or completed cycle can be repeated',
        );
      }
      if (
        enrollment.cycles.some(
          (cycle) =>
            cycle.id !== plan.id &&
            cycle.status === StudentProgramCycleStatus.IN_PROGRESS,
        )
      ) {
        throw new ConflictException(
          'Resolve the current in-progress cycle before repeating another',
        );
      }
      if (dto.cohortId) {
        const cohort = await tx.cohort.findFirst({
          where: {
            id: dto.cohortId,
            organizationId: orgId,
            programAcademicCycleId: plan.programAcademicCycleId,
            programStageId: plan.programStageId,
            academicCycleId: plan.academicCycleId,
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        if (!cohort)
          throw new BadRequestException(
            'Cohort does not match this program cycle and stage',
          );
      }
      const attemptNumber =
        (await tx.studentStageAttempt.count({
          where: { studentProgramEnrollmentCycleId: plan.id },
        })) + 1;
      const now = new Date();
      const attempt = await tx.studentStageAttempt.create({
        data: {
          organizationId: orgId,
          studentProgramEnrollmentId: enrollment.id,
          studentProgramEnrollmentCycleId: plan.id,
          programStageId: plan.programStageId,
          cohortId: dto.cohortId ?? plan.cohortId,
          attemptNumber,
          status: StudentStageAttemptStatus.IN_PROGRESS,
          reason: dto.reason.trim(),
          startedAt: now,
        },
      });
      await tx.studentProgramEnrollmentCycle.update({
        where: { id: plan.id },
        data: {
          status: StudentProgramCycleStatus.IN_PROGRESS,
          cohortId: dto.cohortId ?? plan.cohortId,
          reason: dto.reason.trim(),
          startedAt: now,
          completedAt: null,
          resolvedById: null,
        },
      });
      return attempt;
    });
  }

  async completeProgram(
    orgId: string,
    studentId: string,
    enrollmentId: string,
    dto: ResolveProgramCycleDto,
    actorId: string,
  ) {
    return this.runTransaction(async (tx) => {
      const enrollment = await this.ownedEnrollment(
        tx,
        orgId,
        studentId,
        enrollmentId,
      );
      if (!OPEN_STATUSES.includes(enrollment.status))
        throw new ConflictException('Program enrollment is already closed');
      const completedRequired = enrollment.cycles.filter(
        (cycle) =>
          cycle.isRequiredSnapshot &&
          (cycle.status === StudentProgramCycleStatus.COMPLETED ||
            cycle.status === StudentProgramCycleStatus.SKIPPED),
      ).length;
      if (completedRequired < enrollment.requiredCycleCountSnapshot) {
        throw new ConflictException(
          `Complete all ${enrollment.requiredCycleCountSnapshot} required program cycles first`,
        );
      }
      const now = new Date();
      return tx.studentProgramEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: StudentProgramEnrollmentStatus.COMPLETED,
          openSlot: null,
          endedAt: now,
          endedById: actorId,
          exitReason: dto.reason.trim(),
          metadata: {
            completionResult: dto.resultSnapshot ?? null,
          } as Prisma.InputJsonValue,
        },
        include: ENROLLMENT_INCLUDE,
      });
    });
  }
}
