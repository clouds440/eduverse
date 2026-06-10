import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialStructureDto, UpdateFinancialStructureDto, CreateManualEntryDto, MarkPaidDto, ConfirmEntryDto } from './finance.dto';
import {
  BillingCycle,
  EntrySource,
  EntryStatus,
  FinanceAssignmentSource,
  FinanceCategory,
  FinanceTargetType,
  PaymentClaimStatus,
  Prisma,
  TransactionType,
} from '@prisma/client';
import { Role } from '../common/enums';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

type FinanceFilters = {
  studentId?: string;
  teacherId?: string;
  targetType?: FinanceTargetType;
  category?: FinanceCategory;
  billingCycle?: BillingCycle;
  assignmentSource?: FinanceAssignmentSource;
  status?: EntryStatus;
  isActive?: string;
  type?: TransactionType;
  paymentMethod?: string;
  search?: string;
  dueFrom?: string;
  dueTo?: string;
  dateFrom?: string;
  dateTo?: string;
};

type AssignmentSeed = {
  targetType: FinanceTargetType;
  studentId?: string;
  teacherId?: string;
  entityName?: string;
  sourceType: FinanceAssignmentSource;
  sourceId?: string;
};

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createStructure(dto: CreateFinancialStructureDto, user: AuthenticatedRequest['user']) {
    const orgId = dto.organizationId || user.organizationId;
    if (!orgId) throw new BadRequestException('Organization is required');
    if (user.role !== Role.SUPER_ADMIN && orgId !== user.organizationId) {
      throw new ForbiddenException('Cannot create structures for a different organization');
    }

    const targetType = dto.targetType || (dto.teacherId ? FinanceTargetType.TEACHER : FinanceTargetType.STUDENT);

    return this.prisma.$transaction(async (tx) => {
      const structure = await tx.financialStructure.create({
        data: {
          organizationId: orgId,
          title: dto.title,
          description: dto.description,
          targetType,
          studentId: dto.studentId,
          teacherId: dto.teacherId,
          category: dto.category,
          amount: dto.amount,
          currency: dto.currency || 'USD',
          billingCycle: dto.billingCycle,
          dueDay: dto.dueDay,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          metadata: dto.metadata,
        },
      });

      const assignments = await this.resolveAssignmentSeeds(tx, orgId, targetType, dto);
      if (assignments.length === 0) {
        throw new BadRequestException('Choose at least one target for this structure');
      }

      await tx.financialStructureAssignment.createMany({
        data: assignments.map((assignment) => ({
          organizationId: orgId,
          structureId: structure.id,
          targetType: assignment.targetType,
          studentId: assignment.studentId,
          teacherId: assignment.teacherId,
          entityName: assignment.entityName,
          sourceType: assignment.sourceType,
          sourceId: assignment.sourceId,
        })),
        skipDuplicates: true,
      });

      return tx.financialStructure.findUnique({
        where: { id: structure.id },
        include: this.structureInclude(),
      });
    });
  }

  async updateStructure(id: string, dto: UpdateFinancialStructureDto, user: AuthenticatedRequest['user']) {
    const structure = await this.prisma.financialStructure.findUnique({ where: { id } });
    if (!structure) throw new NotFoundException('Structure not found');

    if (user.role !== Role.SUPER_ADMIN && structure.organizationId !== user.organizationId) {
      throw new ForbiddenException('Cannot update structures for a different organization');
    }

    return this.prisma.financialStructure.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        amount: dto.amount,
        isActive: dto.isActive,
        category: dto.category,
        billingCycle: dto.billingCycle,
        dueDay: dto.dueDay,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : dto.endDate === null ? null : undefined,
        metadata: dto.metadata,
      },
      include: this.structureInclude(),
    });
  }

  async getStructures(orgId: string | undefined, user: AuthenticatedRequest['user'], filters: FinanceFilters = {}) {
    const finalOrgId = this.getReadableOrgId(orgId, user, 'structures');
    const scopedFilters = await this.applyRoleScope(user, filters);

    return this.prisma.financialStructure.findMany({
      where: {
        organizationId: finalOrgId,
        AND: [
          ...(scopedFilters.studentId ? [{ assignments: { some: { studentId: scopedFilters.studentId } } }] : []),
          ...(scopedFilters.teacherId ? [{ assignments: { some: { teacherId: scopedFilters.teacherId } } }] : []),
          ...(scopedFilters.assignmentSource ? [{ assignments: { some: { sourceType: scopedFilters.assignmentSource } } }] : []),
        ],
        ...(scopedFilters.targetType ? { targetType: scopedFilters.targetType } : {}),
        ...(scopedFilters.category ? { category: scopedFilters.category } : {}),
        ...(scopedFilters.billingCycle ? { billingCycle: scopedFilters.billingCycle } : {}),
        ...(scopedFilters.isActive ? { isActive: scopedFilters.isActive === 'true' } : {}),
        ...(scopedFilters.search ? this.structureSearch(scopedFilters.search) : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: this.structureInclude(),
    });
  }

  async getEntries(orgId: string | undefined, user: AuthenticatedRequest['user'], filters: FinanceFilters = {}) {
    const finalOrgId = this.getReadableOrgId(orgId, user, 'entries');
    const scopedFilters = await this.applyRoleScope(user, filters);

    return this.prisma.financialEntry.findMany({
      where: {
        organizationId: finalOrgId,
        AND: [
          ...(scopedFilters.category ? [{ structure: { category: scopedFilters.category } }] : []),
          ...(scopedFilters.billingCycle ? [{ structure: { billingCycle: scopedFilters.billingCycle } }] : []),
          ...(scopedFilters.search ? [this.entrySearch(scopedFilters.search)] : []),
        ],
        ...(scopedFilters.studentId ? { studentId: scopedFilters.studentId } : {}),
        ...(scopedFilters.teacherId ? { teacherId: scopedFilters.teacherId } : {}),
        ...(scopedFilters.status ? { status: scopedFilters.status } : {}),
        ...(scopedFilters.targetType ? { assignment: { targetType: scopedFilters.targetType } } : {}),
        ...(scopedFilters.dueFrom || scopedFilters.dueTo ? {
          dueDate: {
            ...(scopedFilters.dueFrom ? { gte: new Date(scopedFilters.dueFrom) } : {}),
            ...(scopedFilters.dueTo ? { lte: new Date(scopedFilters.dueTo) } : {}),
          },
        } : {}),
      },
      orderBy: { dueDate: 'desc' },
      include: this.entryInclude(),
    });
  }

  async getTransactions(orgId: string | undefined, user: AuthenticatedRequest['user'], filters: FinanceFilters = {}) {
    const finalOrgId = this.getReadableOrgId(orgId, user, 'transactions');
    const scopedFilters = await this.applyRoleScope(user, filters);

    return this.prisma.transaction.findMany({
      where: {
        organizationId: finalOrgId,
        AND: [
          ...(scopedFilters.studentId || scopedFilters.teacherId || scopedFilters.targetType || scopedFilters.billingCycle || scopedFilters.search ? [{
            relatedEntry: {
              AND: [
                ...(scopedFilters.billingCycle ? [{ structure: { billingCycle: scopedFilters.billingCycle } }] : []),
                ...(scopedFilters.search ? [this.entrySearch(scopedFilters.search)] : []),
              ],
              ...(scopedFilters.studentId ? { studentId: scopedFilters.studentId } : {}),
              ...(scopedFilters.teacherId ? { teacherId: scopedFilters.teacherId } : {}),
              ...(scopedFilters.targetType ? { assignment: { targetType: scopedFilters.targetType } } : {}),
            },
          }] : []),
        ],
        ...(scopedFilters.type ? { type: scopedFilters.type } : {}),
        ...(scopedFilters.category ? { category: scopedFilters.category } : {}),
        ...(scopedFilters.paymentMethod ? { paymentMethod: scopedFilters.paymentMethod } : {}),
        ...(scopedFilters.dateFrom || scopedFilters.dateTo ? {
          createdAt: {
            ...(scopedFilters.dateFrom ? { gte: new Date(scopedFilters.dateFrom) } : {}),
            ...(scopedFilters.dateTo ? { lte: new Date(scopedFilters.dateTo) } : {}),
          },
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        relatedEntry: { include: this.entryInclude() },
      },
    });
  }

  async getStats(orgId: string | undefined, user: AuthenticatedRequest['user']) {
    const finalOrgId = this.getReadableOrgId(orgId, user, 'stats');
    const scopedFilters = await this.applyRoleScope(user, {});

    const entries = await this.prisma.financialEntry.findMany({
      where: {
        organizationId: finalOrgId,
        ...(scopedFilters.studentId ? { studentId: scopedFilters.studentId } : {}),
        ...(scopedFilters.teacherId ? { teacherId: scopedFilters.teacherId } : {}),
      },
      select: { amount: true, paidAmount: true, status: true, dueDate: true, studentId: true, teacherId: true, assignment: { select: { targetType: true } } },
    });

    const now = new Date();
    let totalExpectedIncome = 0;
    let totalCollectedIncome = 0;
    let overdueAmount = 0;
    let pendingConfirmations = 0;
    let totalSalaryExpenses = 0;

    for (const entry of entries) {
      const type = this.transactionTypeForEntry(entry);
      if (type === TransactionType.INCOME) {
        totalExpectedIncome += entry.amount;
        totalCollectedIncome += entry.paidAmount;
        if ((entry.status === EntryStatus.PENDING || entry.status === EntryStatus.PARTIAL) && entry.dueDate < now) {
          overdueAmount += entry.amount - entry.paidAmount;
        }
        if (entry.status === EntryStatus.UNVERIFIED) pendingConfirmations++;
      } else {
        totalSalaryExpenses += entry.amount;
      }
    }

    const recentTransactions = await this.getTransactions(orgId, user, {});

    return {
      totalExpectedIncome,
      totalCollectedIncome,
      overdueAmount,
      totalSalaryExpenses,
      pendingConfirmations,
      recentTransactions: recentTransactions.slice(0, 5),
    };
  }

  async createManualEntry(dto: CreateManualEntryDto, user: AuthenticatedRequest['user']) {
    const orgId = dto.organizationId || user.organizationId;
    if (!orgId) throw new BadRequestException('Organization is required');
    if (user.role !== Role.SUPER_ADMIN && orgId !== user.organizationId) {
      throw new ForbiddenException('Cannot create entries for a different organization');
    }
    if (!dto.studentId && !dto.teacherId) {
      throw new BadRequestException('Must provide either studentId or teacherId');
    }
    return this.prisma.financialEntry.create({
      data: {
        organizationId: orgId,
        title: dto.title,
        studentId: dto.studentId,
        teacherId: dto.teacherId,
        amount: dto.amount,
        dueDate: new Date(dto.dueDate),
        periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
        metadata: dto.metadata,
        source: EntrySource.MANUAL,
        status: EntryStatus.PENDING,
      },
      include: this.entryInclude(),
    });
  }

  async markEntryPaid(id: string, user: AuthenticatedRequest['user'], dto: MarkPaidDto) {
    const entry = await this.prisma.financialEntry.findUnique({ where: { id }, include: this.entryInclude() });
    if (!entry) throw new NotFoundException('Entry not found');
    await this.assertCanAccessEntry(entry, user, 'mark');

    if (entry.status === EntryStatus.PAID || entry.paidAmount >= entry.amount) {
      throw new ConflictException('This entry is already fully paid.');
    }

    const balance = entry.amount - entry.paidAmount;
    const claimedAmount = dto.claimedAmount ?? balance;
    if (claimedAmount <= 0 || claimedAmount > balance) {
      throw new BadRequestException('Claimed amount must be greater than zero and no more than the remaining balance.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.paymentClaim.create({
        data: {
          organizationId: entry.organizationId,
          entryId: entry.id,
          claimedAmount,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber,
          receiptUrl: dto.receiptUrl,
          note: dto.note,
          claimedById: user.id,
        },
      });

      return tx.financialEntry.update({
        where: { id },
        data: {
          status: EntryStatus.UNVERIFIED,
          markedByUser: true,
          markedAt: new Date(),
          paymentMethod: dto.paymentMethod,
          receiptUrl: dto.receiptUrl || dto.referenceNumber,
        },
        include: this.entryInclude(),
      });
    });
  }

  async confirmEntry(id: string, user: AuthenticatedRequest['user'], dto: ConfirmEntryDto) {
    const entry = await this.prisma.financialEntry.findUnique({ where: { id }, include: this.entryInclude() });
    if (!entry) throw new NotFoundException('Entry not found');

    if (user.role !== Role.SUPER_ADMIN && entry.organizationId !== user.organizationId) {
      throw new ForbiddenException('Cannot confirm entries of a different organization');
    }

    return this.prisma.$transaction(async (tx) => {
      const lockedEntry = await tx.financialEntry.findUnique({
        where: { id },
        include: {
          structure: true,
          assignment: true,
          claims: { where: { status: PaymentClaimStatus.PENDING }, orderBy: { claimedAt: 'desc' }, take: 1 },
        },
      });

      if (!lockedEntry) throw new NotFoundException('Entry not found');
      if (lockedEntry.status === EntryStatus.PAID || lockedEntry.paidAmount >= lockedEntry.amount) {
        throw new ConflictException('This entry is already fully paid.');
      }

      const claim = dto.claimId
        ? await tx.paymentClaim.findFirst({ where: { id: dto.claimId, entryId: id } })
        : lockedEntry.claims[0] || null;

      const balance = lockedEntry.amount - lockedEntry.paidAmount;
      const amountPaid = dto.paidAmount ?? claim?.claimedAmount ?? balance;
      if (amountPaid <= 0) throw new BadRequestException('Amount paid must be greater than zero.');
      if (amountPaid > balance) throw new BadRequestException('Amount paid cannot exceed remaining balance.');

      const newPaidAmount = lockedEntry.paidAmount + amountPaid;
      const newStatus = newPaidAmount < lockedEntry.amount ? EntryStatus.PARTIAL : EntryStatus.PAID;
      const type = this.transactionTypeForEntry(lockedEntry);
      const category = lockedEntry.structure?.category || FinanceCategory.OTHER;

      const updatedEntry = await tx.financialEntry.update({
        where: { id },
        data: {
          status: newStatus,
          paidAmount: { increment: amountPaid },
          confirmedByAdmin: true,
          confirmedAt: new Date(),
          confirmedById: user.id,
        },
        include: this.entryInclude(),
      });

      if (claim) {
        await tx.paymentClaim.update({
          where: { id: claim.id },
          data: {
            status: PaymentClaimStatus.CONFIRMED,
            reviewedById: user.id,
            reviewedAt: new Date(),
            confirmedAmount: amountPaid,
          },
        });
      }

      const transaction = await tx.transaction.create({
        data: {
          organizationId: lockedEntry.organizationId,
          type,
          category,
          amount: amountPaid,
          currency: lockedEntry.structure?.currency || 'USD',
          description: `Confirmed payment for ${lockedEntry.title}`,
          relatedEntryId: lockedEntry.id,
          paymentMethod: claim?.paymentMethod || lockedEntry.paymentMethod,
          referenceNumber: claim?.referenceNumber,
          createdById: user.id,
        },
      });

      return { entry: updatedEntry, transaction };
    });
  }

  async rejectPaymentClaim(id: string, user: AuthenticatedRequest['user'], rejectionReason?: string) {
    const claim = await this.prisma.paymentClaim.findUnique({ where: { id }, include: { entry: true } });
    if (!claim) throw new NotFoundException('Payment claim not found');
    if (user.role !== Role.SUPER_ADMIN && claim.organizationId !== user.organizationId) {
      throw new ForbiddenException('Cannot reject claims for a different organization');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedClaim = await tx.paymentClaim.update({
        where: { id },
        data: {
          status: PaymentClaimStatus.REJECTED,
          reviewedById: user.id,
          reviewedAt: new Date(),
          rejectionReason,
        },
      });

      const pendingCount = await tx.paymentClaim.count({
        where: { entryId: claim.entryId, status: PaymentClaimStatus.PENDING, id: { not: id } },
      });

      if (pendingCount === 0 && claim.entry.status === EntryStatus.UNVERIFIED) {
        await tx.financialEntry.update({
          where: { id: claim.entryId },
          data: { status: claim.entry.paidAmount > 0 ? EntryStatus.PARTIAL : EntryStatus.PENDING },
        });
      }

      return updatedClaim;
    });
  }

  private async resolveAssignmentSeeds(
    tx: Prisma.TransactionClient,
    orgId: string,
    targetType: FinanceTargetType,
    dto: CreateFinancialStructureDto,
  ): Promise<AssignmentSeed[]> {
    const seeds = new Map<string, AssignmentSeed>();
    const add = (seed: AssignmentSeed) => {
      const key = seed.studentId || seed.teacherId || `${seed.targetType}:${seed.entityName}`;
      if (key && !seeds.has(key)) seeds.set(key, seed);
    };

    if (targetType === FinanceTargetType.STUDENT) {
      for (const studentId of [...(dto.studentIds || []), ...(dto.studentId ? [dto.studentId] : [])]) {
        add({ targetType, studentId, sourceType: FinanceAssignmentSource.MANUAL });
      }

      if (dto.sectionIds?.length) {
        const enrollments = await tx.enrollment.findMany({
          where: { sectionId: { in: dto.sectionIds }, section: { course: { organizationId: orgId } } },
          select: { studentId: true, sectionId: true },
        });
        enrollments.forEach((enrollment) => add({ targetType, studentId: enrollment.studentId, sourceType: FinanceAssignmentSource.SECTION, sourceId: enrollment.sectionId }));
      }

      if (dto.cohortIds?.length) {
        const students = await tx.student.findMany({
          where: { organizationId: orgId, cohortId: { in: dto.cohortIds } },
          select: { id: true, cohortId: true },
        });
        students.forEach((student) => add({ targetType, studentId: student.id, sourceType: FinanceAssignmentSource.COHORT, sourceId: student.cohortId || undefined }));
      }

      if (dto.courseIds?.length) {
        const enrollments = await tx.enrollment.findMany({
          where: { section: { courseId: { in: dto.courseIds }, course: { organizationId: orgId } } },
          select: { studentId: true, section: { select: { courseId: true } } },
        });
        enrollments.forEach((enrollment) => add({ targetType, studentId: enrollment.studentId, sourceType: FinanceAssignmentSource.COURSE, sourceId: enrollment.section.courseId }));
      }
    } else if (targetType === FinanceTargetType.TEACHER) {
      for (const teacherId of [...(dto.teacherIds || []), ...(dto.teacherId ? [dto.teacherId] : [])]) {
        add({ targetType, teacherId, sourceType: FinanceAssignmentSource.MANUAL });
      }

      if (dto.sectionIds?.length) {
        const sections = await tx.section.findMany({
          where: { id: { in: dto.sectionIds }, course: { organizationId: orgId } },
          select: { id: true, teachers: { select: { id: true } } },
        });
        sections.forEach((section) => section.teachers.forEach((teacher) => add({ targetType, teacherId: teacher.id, sourceType: FinanceAssignmentSource.SECTION, sourceId: section.id })));
      }

      if (dto.courseIds?.length) {
        const sections = await tx.section.findMany({
          where: { courseId: { in: dto.courseIds }, course: { organizationId: orgId } },
          select: { courseId: true, teachers: { select: { id: true } } },
        });
        sections.forEach((section) => section.teachers.forEach((teacher) => add({ targetType, teacherId: teacher.id, sourceType: FinanceAssignmentSource.COURSE, sourceId: section.courseId })));
      }
    } else {
      if (!dto.entityName?.trim()) {
        throw new BadRequestException('Entity name is required for other income or expense structures');
      }
      add({ targetType, entityName: dto.entityName.trim(), sourceType: FinanceAssignmentSource.OTHER });
    }

    return [...seeds.values()];
  }

  private async applyRoleScope(user: AuthenticatedRequest['user'], filters: FinanceFilters): Promise<FinanceFilters> {
    if (user.role === Role.STUDENT) {
      const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
      if (!student) throw new NotFoundException('Student profile not found');
      return { ...filters, studentId: student.id, teacherId: undefined };
    }
    if (user.role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher) throw new NotFoundException('Teacher profile not found');
      return { ...filters, teacherId: teacher.id, studentId: undefined };
    }
    return filters;
  }

  private getReadableOrgId(orgId: string | undefined, user: AuthenticatedRequest['user'], resource: string) {
    const finalOrgId = orgId || user.organizationId;
    if (!finalOrgId) throw new BadRequestException('Organization is required');
    if (user.role !== Role.SUPER_ADMIN && finalOrgId !== user.organizationId) {
      throw new ForbiddenException(`Cannot view ${resource} of a different organization`);
    }
    return finalOrgId;
  }

  private async assertCanAccessEntry(entry: { studentId: string | null; teacherId: string | null; organizationId: string }, user: AuthenticatedRequest['user'], action: string) {
    if (user.role === Role.STUDENT) {
      const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
      if (!student || entry.studentId !== student.id) throw new ForbiddenException(`You can only ${action} your own entries`);
    } else if (user.role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher || entry.teacherId !== teacher.id) throw new ForbiddenException(`You can only ${action} your own entries`);
    } else if (user.role !== Role.SUPER_ADMIN && entry.organizationId !== user.organizationId) {
      throw new ForbiddenException('Cannot modify entries of a different organization');
    }
  }

  private transactionTypeForEntry(entry: { studentId?: string | null; teacherId?: string | null; assignment?: { targetType: FinanceTargetType } | null }) {
    const targetType = entry.assignment?.targetType;
    if (targetType === FinanceTargetType.TEACHER || targetType === FinanceTargetType.OTHER_EXPENSE || entry.teacherId) {
      return TransactionType.EXPENSE;
    }
    return TransactionType.INCOME;
  }

  private structureSearch(search: string): Prisma.FinancialStructureWhereInput {
    return {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { assignments: { some: { entityName: { contains: search, mode: 'insensitive' } } } },
        { assignments: { some: { student: { user: { name: { contains: search, mode: 'insensitive' } } } } } },
        { assignments: { some: { teacher: { user: { name: { contains: search, mode: 'insensitive' } } } } } },
      ],
    };
  }

  private entrySearch(search: string): Prisma.FinancialEntryWhereInput {
    return {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { structure: { title: { contains: search, mode: 'insensitive' } } },
        { assignment: { entityName: { contains: search, mode: 'insensitive' } } },
        { student: { user: { name: { contains: search, mode: 'insensitive' } } } },
        { student: { user: { email: { contains: search, mode: 'insensitive' } } } },
        { teacher: { user: { name: { contains: search, mode: 'insensitive' } } } },
        { teacher: { user: { email: { contains: search, mode: 'insensitive' } } } },
      ],
    };
  }

  private structureInclude() {
    return {
      assignments: {
        include: {
          student: { include: { user: { select: { id: true, name: true, email: true } }, cohort: true } },
          teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
      _count: { select: { assignments: true, entries: true } },
    } satisfies Prisma.FinancialStructureInclude;
  }

  private entryInclude() {
    return {
      structure: { include: { _count: { select: { assignments: true } } } },
      assignment: {
        include: {
          student: { include: { user: { select: { id: true, name: true, email: true } }, cohort: true } },
          teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
      student: { include: { user: { select: { id: true, name: true, email: true } }, cohort: true } },
      teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
      claims: {
        orderBy: { claimedAt: 'desc' },
        include: {
          claimedBy: { select: { id: true, name: true, email: true, role: true } },
          reviewedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      },
      transactions: { orderBy: { createdAt: 'desc' } },
    } satisfies Prisma.FinancialEntryInclude;
  }
}
