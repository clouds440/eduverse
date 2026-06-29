import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConfirmEntryDto,
  CreateFinancialStructureDto,
  CreateManualEntryDto,
  MarkPaidDto,
  StructureEntryUpdateScope,
  UpdateFinancialStructureDto,
} from './finance.dto';
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
} from '@/prisma/prisma-client';
import { Role } from '../common/enums';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { formatPaginatedResponse } from '../common/utils';

type FinanceFilters = {
  studentId?: string;
  teacherId?: string;
  employeeUserId?: string;
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
  page?: number;
  limit?: number;
};

type AuditFilters = {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  userId?: string;
};

type AssignmentSeed = {
  targetType: FinanceTargetType;
  studentId?: string;
  teacherId?: string;
  employeeUserId?: string;
  entityName?: string;
  sourceType: FinanceAssignmentSource;
  sourceId?: string;
};

type AuditContext = Pick<AuthenticatedRequest, 'ip' | 'headers'> & {
  user: AuthenticatedRequest['user'];
};

const MONEY_REGEX = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
const OUTSTANDING_STATUSES = [EntryStatus.PENDING, EntryStatus.PARTIAL, EntryStatus.OVERDUE, EntryStatus.UNVERIFIED];
const STAFF_TARGETS = [FinanceTargetType.SUB_ADMIN, FinanceTargetType.FINANCE_MANAGER];
const EXPENSE_TARGETS = [FinanceTargetType.TEACHER, FinanceTargetType.SUB_ADMIN, FinanceTargetType.FINANCE_MANAGER, FinanceTargetType.OTHER_EXPENSE];

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createStructure(dto: CreateFinancialStructureDto, reqUser: AuthenticatedRequest['user'], audit?: AuditContext) {
    const orgId = dto.organizationId || reqUser.organizationId;
    if (!orgId) throw new BadRequestException('Organization is required');
    this.assertWritableOrg(orgId, reqUser, 'create structures');

    const targetType = await this.resolveTargetType(orgId, dto);
    const amount = this.parseMoney(dto.amount, 'amount', { allowZero: false });
    const { startDate, endDate } = this.validateDateRange(dto.startDate, dto.endDate);
    this.validateDueDay(dto.billingCycle, dto.dueDay);
    this.validateText(dto.title, 'title', 160);
    this.validateText(dto.description, 'description', 1000, true);
    this.validateMetadata(dto.metadata);

    return this.prisma.$transaction(async (tx) => {
      await this.validateDirectTargets(tx, orgId, targetType, dto);
      const organization = await tx.organization.findUnique({ where: { id: orgId }, select: { currency: true } });
      const structure = await tx.financialStructure.create({
        data: {
          organizationId: orgId,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          targetType,
          studentId: dto.studentId,
          teacherId: dto.teacherId,
          employeeUserId: dto.employeeUserId,
          category: dto.category,
          amount,
          currency: dto.currency || organization?.currency || 'USD',
          billingCycle: dto.billingCycle,
          dueDay: dto.billingCycle === BillingCycle.ONCE ? null : dto.dueDay ?? 5,
          startDate: startDate!,
          endDate,
          metadata: dto.metadata,
        },
      });

      const assignments = await this.resolveAssignmentSeeds(tx, orgId, targetType, dto);
      if (assignments.length === 0) throw new BadRequestException('Choose at least one target for this structure');

      await tx.financialStructureAssignment.createMany({
        data: assignments.map((assignment) => ({
          organizationId: orgId,
          structureId: structure.id,
          targetType: assignment.targetType,
          studentId: assignment.studentId,
          teacherId: assignment.teacherId,
          employeeUserId: assignment.employeeUserId,
          entityName: assignment.entityName,
          sourceType: assignment.sourceType,
          sourceId: assignment.sourceId,
        })),
        skipDuplicates: true,
      });

      await this.writeFinanceAudit(tx, 'finance_structure_created', {
        audit,
        organizationId: orgId,
        financeStructureId: structure.id,
        resourceType: 'structure',
        resourceId: structure.id,
        details: {
          title: structure.title,
          targetType,
          amount: this.moneyToString(amount),
          assignmentCount: assignments.length,
        },
      });

      return this.serialize(await tx.financialStructure.findUnique({
        where: { id: structure.id },
        include: this.structureInclude(),
      }));
    });
  }

  async updateStructure(id: string, dto: UpdateFinancialStructureDto, reqUser: AuthenticatedRequest['user'], audit?: AuditContext) {
    const existing = await this.prisma.financialStructure.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Structure not found');
    this.assertWritableOrg(existing.organizationId, reqUser, 'update structures');

    const amount = dto.amount !== undefined ? this.parseMoney(dto.amount, 'amount', { allowZero: false }) : undefined;
    const { startDate, endDate } = this.validateDateRange(dto.startDate, dto.endDate, true);
    if (dto.dueDay !== undefined || dto.billingCycle !== undefined) {
      this.validateDueDay(dto.billingCycle || existing.billingCycle, dto.dueDay ?? existing.dueDay);
    }
    if (dto.title !== undefined) this.validateText(dto.title, 'title', 160);
    if (dto.description !== undefined) this.validateText(dto.description, 'description', 1000, true);
    this.validateMetadata(dto.metadata);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.financialStructure.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
          amount,
          isActive: dto.isActive,
          category: dto.category,
          billingCycle: dto.billingCycle,
          dueDay: dto.billingCycle === BillingCycle.ONCE ? null : dto.dueDay,
          startDate,
          endDate,
          metadata: dto.metadata,
        },
        include: this.structureInclude(),
      });

      const entryUpdateSummary = dto.applyToExistingEntries
        ? await this.applyStructureUpdateToEntries(tx, updated, amount, audit)
        : { updated: 0, skipped: 0, skippedEntryIds: [] };

      await this.writeFinanceAudit(tx, 'finance_structure_updated', {
        audit,
        organizationId: existing.organizationId,
        financeStructureId: id,
        resourceType: 'structure',
        resourceId: id,
        details: {
          before: this.serialize(existing),
          after: this.serialize(updated),
          applyToExistingEntries: Boolean(dto.applyToExistingEntries),
          entryUpdateScope: dto.entryUpdateScope || StructureEntryUpdateScope.OUTSTANDING,
          entryUpdateSummary,
        },
      });

      return this.serialize({ structure: updated, entryUpdateSummary });
    });
  }

  async generateEntriesForStructure(id: string, user: AuthenticatedRequest['user'], audit?: AuditContext) {
    const structure = await this.prisma.financialStructure.findUnique({ where: { id } });
    if (!structure) throw new NotFoundException('Structure not found');
    this.assertWritableOrg(structure.organizationId, user, 'generate structure entries');
    if (!structure.isActive) throw new ConflictException('Only active structures can generate entries.');

    const targetDate = new Date() < structure.startDate ? structure.startDate : new Date();
    const period = this.getPeriodForTargetDate(structure.billingCycle, structure.startDate, structure.endDate, targetDate);
    if (!period) throw new BadRequestException('This structure is not active for the selected period.');
    const dueDate = this.getDueDate(structure.billingCycle, period.periodStart, structure.dueDay);

    return this.prisma.$transaction(async (tx) => {
      const freshStructure = await tx.financialStructure.findUnique({
        where: { id },
        include: {
          assignments: {
            where: { isActive: true },
            include: {
              student: { include: { user: { select: { id: true, name: true, email: true } } } },
              teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
              employeeUser: { select: { id: true, name: true, email: true, role: true } },
            },
          },
        },
      });
      if (!freshStructure) throw new NotFoundException('Structure not found');
      if (freshStructure.assignments.length === 0) throw new BadRequestException('This structure has no active assignments.');

      const createdEntries: unknown[] = [];
      const skippedAssignmentIds: string[] = [];

      for (const assignment of freshStructure.assignments) {
        const existingEntry = await tx.financialEntry.findFirst({
          where: {
            assignmentId: assignment.id,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
          },
        });

        if (existingEntry) {
          skippedAssignmentIds.push(assignment.id);
          continue;
        }

        const entry = await tx.financialEntry.create({
          data: {
            organizationId: freshStructure.organizationId,
            structureId: freshStructure.id,
            assignmentId: assignment.id,
            title: `${freshStructure.title} - ${this.formatPeriodLabel(period.periodStart, freshStructure.billingCycle)}`,
            studentId: assignment.studentId,
            teacherId: assignment.teacherId,
            employeeUserId: assignment.employeeUserId,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            dueDate,
            amount: freshStructure.amount,
            source: EntrySource.MANUAL,
            status: EntryStatus.PENDING,
          },
          include: this.entryInclude(),
        });
        createdEntries.push(entry);

        await this.writeFinanceAudit(tx, 'finance_entry_generated_now', {
          audit,
          organizationId: freshStructure.organizationId,
          financeStructureId: freshStructure.id,
          financeEntryId: entry.id,
          resourceType: 'entry',
          resourceId: entry.id,
          details: {
            structureTitle: freshStructure.title,
            targetType: assignment.targetType,
            amount: this.moneyToString(freshStructure.amount),
            dueDate: dueDate.toISOString(),
            source: 'manual_generation',
          },
        });
      }

      await this.writeFinanceAudit(tx, 'finance_structure_entries_generated_now', {
        audit,
        organizationId: freshStructure.organizationId,
        financeStructureId: freshStructure.id,
        resourceType: 'structure',
        resourceId: freshStructure.id,
        details: {
          periodStart: period.periodStart.toISOString(),
          periodEnd: period.periodEnd.toISOString(),
          createdCount: createdEntries.length,
          skippedCount: skippedAssignmentIds.length,
          skippedAssignmentIds,
        },
      });

      return this.serialize({
        structureId: freshStructure.id,
        createdCount: createdEntries.length,
        skippedCount: skippedAssignmentIds.length,
        skippedAssignmentIds,
        entries: createdEntries,
      });
    });
  }

  async getStructures(orgId: string | undefined, user: AuthenticatedRequest['user'], filters: FinanceFilters = {}) {
    const finalOrgId = this.getReadableOrgId(orgId, user, 'structures');
    const scopedFilters = await this.applyRoleScope(user, filters);
    const where: Prisma.FinancialStructureWhereInput = {
      organizationId: finalOrgId,
      AND: [
        ...(scopedFilters.studentId ? [{ assignments: { some: { studentId: scopedFilters.studentId } } }] : []),
        ...(scopedFilters.teacherId ? [{ assignments: { some: { teacherId: scopedFilters.teacherId } } }] : []),
        ...(scopedFilters.employeeUserId ? [{ assignments: { some: { employeeUserId: scopedFilters.employeeUserId } } }] : []),
        ...(scopedFilters.assignmentSource ? [{ assignments: { some: { sourceType: scopedFilters.assignmentSource } } }] : []),
      ],
      ...(scopedFilters.targetType ? { targetType: scopedFilters.targetType } : {}),
      ...(scopedFilters.category ? { category: scopedFilters.category } : {}),
      ...(scopedFilters.billingCycle ? { billingCycle: scopedFilters.billingCycle } : {}),
      ...(scopedFilters.isActive ? { isActive: scopedFilters.isActive === 'true' } : {}),
      ...(scopedFilters.search ? this.structureSearch(scopedFilters.search) : {}),
    };

    const page = this.normalizePage(filters.page);
    const limit = this.normalizeLimit(filters.limit);
    const [data, totalRecords] = await Promise.all([
      this.prisma.financialStructure.findMany({
        where,
        skip: page ? (page - 1) * limit : undefined,
        take: page ? limit : undefined,
        orderBy: { createdAt: 'desc' },
        include: this.structureInclude(),
      }),
      page ? this.prisma.financialStructure.count({ where }) : Promise.resolve(0),
    ]);

    const serialized = this.serialize(data);
    return page ? formatPaginatedResponse(serialized, totalRecords, page, limit) : serialized;
  }

  async getEntries(orgId: string | undefined, user: AuthenticatedRequest['user'], filters: FinanceFilters = {}) {
    const finalOrgId = this.getReadableOrgId(orgId, user, 'entries');
    const scopedFilters = await this.applyRoleScope(user, filters);
    const organization = await this.prisma.organization.findUnique({ where: { id: finalOrgId }, select: { currency: true } });
    const where: Prisma.FinancialEntryWhereInput = {
      organizationId: finalOrgId,
      AND: [
        ...(scopedFilters.category ? [{ structure: { category: scopedFilters.category } }] : []),
        ...(scopedFilters.billingCycle ? [{ structure: { billingCycle: scopedFilters.billingCycle } }] : []),
        ...(scopedFilters.search ? [this.entrySearch(scopedFilters.search)] : []),
      ],
      ...(scopedFilters.studentId ? { studentId: scopedFilters.studentId } : {}),
      ...(scopedFilters.teacherId ? { teacherId: scopedFilters.teacherId } : {}),
      ...(scopedFilters.employeeUserId ? { employeeUserId: scopedFilters.employeeUserId } : {}),
      ...(scopedFilters.status ? { status: scopedFilters.status } : {}),
      ...(scopedFilters.targetType ? { assignment: { targetType: scopedFilters.targetType } } : {}),
      ...(scopedFilters.dueFrom || scopedFilters.dueTo ? {
        dueDate: {
          ...(scopedFilters.dueFrom ? { gte: new Date(scopedFilters.dueFrom) } : {}),
          ...(scopedFilters.dueTo ? { lte: new Date(scopedFilters.dueTo) } : {}),
        },
      } : {}),
    };

    const page = this.normalizePage(filters.page);
    const limit = this.normalizeLimit(filters.limit);
    const [entries, totalRecords] = await Promise.all([
      this.prisma.financialEntry.findMany({
        where,
        skip: page ? (page - 1) * limit : undefined,
        take: page ? limit : undefined,
        orderBy: { dueDate: 'desc' },
        include: this.entryInclude(),
      }),
      page ? this.prisma.financialEntry.count({ where }) : Promise.resolve(0),
    ]);
    const data = entries.map((entry) => ({
      ...entry,
      currency: entry.structure?.currency || organization?.currency || 'USD',
    }));
    const serialized = this.serialize(data);
    return page ? formatPaginatedResponse(serialized, totalRecords, page, limit) : serialized;
  }

  async getTransactions(orgId: string | undefined, user: AuthenticatedRequest['user'], filters: FinanceFilters = {}) {
    const finalOrgId = this.getReadableOrgId(orgId, user, 'transactions');
    const scopedFilters = await this.applyRoleScope(user, filters);
    const where: Prisma.TransactionWhereInput = {
      organizationId: finalOrgId,
      AND: [
        ...(scopedFilters.studentId || scopedFilters.teacherId || scopedFilters.employeeUserId || scopedFilters.targetType || scopedFilters.billingCycle || scopedFilters.search ? [{
          relatedEntry: {
            AND: [
              ...(scopedFilters.billingCycle ? [{ structure: { billingCycle: scopedFilters.billingCycle } }] : []),
              ...(scopedFilters.search ? [this.entrySearch(scopedFilters.search)] : []),
            ],
            ...(scopedFilters.studentId ? { studentId: scopedFilters.studentId } : {}),
            ...(scopedFilters.teacherId ? { teacherId: scopedFilters.teacherId } : {}),
            ...(scopedFilters.employeeUserId ? { employeeUserId: scopedFilters.employeeUserId } : {}),
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
    };

    const page = this.normalizePage(filters.page);
    const limit = this.normalizeLimit(filters.limit);
    const [data, totalRecords] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip: page ? (page - 1) * limit : undefined,
        take: page ? limit : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          attachments: this.attachmentRelationInclude(),
          relatedEntry: { include: this.entryInclude() },
        },
      }),
      page ? this.prisma.transaction.count({ where }) : Promise.resolve(0),
    ]);
    const serialized = this.serialize(data);
    return page ? formatPaginatedResponse(serialized, totalRecords, page, limit) : serialized;
  }

  async getStats(orgId: string | undefined, user: AuthenticatedRequest['user']) {
    const finalOrgId = this.getReadableOrgId(orgId, user, 'stats');
    const scopedFilters = await this.applyRoleScope(user, {});
    const entries = await this.prisma.financialEntry.findMany({
      where: {
        organizationId: finalOrgId,
        ...(scopedFilters.studentId ? { studentId: scopedFilters.studentId } : {}),
        ...(scopedFilters.teacherId ? { teacherId: scopedFilters.teacherId } : {}),
        ...(scopedFilters.employeeUserId ? { employeeUserId: scopedFilters.employeeUserId } : {}),
      },
      select: { amount: true, paidAmount: true, status: true, dueDate: true, studentId: true, teacherId: true, employeeUserId: true, assignment: { select: { targetType: true } } },
    });

    const now = new Date();
    let totalExpectedIncome = 0;
    let totalCollectedIncome = 0;
    let overdueAmount = 0;
    let pendingConfirmations = 0;
    let totalSalaryExpenses = 0;

    for (const entry of entries) {
      const amount = this.decimalToNumber(entry.amount);
      const paidAmount = this.decimalToNumber(entry.paidAmount);
      const type = this.transactionTypeForEntry(entry);
      if (type === TransactionType.INCOME) {
        totalExpectedIncome += amount;
        totalCollectedIncome += paidAmount;
        if ((entry.status === EntryStatus.PENDING || entry.status === EntryStatus.PARTIAL || entry.status === EntryStatus.OVERDUE) && entry.dueDate < now) {
          overdueAmount += amount - paidAmount;
        }
        if (entry.status === EntryStatus.UNVERIFIED) pendingConfirmations++;
      } else {
        totalSalaryExpenses += amount;
      }
    }

    const recentTransactions = await this.getTransactions(orgId, user, { limit: 5, page: 1 }) as any;
    return this.serialize({
      totalExpectedIncome,
      totalCollectedIncome,
      overdueAmount,
      totalSalaryExpenses,
      pendingConfirmations,
      recentTransactions: recentTransactions.data || [],
    });
  }

  async getTeacherOverview(user: AuthenticatedRequest['user']) {
    if (user.role !== Role.TEACHER) throw new ForbiddenException('Teacher finance overview is only available to teachers');
    return this.getMyPayroll(user);
  }

  async getMyPayroll(user: AuthenticatedRequest['user']) {
    if (!user.organizationId) throw new BadRequestException('Organization is required');
    const profile = await this.resolvePayrollProfile(user);
    const targetType = profile.targetType;
    const filters = targetType === FinanceTargetType.TEACHER
      ? { targetType, teacherId: profile.teacherId }
      : { targetType, employeeUserId: profile.employeeUserId };

    const [structures, entries, transactions] = await Promise.all([
      this.getStructures(user.organizationId, user, filters) as Promise<any[]>,
      this.getEntries(user.organizationId, user, filters) as Promise<any[]>,
      this.getTransactions(user.organizationId, user, { ...filters, type: TransactionType.EXPENSE }) as Promise<any[]>,
    ]);

    return this.buildPayrollOverview(profile, structures, entries, transactions);
  }

  async getPayrollRoster(orgId: string | undefined, user: AuthenticatedRequest['user'], targetType?: FinanceTargetType) {
    const finalOrgId = this.getReadableOrgId(orgId, user, 'payroll');
    if (targetType && !([FinanceTargetType.TEACHER, FinanceTargetType.SUB_ADMIN, FinanceTargetType.FINANCE_MANAGER] as FinanceTargetType[]).includes(targetType)) {
      throw new BadRequestException('Payroll target type must be TEACHER, SUB_ADMIN, or FINANCE_MANAGER');
    }
    const targetTypes = targetType ? [targetType] : [FinanceTargetType.TEACHER, FinanceTargetType.SUB_ADMIN, FinanceTargetType.FINANCE_MANAGER];
    const rows = await Promise.all(targetTypes.map(async (type) => {
      if (type === FinanceTargetType.TEACHER) {
        const teachers = await this.prisma.teacher.findMany({
          where: { organizationId: finalOrgId },
          include: { user: { select: { id: true, name: true, email: true, role: true, status: true, avatarUrl: true, avatarUpdatedAt: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return Promise.all(teachers.map((teacher) => this.buildPayrollRow(finalOrgId, type, { teacherId: teacher.id, user: teacher.user })));
      }

      const role = type === FinanceTargetType.SUB_ADMIN ? Role.SUB_ADMIN : Role.FINANCE_MANAGER;
      const users = await this.prisma.user.findMany({
        where: { organizationId: finalOrgId, role, status: { not: 'DELETED' as any } },
        select: { id: true, name: true, email: true, role: true, status: true, avatarUrl: true, avatarUpdatedAt: true },
        orderBy: { createdAt: 'desc' },
      });
      return Promise.all(users.map((employee) => this.buildPayrollRow(finalOrgId, type, { employeeUserId: employee.id, user: employee })));
    }));
    return this.serialize(rows.flat());
  }

  async createManualEntry(dto: CreateManualEntryDto, user: AuthenticatedRequest['user'], audit?: AuditContext) {
    const orgId = dto.organizationId || user.organizationId;
    if (!orgId) throw new BadRequestException('Organization is required');
    this.assertWritableOrg(orgId, user, 'create entries');
    const targetType = dto.targetType || (dto.teacherId ? FinanceTargetType.TEACHER : dto.employeeUserId ? await this.resolveStaffTargetType(orgId, dto.employeeUserId) : FinanceTargetType.STUDENT);
    if (!dto.studentId && !dto.teacherId && !dto.employeeUserId) throw new BadRequestException('Must provide a student, teacher, or staff target');
    const amount = this.parseMoney(dto.amount, 'amount', { allowZero: false });
    const { startDate: dueDate } = this.validateDateRange(dto.dueDate, undefined);
    const { startDate: periodStart, endDate: periodEnd } = this.validateDateRange(dto.periodStart, dto.periodEnd, true);
    this.validateMetadata(dto.metadata);
    this.validateText(dto.title, 'title', 160);

    const organization = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } });
    const entry = await this.prisma.$transaction(async (tx) => {
      await this.validateDirectTargets(tx, orgId, targetType, dto);
      const created = await tx.financialEntry.create({
        data: {
          organizationId: orgId,
          title: dto.title.trim(),
          studentId: dto.studentId,
          teacherId: dto.teacherId,
          employeeUserId: dto.employeeUserId,
          amount,
          dueDate: dueDate!,
          periodStart,
          periodEnd,
          metadata: dto.metadata,
          source: EntrySource.MANUAL,
          status: EntryStatus.PENDING,
        },
        include: this.entryInclude(),
      });
      await this.writeFinanceAudit(tx, 'finance_entry_manual_created', {
        audit,
        organizationId: orgId,
        financeEntryId: created.id,
        resourceType: 'entry',
        resourceId: created.id,
        details: { title: created.title, targetType, amount: this.moneyToString(amount) },
      });
      return created;
    });

    return this.serialize({ ...entry, currency: (entry as any).structure?.currency || organization?.currency || 'USD' });
  }

  async markEntryPaid(id: string, user: AuthenticatedRequest['user'], dto: MarkPaidDto, audit?: AuditContext) {
    const entry = await this.prisma.financialEntry.findUnique({ where: { id }, include: this.entryInclude() });
    if (!entry) throw new NotFoundException('Entry not found');
    await this.assertCanAccessEntry(entry, user, 'mark');
    if (entry.status === EntryStatus.PAID || this.decimal(entry.paidAmount).gte(entry.amount)) throw new ConflictException('This entry is already fully paid.');
    if (entry.status === EntryStatus.UNVERIFIED) throw new ConflictException('This entry already has a payment claim awaiting review.');
    this.validateReceiptUrl(dto.receiptUrl);
    this.validateText(dto.paymentMethod, 'paymentMethod', 80, true);
    this.validateText(dto.referenceNumber, 'referenceNumber', 120, true);
    this.validateText(dto.note, 'note', 1000, true);

    const balance = this.decimal(entry.amount).minus(entry.paidAmount);
    const claimedAmount = dto.claimedAmount === undefined ? balance : this.parseMoney(dto.claimedAmount, 'claimedAmount', { allowZero: false });
    if (claimedAmount.lte(0) || claimedAmount.gt(balance)) throw new BadRequestException('Claimed amount must be greater than zero and no more than the remaining balance.');

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.paymentClaim.create({
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

      await this.createFinanceAttachments(tx, {
        organizationId: entry.organizationId,
        entryId: entry.id,
        claimId: claim.id,
        attachmentIds: dto.attachmentIds,
        requesterId: user.id,
        expectedEntityType: 'FINANCE_PAYMENT_CLAIM',
      });

      const updated = await tx.financialEntry.update({
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

      await this.writeFinanceAudit(tx, 'finance_payment_claimed', {
        audit,
        organizationId: entry.organizationId,
        financeEntryId: entry.id,
        paymentClaimId: claim.id,
        resourceType: 'claim',
        resourceId: claim.id,
        targetUserId: user.id,
        details: { claimedAmount: this.moneyToString(claimedAmount), status: PaymentClaimStatus.PENDING },
      });

      return this.serialize(updated);
    });
  }

  async confirmEntry(id: string, user: AuthenticatedRequest['user'], dto: ConfirmEntryDto, audit?: AuditContext) {
    const entry = await this.prisma.financialEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Entry not found');
    this.assertWritableOrg(entry.organizationId, user, 'confirm entries');

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
      if (lockedEntry.status === EntryStatus.PAID || this.decimal(lockedEntry.paidAmount).gte(lockedEntry.amount)) throw new ConflictException('This entry is already fully paid.');

      const claim = dto.claimId
        ? await tx.paymentClaim.findFirst({ where: { id: dto.claimId, entryId: id, status: PaymentClaimStatus.PENDING } })
        : lockedEntry.claims[0] || null;
      if (dto.claimId && !claim) throw new BadRequestException('Payment claim is not pending or does not belong to this entry.');
      if (claim?.claimedById === user.id) throw new ForbiddenException('You cannot confirm your own payment claim.');

      const balance = this.decimal(lockedEntry.amount).minus(lockedEntry.paidAmount);
      const amountPaid = dto.paidAmount === undefined
        ? (claim?.claimedAmount ? this.decimal(claim.claimedAmount) : balance)
        : this.parseMoney(dto.paidAmount, 'paidAmount', { allowZero: false });
      if (amountPaid.lte(0)) throw new BadRequestException('Amount paid must be greater than zero.');
      if (amountPaid.gt(balance)) throw new BadRequestException('Amount paid cannot exceed remaining balance.');

      const newPaidAmount = this.decimal(lockedEntry.paidAmount).plus(amountPaid);
      const newStatus = newPaidAmount.lt(lockedEntry.amount) ? EntryStatus.PARTIAL : EntryStatus.PAID;
      const updateResult = await tx.financialEntry.updateMany({
        where: { id, paidAmount: lockedEntry.paidAmount, status: lockedEntry.status },
        data: {
          status: newStatus,
          paidAmount: { increment: amountPaid },
          confirmedByAdmin: true,
          confirmedAt: new Date(),
          confirmedById: user.id,
        },
      });
      if (updateResult.count !== 1) throw new ConflictException('This entry changed while confirming. Refresh and try again.');

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

      const organization = await tx.organization.findUnique({ where: { id: lockedEntry.organizationId }, select: { currency: true } });
      const transaction = await tx.transaction.create({
        data: {
          organizationId: lockedEntry.organizationId,
          type: this.transactionTypeForEntry(lockedEntry),
          category: lockedEntry.structure?.category || FinanceCategory.OTHER,
          amount: amountPaid,
          currency: lockedEntry.structure?.currency || organization?.currency || 'USD',
          description: `Confirmed payment for ${lockedEntry.title}`,
          relatedEntryId: lockedEntry.id,
          paymentMethod: claim?.paymentMethod || lockedEntry.paymentMethod,
          referenceNumber: claim?.referenceNumber,
          createdById: user.id,
          metadata: { claimId: claim?.id || null },
        },
      });

      await this.createFinanceAttachments(tx, {
        organizationId: lockedEntry.organizationId,
        entryId: lockedEntry.id,
        transactionId: transaction.id,
        attachmentIds: dto.attachmentIds,
        requesterId: user.id,
        expectedEntityType: 'FINANCE_PAYMENT_CONFIRMATION',
      });

      const updatedEntry = await tx.financialEntry.findUnique({ where: { id }, include: this.entryInclude() });
      const transactionWithAttachments = await tx.transaction.findUnique({
        where: { id: transaction.id },
        include: {
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          attachments: this.attachmentRelationInclude(),
          relatedEntry: { include: this.entryInclude() },
        },
      });

      await this.writeFinanceAudit(tx, 'finance_payment_confirmed', {
        audit,
        organizationId: lockedEntry.organizationId,
        financeEntryId: lockedEntry.id,
        paymentClaimId: claim?.id,
        transactionId: transaction.id,
        resourceType: 'transaction',
        resourceId: transaction.id,
        targetUserId: claim?.claimedById,
        details: {
          amountPaid: this.moneyToString(amountPaid),
          previousStatus: lockedEntry.status,
          newStatus,
          previousPaidAmount: this.moneyToString(lockedEntry.paidAmount),
          newPaidAmount: this.moneyToString(newPaidAmount),
        },
      });

      return this.serialize({ entry: updatedEntry, transaction: transactionWithAttachments || transaction });
    });
  }

  async rejectPaymentClaim(id: string, user: AuthenticatedRequest['user'], rejectionReason?: string, audit?: AuditContext) {
    const claim = await this.prisma.paymentClaim.findUnique({ where: { id }, include: { entry: true } });
    if (!claim) throw new NotFoundException('Payment claim not found');
    this.assertWritableOrg(claim.organizationId, user, 'reject claims');
    if (claim.status !== PaymentClaimStatus.PENDING) throw new ConflictException('Only pending payment claims can be rejected.');
    this.validateText(rejectionReason, 'rejectionReason', 1000, true);

    return this.prisma.$transaction(async (tx) => {
      const updatedClaim = await tx.paymentClaim.update({
        where: { id },
        data: { status: PaymentClaimStatus.REJECTED, reviewedById: user.id, reviewedAt: new Date(), rejectionReason },
      });

      const pendingCount = await tx.paymentClaim.count({ where: { entryId: claim.entryId, status: PaymentClaimStatus.PENDING, id: { not: id } } });
      let updatedEntry: unknown = null;
      if (pendingCount === 0 && claim.entry.status === EntryStatus.UNVERIFIED) {
        updatedEntry = await tx.financialEntry.update({
          where: { id: claim.entryId },
          data: { status: this.decimal(claim.entry.paidAmount).gt(0) ? EntryStatus.PARTIAL : EntryStatus.PENDING },
          include: this.entryInclude(),
        });
      }

      await this.writeFinanceAudit(tx, 'finance_payment_claim_rejected', {
        audit,
        organizationId: claim.organizationId,
        financeEntryId: claim.entryId,
        paymentClaimId: claim.id,
        resourceType: 'claim',
        resourceId: claim.id,
        targetUserId: claim.claimedById,
        details: { rejectionReason, previousEntryStatus: claim.entry.status },
      });

      return this.serialize({ claim: updatedClaim, entry: updatedEntry });
    });
  }

  async cancelEntry(id: string, user: AuthenticatedRequest['user'], reason?: string, audit?: AuditContext) {
    const entry = await this.prisma.financialEntry.findUnique({ where: { id }, include: { transactions: true, claims: true } });
    if (!entry) throw new NotFoundException('Entry not found');
    this.assertWritableOrg(entry.organizationId, user, 'cancel entries');
    if (this.decimal(entry.paidAmount).gt(0) || entry.transactions.length > 0) throw new ConflictException('Entries with payments must be reversed, not cancelled.');
    if (entry.status === EntryStatus.CANCELLED) throw new ConflictException('Entry is already cancelled.');
    this.validateText(reason, 'reason', 1000, true);

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.financialEntry.update({ where: { id }, data: { status: EntryStatus.CANCELLED, metadata: { ...this.asObject(entry.metadata), cancellationReason: reason || null } }, include: this.entryInclude() });
      await tx.paymentClaim.updateMany({ where: { entryId: id, status: PaymentClaimStatus.PENDING }, data: { status: PaymentClaimStatus.REJECTED, reviewedById: user.id, reviewedAt: new Date(), rejectionReason: reason || 'Entry cancelled' } });
      await this.writeFinanceAudit(tx, 'finance_entry_cancelled', {
        audit,
        organizationId: entry.organizationId,
        financeEntryId: id,
        resourceType: 'entry',
        resourceId: id,
        details: { reason, previousStatus: entry.status },
      });
      return cancelled;
    });
    return this.serialize(updated);
  }

  async reverseTransaction(id: string, user: AuthenticatedRequest['user'], reason?: string, audit?: AuditContext) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id }, include: { relatedEntry: true } });
    if (!transaction) throw new NotFoundException('Transaction not found');
    this.assertWritableOrg(transaction.organizationId, user, 'reverse transactions');
    if (!transaction.relatedEntry) throw new BadRequestException('Only entry-linked transactions can be reversed.');
    if (this.asObject(transaction.metadata).reversesTransactionId) throw new ConflictException('Reversal transactions cannot be reversed.');
    const alreadyReversed = await this.prisma.transaction.findFirst({ where: { metadata: { path: ['reversesTransactionId'], equals: transaction.id } } as Prisma.TransactionWhereInput });
    if (alreadyReversed) throw new ConflictException('This transaction has already been reversed.');
    this.validateText(reason, 'reason', 1000, true);

    return this.prisma.$transaction(async (tx) => {
      const entry = transaction.relatedEntry!;
      const newPaidAmount = this.decimal(entry.paidAmount).minus(transaction.amount);
      if (newPaidAmount.lt(0)) throw new ConflictException('Reversal would make paid amount negative.');
      const newStatus = newPaidAmount.eq(0) ? EntryStatus.PENDING : newPaidAmount.lt(entry.amount) ? EntryStatus.PARTIAL : EntryStatus.PAID;
      const reversedEntry = await tx.financialEntry.update({
        where: { id: entry.id },
        data: { paidAmount: newPaidAmount, status: newStatus },
        include: this.entryInclude(),
      });
      const reversal = await tx.transaction.create({
        data: {
          organizationId: transaction.organizationId,
          type: transaction.type === TransactionType.INCOME ? TransactionType.EXPENSE : TransactionType.INCOME,
          category: transaction.category,
          amount: transaction.amount,
          currency: transaction.currency,
          description: `Reversal for ${transaction.description || transaction.id}`,
          relatedEntryId: entry.id,
          paymentMethod: transaction.paymentMethod,
          referenceNumber: transaction.referenceNumber,
          createdById: user.id,
          metadata: { reversesTransactionId: transaction.id, reason: reason || null },
        },
      });
      await this.writeFinanceAudit(tx, 'finance_transaction_reversed', {
        audit,
        organizationId: transaction.organizationId,
        financeEntryId: entry.id,
        transactionId: reversal.id,
        resourceType: 'transaction',
        resourceId: reversal.id,
        details: { originalTransactionId: transaction.id, amount: this.moneyToString(transaction.amount), reason },
      });
      return this.serialize({ entry: reversedEntry, transaction: reversal });
    });
  }

  async getFinanceAuditLogs(orgId: string | undefined, user: AuthenticatedRequest['user'], filters: AuditFilters = {}) {
    const finalOrgId = this.getReadableOrgId(orgId, user, 'finance audit logs');
    const page = this.normalizePage(filters.page) || 1;
    const limit = this.normalizeLimit(filters.limit);
    const matchingUserIds = filters.search
      ? (
          await this.prisma.user.findMany({
            where: {
              organizationId: finalOrgId,
              OR: [
                { id: { contains: filters.search, mode: 'insensitive' } },
                { name: { contains: filters.search, mode: 'insensitive' } },
                { email: { contains: filters.search, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
          })
        ).map((matchedUser) => matchedUser.id)
      : [];
    const where: Prisma.AuditLogWhereInput = {
      organizationId: finalOrgId,
      module: 'finance',
      ...(filters.action && filters.action !== 'ALL' ? { action: { contains: filters.action, mode: 'insensitive' } } : {}),
      ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
      ...(filters.resourceId ? { resourceId: filters.resourceId } : {}),
      ...(filters.userId ? { actorUserId: filters.userId } : {}),
      ...(filters.search ? {
        OR: [
          { action: { contains: filters.search, mode: 'insensitive' } },
          { resourceType: { contains: filters.search, mode: 'insensitive' } },
          { resourceId: { contains: filters.search, mode: 'insensitive' } },
          { financeEntryId: { contains: filters.search, mode: 'insensitive' } },
          { transactionId: { contains: filters.search, mode: 'insensitive' } },
          ...(matchingUserIds.length ? [{ actorUserId: { in: matchingUserIds } }, { targetUserId: { in: matchingUserIds } }] : []),
        ],
      } : {}),
    };
    const [logs, totalRecords, actions] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({ where: { organizationId: finalOrgId, module: 'finance' }, by: ['action'], _count: { _all: true }, orderBy: { action: 'asc' } }),
    ]);
    const structureIds = new Set<string>();
    const entryIds = new Set<string>();
    const claimIds = new Set<string>();
    const transactionIds = new Set<string>();
    for (const log of logs) {
      if (log.financeStructureId) structureIds.add(log.financeStructureId);
      if (log.financeEntryId) entryIds.add(log.financeEntryId);
      if (log.paymentClaimId) claimIds.add(log.paymentClaimId);
      if (log.transactionId) transactionIds.add(log.transactionId);
      if (log.resourceId && log.resourceType === 'structure') structureIds.add(log.resourceId);
      if (log.resourceId && log.resourceType === 'entry') entryIds.add(log.resourceId);
      if (log.resourceId && log.resourceType === 'claim') claimIds.add(log.resourceId);
      if (log.resourceId && log.resourceType === 'transaction') transactionIds.add(log.resourceId);
    }
    const [structures, entries, claims, transactions] = await Promise.all([
      structureIds.size ? this.prisma.financialStructure.findMany({ where: { id: { in: [...structureIds] } }, select: { id: true, title: true } }) : [],
      entryIds.size ? this.prisma.financialEntry.findMany({ where: { id: { in: [...entryIds] } }, select: { id: true, title: true } }) : [],
      claimIds.size ? this.prisma.paymentClaim.findMany({
        where: { id: { in: [...claimIds] } },
        select: { id: true, referenceNumber: true, paymentMethod: true, entry: { select: { title: true } } },
      }) : [],
      transactionIds.size ? this.prisma.transaction.findMany({
        where: { id: { in: [...transactionIds] } },
        select: { id: true, description: true, referenceNumber: true, paymentMethod: true, relatedEntry: { select: { title: true } } },
      }) : [],
    ]);
    const structureTitleMap = new Map<string, string>(structures.map((row) => [row.id, row.title] as const));
    const entryTitleMap = new Map<string, string>(entries.map((row) => [row.id, row.title] as const));
    const claimTitleMap = new Map<string, string>(claims.map((row) => [
      row.id,
      row.entry?.title || row.referenceNumber || row.paymentMethod || 'Payment claim',
    ] as const));
    const transactionTitleMap = new Map<string, string>(transactions.map((row) => [
      row.id,
      row.description || row.relatedEntry?.title || row.referenceNumber || row.paymentMethod || 'Transaction',
    ] as const));
    const userIds = Array.from(new Set(logs.flatMap((log) => [log.actorUserId, log.targetUserId]).filter((value): value is string => Boolean(value))));
    const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, role: true } }) : [];
    const userMap = new Map(users.map((row) => [row.id, row]));
    const data = logs.map((log) => ({
      ...log,
      message: this.humanizeFinanceAudit(log.action),
      actor: log.actorUserId ? userMap.get(log.actorUserId) || null : null,
      target: log.targetUserId ? userMap.get(log.targetUserId) || null : null,
      resourceTitle: this.resolveFinanceAuditResourceTitle(log, {
        structureTitleMap,
        entryTitleMap,
        claimTitleMap,
        transactionTitleMap,
      }),
    }));
    return {
      ...formatPaginatedResponse(this.serialize(data), totalRecords, page, limit),
      counts: Object.fromEntries(actions.map((entry) => [entry.action, entry._count._all])),
    };
  }

  private resolveFinanceAuditResourceTitle(
    log: {
      resourceType: string | null;
      resourceId: string | null;
      financeStructureId: string | null;
      financeEntryId: string | null;
      paymentClaimId: string | null;
      transactionId: string | null;
    },
    maps: {
      structureTitleMap: Map<string, string>;
      entryTitleMap: Map<string, string>;
      claimTitleMap: Map<string, string>;
      transactionTitleMap: Map<string, string>;
    },
  ) {
    if (log.financeStructureId && maps.structureTitleMap.has(log.financeStructureId)) return maps.structureTitleMap.get(log.financeStructureId);
    if (log.financeEntryId && maps.entryTitleMap.has(log.financeEntryId)) return maps.entryTitleMap.get(log.financeEntryId);
    if (log.paymentClaimId && maps.claimTitleMap.has(log.paymentClaimId)) return maps.claimTitleMap.get(log.paymentClaimId);
    if (log.transactionId && maps.transactionTitleMap.has(log.transactionId)) return maps.transactionTitleMap.get(log.transactionId);

    if (!log.resourceId) return null;
    if (log.resourceType === 'structure') return maps.structureTitleMap.get(log.resourceId) || null;
    if (log.resourceType === 'entry') return maps.entryTitleMap.get(log.resourceId) || null;
    if (log.resourceType === 'claim') return maps.claimTitleMap.get(log.resourceId) || null;
    if (log.resourceType === 'transaction') return maps.transactionTitleMap.get(log.resourceId) || null;
    return null;
  }

  private async applyStructureUpdateToEntries(tx: Prisma.TransactionClient, structure: any, amount: Prisma.Decimal | undefined, audit?: AuditContext) {
    const entries = await tx.financialEntry.findMany({
      where: { structureId: structure.id, status: { in: OUTSTANDING_STATUSES } },
      include: { claims: { where: { status: PaymentClaimStatus.PENDING } } },
    });
    const skippedEntryIds: string[] = [];
    let updated = 0;
    for (const entry of entries) {
      const nextAmount = amount || this.decimal(structure.amount);
      const pendingClaimAmount = entry.claims.reduce((sum, claim) => sum.plus(claim.claimedAmount), new Prisma.Decimal(0));
      const minimumAmount = this.decimal(entry.paidAmount).plus(pendingClaimAmount);
      if (nextAmount.lt(minimumAmount)) {
        skippedEntryIds.push(entry.id);
        continue;
      }
      await tx.financialEntry.update({
        where: { id: entry.id },
        data: {
          amount: nextAmount,
          dueDate: entry.periodStart ? this.getDueDate(structure.billingCycle, entry.periodStart, structure.dueDay) : entry.dueDate,
        },
      });
      updated++;
      await this.writeFinanceAudit(tx, 'finance_entry_updated_from_structure', {
        audit,
        organizationId: structure.organizationId,
        financeStructureId: structure.id,
        financeEntryId: entry.id,
        resourceType: 'entry',
        resourceId: entry.id,
        details: { previousAmount: this.moneyToString(entry.amount), newAmount: this.moneyToString(nextAmount) },
      });
    }
    return { updated, skipped: skippedEntryIds.length, skippedEntryIds };
  }

  private async resolveAssignmentSeeds(tx: Prisma.TransactionClient, orgId: string, targetType: FinanceTargetType, dto: CreateFinancialStructureDto): Promise<AssignmentSeed[]> {
    const seeds = new Map<string, AssignmentSeed>();
    const add = (seed: AssignmentSeed) => {
      const key = seed.studentId || seed.teacherId || seed.employeeUserId || `${seed.targetType}:${seed.entityName}`;
      if (key && !seeds.has(key)) seeds.set(key, seed);
    };

    if (targetType === FinanceTargetType.STUDENT) {
      for (const studentId of [...(dto.studentIds || []), ...(dto.studentId ? [dto.studentId] : [])]) add({ targetType, studentId, sourceType: FinanceAssignmentSource.MANUAL });
      await this.assertStudentsBelongToOrg(tx, orgId, [...(dto.studentIds || []), ...(dto.studentId ? [dto.studentId] : [])]);
      if (dto.sectionIds?.length) {
        const enrollments = await tx.enrollment.findMany({ where: { sectionId: { in: dto.sectionIds }, section: { course: { organizationId: orgId } } }, select: { studentId: true, sectionId: true } });
        enrollments.forEach((enrollment) => add({ targetType, studentId: enrollment.studentId, sourceType: FinanceAssignmentSource.SECTION, sourceId: enrollment.sectionId }));
      }
      if (dto.cohortIds?.length) {
        const students = await tx.student.findMany({ where: { organizationId: orgId, cohortId: { in: dto.cohortIds } }, select: { id: true, cohortId: true } });
        students.forEach((student) => add({ targetType, studentId: student.id, sourceType: FinanceAssignmentSource.COHORT, sourceId: student.cohortId || undefined }));
      }
      if (dto.courseIds?.length) {
        const enrollments = await tx.enrollment.findMany({ where: { section: { courseId: { in: dto.courseIds }, course: { organizationId: orgId } } }, select: { studentId: true, section: { select: { courseId: true } } } });
        enrollments.forEach((enrollment) => add({ targetType, studentId: enrollment.studentId, sourceType: FinanceAssignmentSource.COURSE, sourceId: enrollment.section.courseId }));
      }
    } else if (targetType === FinanceTargetType.TEACHER) {
      for (const teacherId of [...(dto.teacherIds || []), ...(dto.teacherId ? [dto.teacherId] : [])]) add({ targetType, teacherId, sourceType: FinanceAssignmentSource.MANUAL });
      await this.assertTeachersBelongToOrg(tx, orgId, [...(dto.teacherIds || []), ...(dto.teacherId ? [dto.teacherId] : [])]);
      if (dto.sectionIds?.length) {
        const sections = await tx.section.findMany({ where: { id: { in: dto.sectionIds }, course: { organizationId: orgId } }, select: { id: true, teachers: { select: { id: true } } } });
        sections.forEach((section) => section.teachers.forEach((teacher) => add({ targetType, teacherId: teacher.id, sourceType: FinanceAssignmentSource.SECTION, sourceId: section.id })));
      }
      if (dto.courseIds?.length) {
        const sections = await tx.section.findMany({ where: { courseId: { in: dto.courseIds }, course: { organizationId: orgId } }, select: { courseId: true, teachers: { select: { id: true } } } });
        sections.forEach((section) => section.teachers.forEach((teacher) => add({ targetType, teacherId: teacher.id, sourceType: FinanceAssignmentSource.COURSE, sourceId: section.courseId })));
      }
    } else if ((STAFF_TARGETS as FinanceTargetType[]).includes(targetType)) {
      const ids = [...(dto.employeeUserIds || []), ...(dto.employeeUserId ? [dto.employeeUserId] : [])];
      await this.assertEmployeesBelongToOrg(tx, orgId, ids, targetType);
      ids.forEach((employeeUserId) => add({ targetType, employeeUserId, sourceType: FinanceAssignmentSource.MANUAL }));
    } else {
      if (!dto.entityName?.trim()) throw new BadRequestException('Entity name is required for other income or expense structures');
      add({ targetType, entityName: dto.entityName.trim(), sourceType: FinanceAssignmentSource.OTHER });
    }
    return [...seeds.values()];
  }

  private async applyRoleScope(user: AuthenticatedRequest['user'], filters: FinanceFilters): Promise<FinanceFilters> {
    if (user.role === Role.STUDENT) {
      const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
      if (!student) throw new NotFoundException('Student profile not found');
      return { ...filters, studentId: student.id, teacherId: undefined, employeeUserId: undefined };
    }
    if (user.role === Role.GUARDIAN) {
      if (!filters.studentId) throw new BadRequestException('Student is required for guardian finance records');
      await this.assertGuardianCanAccessStudent(user, filters.studentId);
      return { ...filters, studentId: filters.studentId, teacherId: undefined, employeeUserId: undefined };
    }
    if (user.role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher) throw new NotFoundException('Teacher profile not found');
      return { ...filters, teacherId: teacher.id, studentId: undefined, employeeUserId: undefined };
    }
    if (user.role === Role.SUB_ADMIN || user.role === Role.FINANCE_MANAGER) {
      return { ...filters, employeeUserId: user.id, studentId: undefined, teacherId: undefined };
    }
    return filters;
  }

  private getReadableOrgId(orgId: string | undefined, user: AuthenticatedRequest['user'], resource: string) {
    const finalOrgId = orgId || user.organizationId;
    if (!finalOrgId) throw new BadRequestException('Organization is required');
    if (user.role !== Role.SUPER_ADMIN && finalOrgId !== user.organizationId) throw new ForbiddenException(`Cannot view ${resource} of a different organization`);
    return finalOrgId;
  }

  private assertWritableOrg(orgId: string, user: AuthenticatedRequest['user'], action: string) {
    if (user.role !== Role.SUPER_ADMIN && orgId !== user.organizationId) throw new ForbiddenException(`Cannot ${action} for a different organization`);
  }

  private async assertCanAccessEntry(entry: { studentId: string | null; teacherId: string | null; employeeUserId?: string | null; organizationId: string }, user: AuthenticatedRequest['user'], action: string) {
    if (user.role === Role.STUDENT) {
      const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
      if (!student || entry.studentId !== student.id || entry.organizationId !== user.organizationId) throw new ForbiddenException(`You can only ${action} your own entries`);
    } else if (user.role === Role.GUARDIAN) {
      if (!entry.studentId) throw new ForbiddenException(`Guardians can only ${action} linked student entries`);
      await this.assertGuardianCanAccessStudent(user, entry.studentId);
    } else if (user.role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher || entry.teacherId !== teacher.id || entry.organizationId !== user.organizationId) throw new ForbiddenException(`You can only ${action} your own entries`);
    } else if (user.role === Role.SUB_ADMIN || user.role === Role.FINANCE_MANAGER) {
      if (entry.employeeUserId !== user.id && entry.organizationId !== user.organizationId) throw new ForbiddenException(`You can only ${action} your own payroll entries`);
    } else if (user.role !== Role.SUPER_ADMIN && entry.organizationId !== user.organizationId) {
      throw new ForbiddenException('Cannot modify entries of a different organization');
    }
  }

  private async assertGuardianCanAccessStudent(user: AuthenticatedRequest['user'], studentId: string) {
    if (!user.organizationId) throw new BadRequestException('Organization is required');
    const link = await this.prisma.guardianStudent.findFirst({
      where: { studentId, organizationId: user.organizationId, guardian: { userId: user.id, organizationId: user.organizationId } },
      select: { id: true },
    });
    if (!link) throw new ForbiddenException('You can only access finance records for linked students');
  }

  private transactionTypeForEntry(entry: { teacherId?: string | null; employeeUserId?: string | null; assignment?: { targetType: FinanceTargetType } | null }) {
    const targetType = entry.assignment?.targetType;
    return targetType && (EXPENSE_TARGETS as FinanceTargetType[]).includes(targetType) || entry.teacherId || entry.employeeUserId ? TransactionType.EXPENSE : TransactionType.INCOME;
  }

  private structureSearch(search: string): Prisma.FinancialStructureWhereInput {
    return {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { assignments: { some: { entityName: { contains: search, mode: 'insensitive' } } } },
        { assignments: { some: { student: { user: { name: { contains: search, mode: 'insensitive' } } } } } },
        { assignments: { some: { teacher: { user: { name: { contains: search, mode: 'insensitive' } } } } } },
        { assignments: { some: { employeeUser: { name: { contains: search, mode: 'insensitive' } } } } },
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
        { employeeUser: { name: { contains: search, mode: 'insensitive' } } },
        { employeeUser: { email: { contains: search, mode: 'insensitive' } } },
      ],
    };
  }

  private structureInclude() {
    return {
      assignments: {
        include: {
          student: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, avatarUpdatedAt: true } }, cohort: true } },
          teacher: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, avatarUpdatedAt: true } } } },
          employeeUser: { select: { id: true, name: true, email: true, role: true, status: true, avatarUrl: true, avatarUpdatedAt: true } },
        },
      },
      employeeUser: { select: { id: true, name: true, email: true, role: true, status: true, avatarUrl: true, avatarUpdatedAt: true } },
      _count: { select: { assignments: true, entries: true } },
    } satisfies Prisma.FinancialStructureInclude;
  }

  private entryInclude() {
    return {
      structure: { include: { _count: { select: { assignments: true } } } },
      assignment: {
        include: {
          student: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, avatarUpdatedAt: true } }, cohort: true } },
          teacher: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, avatarUpdatedAt: true } } } },
          employeeUser: { select: { id: true, name: true, email: true, role: true, status: true, avatarUrl: true, avatarUpdatedAt: true } },
        },
      },
      student: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, avatarUpdatedAt: true } }, cohort: true } },
      teacher: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, avatarUpdatedAt: true } } } },
      employeeUser: { select: { id: true, name: true, email: true, role: true, status: true, avatarUrl: true, avatarUpdatedAt: true } },
      claims: {
        orderBy: { claimedAt: 'desc' },
        include: {
          claimedBy: { select: { id: true, name: true, email: true, role: true } },
          reviewedBy: { select: { id: true, name: true, email: true, role: true } },
          attachments: this.attachmentRelationInclude(),
        },
      },
      transactions: { orderBy: { createdAt: 'desc' }, include: { attachments: this.attachmentRelationInclude() } },
      attachments: this.attachmentRelationInclude(),
    } satisfies Prisma.FinancialEntryInclude;
  }

  private attachmentInclude() {
    return { uploadedBy: { select: { id: true, name: true, email: true, role: true } } } satisfies Prisma.FinanceAttachmentInclude;
  }

  private attachmentRelationInclude() {
    return { include: this.attachmentInclude() };
  }

  private async createFinanceAttachments(tx: Prisma.TransactionClient, input: {
    organizationId: string;
    entryId: string;
    claimId?: string;
    transactionId?: string;
    attachmentIds?: string[];
    requesterId: string;
    expectedEntityType: string;
  }) {
    const attachmentIds = [...new Set((input.attachmentIds || []).filter(Boolean))];
    if (attachmentIds.length === 0) return;
    const files = await tx.file.findMany({
      where: { id: { in: attachmentIds }, orgId: input.organizationId, entityId: input.entryId, entityType: input.expectedEntityType, uploadedBy: input.requesterId },
    });
    if (files.length !== attachmentIds.length) throw new BadRequestException('Some attachments could not be found for this finance record');
    await tx.financeAttachment.createMany({
      data: files.map((file) => ({
        organizationId: input.organizationId,
        entryId: input.entryId,
        claimId: input.claimId,
        transactionId: input.transactionId,
        fileId: file.id,
        url: file.path,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        uploadedById: file.uploadedBy || input.requesterId,
      })),
    });
  }

  private async resolveTargetType(orgId: string, dto: CreateFinancialStructureDto) {
    if (dto.targetType) return dto.targetType;
    if (dto.teacherId || dto.teacherIds?.length) return FinanceTargetType.TEACHER;
    if (dto.employeeUserId || dto.employeeUserIds?.length) return this.resolveStaffTargetType(orgId, dto.employeeUserId || dto.employeeUserIds?.[0]);
    return FinanceTargetType.STUDENT;
  }

  private async resolveStaffTargetType(orgId: string, userId?: string) {
    if (!userId) throw new BadRequestException('Staff user is required');
    const employee = await this.prisma.user.findFirst({ where: { id: userId, organizationId: orgId, role: { in: [Role.SUB_ADMIN, Role.FINANCE_MANAGER] as any } }, select: { role: true } });
    if (!employee) throw new BadRequestException('Staff user must be an active sub admin or finance manager in this organization');
    return employee.role === Role.SUB_ADMIN ? FinanceTargetType.SUB_ADMIN : FinanceTargetType.FINANCE_MANAGER;
  }

  private async validateDirectTargets(tx: Prisma.TransactionClient, orgId: string, targetType: FinanceTargetType, dto: { studentId?: string; teacherId?: string; employeeUserId?: string }) {
    if (dto.studentId) await this.assertStudentsBelongToOrg(tx, orgId, [dto.studentId]);
    if (dto.teacherId) await this.assertTeachersBelongToOrg(tx, orgId, [dto.teacherId]);
    if (dto.employeeUserId) await this.assertEmployeesBelongToOrg(tx, orgId, [dto.employeeUserId], targetType);
  }

  private async assertStudentsBelongToOrg(tx: Prisma.TransactionClient, orgId: string, ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return;
    const count = await tx.student.count({ where: { id: { in: unique }, organizationId: orgId } });
    if (count !== unique.length) throw new BadRequestException('Some students do not belong to this organization');
  }

  private async assertTeachersBelongToOrg(tx: Prisma.TransactionClient, orgId: string, ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return;
    const count = await tx.teacher.count({ where: { id: { in: unique }, organizationId: orgId } });
    if (count !== unique.length) throw new BadRequestException('Some teachers do not belong to this organization');
  }

  private async assertEmployeesBelongToOrg(tx: Prisma.TransactionClient, orgId: string, ids: string[], targetType: FinanceTargetType) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return;
    const role = targetType === FinanceTargetType.SUB_ADMIN ? Role.SUB_ADMIN : targetType === FinanceTargetType.FINANCE_MANAGER ? Role.FINANCE_MANAGER : null;
    if (!role) throw new BadRequestException('Staff target type must be SUB_ADMIN or FINANCE_MANAGER');
    const count = await tx.user.count({ where: { id: { in: unique }, organizationId: orgId, role } });
    if (count !== unique.length) throw new BadRequestException('Some staff users do not belong to this organization or role');
  }

  private validateDateRange(start?: string, end?: string | null, optionalStart = false) {
    if (!start && !optionalStart) throw new BadRequestException('Start date is required');
    const startDate = start ? new Date(start) : undefined;
    const endDate = end ? new Date(end) : end === null ? null : undefined;
    if (startDate && Number.isNaN(startDate.getTime())) throw new BadRequestException('Invalid start date');
    if (endDate && Number.isNaN(endDate.getTime())) throw new BadRequestException('Invalid end date');
    if (startDate && endDate && endDate < startDate) throw new BadRequestException('End date cannot be before start date');
    return { startDate, endDate };
  }

  private validateDueDay(cycle: BillingCycle, dueDay?: number | null) {
    if (cycle === BillingCycle.ONCE) return;
    const value = dueDay ?? 5;
    if (!Number.isInteger(value) || value < 1 || value > 28) throw new BadRequestException('Due day must be between 1 and 28');
  }

  private parseMoney(value: string | number | Prisma.Decimal | undefined, field: string, options: { allowZero: boolean }) {
    if (value === undefined || value === null || value === '') throw new BadRequestException(`${field} is required`);
    const text = typeof value === 'number' ? value.toFixed(2).replace(/\.00$/, '') : String(value).trim();
    if (!MONEY_REGEX.test(text)) throw new BadRequestException(`${field} must be a positive decimal with up to 2 decimal places`);
    const decimal = new Prisma.Decimal(text);
    if (!options.allowZero && decimal.lte(0)) throw new BadRequestException(`${field} must be greater than zero`);
    return decimal;
  }

  private decimal(value: Prisma.Decimal | number | string) {
    return new Prisma.Decimal(value as any);
  }

  private decimalToNumber(value: Prisma.Decimal | number | string) {
    return Number(this.decimal(value).toFixed(2));
  }

  private moneyToString(value: Prisma.Decimal | number | string) {
    return this.decimal(value).toFixed(2);
  }

  private validateReceiptUrl(value?: string) {
    if (!value) return;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsafe');
    } catch {
      throw new BadRequestException('Receipt URL must be a safe http(s) URL');
    }
  }

  private validateText(value: string | undefined, field: string, max: number, optional = false) {
    if (!value && optional) return;
    if (!value?.trim()) throw new BadRequestException(`${field} is required`);
    if (value.length > max) throw new BadRequestException(`${field} must be at most ${max} characters`);
  }

  private validateMetadata(value: unknown) {
    if (value === undefined || value === null) return;
    const text = JSON.stringify(value);
    if (text.length > 8000) throw new BadRequestException('Metadata is too large');
  }

  private normalizePage(value?: number) {
    if (value === undefined || Number.isNaN(value)) return undefined;
    return Math.max(1, Math.floor(value));
  }

  private normalizeLimit(value?: number) {
    if (value === undefined || Number.isNaN(value)) return 10;
    return Math.min(100, Math.max(1, Math.floor(value)));
  }

  private getPeriodForTargetDate(billingCycle: BillingCycle, startDate: Date, endDate: Date | null, targetDate: Date) {
    if (endDate && targetDate > endDate) return null;
    if (targetDate < startDate) return null;

    if (billingCycle === BillingCycle.ONCE) {
      return {
        periodStart: startDate,
        periodEnd: endDate || startDate,
      };
    }

    if (billingCycle === BillingCycle.SEMESTER) {
      const startMonth = targetDate.getMonth() < 6 ? 0 : 6;
      return {
        periodStart: new Date(targetDate.getFullYear(), startMonth, 1),
        periodEnd: new Date(targetDate.getFullYear(), startMonth + 6, 0),
      };
    }

    if (billingCycle === BillingCycle.YEARLY || billingCycle === BillingCycle.ACADEMIC_CYCLE) {
      return {
        periodStart: new Date(targetDate.getFullYear(), 0, 1),
        periodEnd: new Date(targetDate.getFullYear(), 11, 31),
      };
    }

    return {
      periodStart: new Date(targetDate.getFullYear(), targetDate.getMonth(), 1),
      periodEnd: new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0),
    };
  }

  private getDueDate(billingCycle: BillingCycle, periodStart: Date, dueDay: number | null) {
    if (billingCycle === BillingCycle.ONCE) return periodStart;
    return new Date(periodStart.getFullYear(), periodStart.getMonth(), dueDay || 5);
  }

  private formatPeriodLabel(periodStart: Date, billingCycle: BillingCycle) {
    if (billingCycle === BillingCycle.YEARLY || billingCycle === BillingCycle.ACADEMIC_CYCLE) {
      return `${periodStart.getFullYear()}`;
    }
    if (billingCycle === BillingCycle.SEMESTER) {
      return `${periodStart.getFullYear()} ${periodStart.getMonth() < 6 ? 'Spring' : 'Fall'}`;
    }
    return periodStart.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  private async resolvePayrollProfile(user: AuthenticatedRequest['user']) {
    if (user.role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { userId: user.id },
        include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true, avatarUpdatedAt: true } } },
      });
      if (!teacher) throw new NotFoundException('Teacher profile not found');
      return { targetType: FinanceTargetType.TEACHER, teacherId: teacher.id, employeeUserId: undefined, teacher, employee: teacher.user };
    }
    if (user.role === Role.SUB_ADMIN || user.role === Role.FINANCE_MANAGER) {
      const employee = await this.prisma.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, email: true, role: true, avatarUrl: true, avatarUpdatedAt: true } });
      return { targetType: user.role === Role.SUB_ADMIN ? FinanceTargetType.SUB_ADMIN : FinanceTargetType.FINANCE_MANAGER, teacherId: undefined, employeeUserId: user.id, teacher: null, employee };
    }
    throw new ForbiddenException('Payroll overview is only available to employees');
  }

  private buildPayrollOverview(profile: any, structures: any[], entries: any[], transactions: any[]) {
    const now = new Date();
    const activeStructures = structures.filter((structure) => structure.isActive);
    const activeEntries = entries.filter((entry) => entry.status !== EntryStatus.CANCELLED);
    const paidEntries = activeEntries.filter((entry) => entry.status === EntryStatus.PAID);
    const overdueEntries = activeEntries.filter((entry) => this.decimalToNumber(entry.amount) - this.decimalToNumber(entry.paidAmount) > 0 && (entry.status === EntryStatus.OVERDUE || new Date(entry.dueDate) < now));
    const pendingEntries = activeEntries.filter((entry) => this.decimalToNumber(entry.amount) - this.decimalToNumber(entry.paidAmount) > 0 && !overdueEntries.some((overdue) => overdue.id === entry.id));
    const expectedAmount = activeEntries.reduce((sum, entry) => sum + this.decimalToNumber(entry.amount), 0);
    const receivedAmount = activeEntries.reduce((sum, entry) => sum + this.decimalToNumber(entry.paidAmount), 0);
    const overdueAmount = overdueEntries.reduce((sum, entry) => sum + Math.max(this.decimalToNumber(entry.amount) - this.decimalToNumber(entry.paidAmount), 0), 0);
    const pendingAmount = pendingEntries.reduce((sum, entry) => sum + Math.max(this.decimalToNumber(entry.amount) - this.decimalToNumber(entry.paidAmount), 0), 0);
    const assignedSalaryAmount = activeStructures.reduce((sum, structure) => sum + this.decimalToNumber(structure.amount), 0);
    const currency = activeStructures[0]?.currency || activeEntries[0]?.currency || transactions[0]?.currency || 'USD';
    return this.serialize({
      teacher: profile.teacher,
      employee: profile.employee,
      targetType: profile.targetType,
      summary: {
        currency,
        assignedSalaryAmount,
        activeStructureCount: activeStructures.length,
        expectedAmount,
        receivedAmount,
        balanceAmount: Math.max(expectedAmount - receivedAmount, 0),
        overdueAmount,
        overdueCount: overdueEntries.length,
        pendingAmount,
        pendingCount: pendingEntries.length,
        paidCount: paidEntries.length,
        entryCount: activeEntries.length,
      },
      structures: activeStructures,
      recentEntries: entries.slice(0, 8),
      overdueEntries: overdueEntries.slice(0, 8),
      recentTransactions: transactions.slice(0, 8),
    });
  }

  private async buildPayrollRow(orgId: string, targetType: FinanceTargetType, input: { teacherId?: string; employeeUserId?: string; user: unknown }) {
    const [structures, entries, transactions] = await Promise.all([
      this.prisma.financialStructure.findMany({ where: { organizationId: orgId, targetType, assignments: { some: { ...(input.teacherId ? { teacherId: input.teacherId } : { employeeUserId: input.employeeUserId }) } } }, include: this.structureInclude() }),
      this.prisma.financialEntry.findMany({ where: { organizationId: orgId, ...(input.teacherId ? { teacherId: input.teacherId } : { employeeUserId: input.employeeUserId }) }, include: this.entryInclude() }),
      this.prisma.transaction.findMany({ where: { organizationId: orgId, relatedEntry: { ...(input.teacherId ? { teacherId: input.teacherId } : { employeeUserId: input.employeeUserId }) } }, include: { createdBy: { select: { id: true, name: true, email: true, role: true } }, relatedEntry: { include: this.entryInclude() } } }),
    ]);
    const overview = this.buildPayrollOverview({ targetType, teacher: null, employee: input.user }, this.serialize(structures), this.serialize(entries), this.serialize(transactions));
    return { targetType, teacherId: input.teacherId || null, employeeUserId: input.employeeUserId || null, user: input.user, summary: overview.summary };
  }

  private async writeFinanceAudit(tx: Prisma.TransactionClient, inputAction: string, input: {
    audit?: AuditContext;
    organizationId: string;
    targetUserId?: string | null;
    financeStructureId?: string;
    financeEntryId?: string;
    paymentClaimId?: string;
    transactionId?: string;
    resourceType: string;
    resourceId: string;
    details?: Record<string, unknown>;
  }) {
    await tx.auditLog.create({
      data: {
        action: inputAction,
        actorUserId: input.audit?.user.id,
        targetUserId: input.targetUserId || undefined,
        organizationId: input.organizationId,
        module: 'finance',
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        financeStructureId: input.financeStructureId,
        financeEntryId: input.financeEntryId,
        paymentClaimId: input.paymentClaimId,
        transactionId: input.transactionId,
        ip: input.audit?.ip,
        userAgent: input.audit?.headers?.['user-agent'],
        sessionId: input.audit?.user.sessionId,
        details: input.details as Prisma.InputJsonValue,
      },
    });
  }

  private humanizeFinanceAudit(action: string) {
    return action.split('_').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  private asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private serialize<T>(value: T): any {
    if (value === null || value === undefined) return value;
    if ((Prisma.Decimal as any).isDecimal?.(value)) return (value as any).toFixed(2);
    if (value instanceof Date) return value;
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    if (typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, this.serialize(entry)]));
    }
    return value;
  }
}
