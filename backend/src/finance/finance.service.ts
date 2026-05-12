import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialStructureDto, UpdateFinancialStructureDto, CreateManualEntryDto, MarkPaidDto, ConfirmEntryDto } from './finance.dto';
import { EntryStatus, EntrySource, TransactionType, FinanceCategory } from '@prisma/client';
import { Role } from '../common/enums';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) { }

  async createStructure(dto: CreateFinancialStructureDto, user: AuthenticatedRequest['user']) {
    const orgId = dto.organizationId || user.organizationId;
    if (user.role !== Role.SUPER_ADMIN && orgId !== user.organizationId) {
      throw new ForbiddenException('Cannot create structures for a different organization');
    }
    if (!dto.studentId && !dto.teacherId) {
      throw new BadRequestException('Must provide either studentId or teacherId');
    }
    return this.prisma.financialStructure.create({
      data: { ...dto, organizationId: orgId as string }
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
      data: dto,
    });
  }

  async getStructures(orgId: string | undefined, user: AuthenticatedRequest['user'], studentId?: string, teacherId?: string) {
    const finalOrgId = orgId || user.organizationId;
    if (user.role !== Role.SUPER_ADMIN && finalOrgId !== user.organizationId) {
      throw new ForbiddenException('Cannot view structures of a different organization');
    }

    let filterStudentId = studentId;
    let filterTeacherId = teacherId;

    if (user.role === Role.STUDENT) {
      const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
      if (!student) throw new NotFoundException('Student profile not found');
      filterStudentId = student.id;
      filterTeacherId = undefined; // Students cannot see teacher structures
    } else if (user.role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher) throw new NotFoundException('Teacher profile not found');
      filterTeacherId = teacher.id;
      filterStudentId = undefined;
    }

    return this.prisma.financialStructure.findMany({
      where: {
        organizationId: finalOrgId as string,
        ...(filterStudentId ? { studentId: filterStudentId } : {}),
        ...(filterTeacherId ? { teacherId: filterTeacherId } : {}),
      },
    });
  }

  async getEntries(orgId: string | undefined, user: AuthenticatedRequest['user'], studentId?: string, teacherId?: string) {
    const finalOrgId = orgId || user.organizationId;
    if (user.role !== Role.SUPER_ADMIN && finalOrgId !== user.organizationId) {
      throw new ForbiddenException('Cannot view entries of a different organization');
    }

    let filterStudentId = studentId;
    let filterTeacherId = teacherId;

    if (user.role === Role.STUDENT) {
      const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
      if (!student) throw new NotFoundException('Student profile not found');
      filterStudentId = student.id;
      filterTeacherId = undefined;
    } else if (user.role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher) throw new NotFoundException('Teacher profile not found');
      filterTeacherId = teacher.id;
      filterStudentId = undefined;
    }

    return this.prisma.financialEntry.findMany({
      where: {
        organizationId: finalOrgId as string,
        ...(filterStudentId ? { studentId: filterStudentId } : {}),
        ...(filterTeacherId ? { teacherId: filterTeacherId } : {}),
      },
      orderBy: { dueDate: 'desc' },
      include: { structure: true, transactions: true },
    });
  }

  async getTransactions(orgId: string | undefined, user: AuthenticatedRequest['user'], studentId?: string, teacherId?: string) {
    const finalOrgId = orgId || user.organizationId;
    if (user.role !== Role.SUPER_ADMIN && finalOrgId !== user.organizationId) {
      throw new ForbiddenException('Cannot view transactions of a different organization');
    }

    let filterStudentId = studentId;
    let filterTeacherId = teacherId;

    if (user.role === Role.STUDENT) {
      const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
      if (!student) throw new NotFoundException('Student profile not found');
      filterStudentId = student.id;
      filterTeacherId = undefined;
    } else if (user.role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher) throw new NotFoundException('Teacher profile not found');
      filterTeacherId = teacher.id;
      filterStudentId = undefined;
    }

    return this.prisma.transaction.findMany({
      where: {
        organizationId: finalOrgId as string,
        ...(filterStudentId || filterTeacherId ? {
          relatedEntry: {
            ...(filterStudentId ? { studentId: filterStudentId } : {}),
            ...(filterTeacherId ? { teacherId: filterTeacherId } : {}),
          }
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { relatedEntry: { include: { structure: true } } },
    });
  }

  async getStats(orgId: string | undefined, user: AuthenticatedRequest['user']) {
    const finalOrgId = orgId || user.organizationId;
    if (user.role !== Role.SUPER_ADMIN && finalOrgId !== user.organizationId) {
      throw new ForbiddenException('Cannot view stats of a different organization');
    }

    let filterStudentId: string | undefined = undefined;
    let filterTeacherId: string | undefined = undefined;

    if (user.role === Role.STUDENT) {
      const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
      if (student) filterStudentId = student.id;
    } else if (user.role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (teacher) filterTeacherId = teacher.id;
    }

    const baseEntryWhere = {
      organizationId: finalOrgId as string,
      ...(filterStudentId ? { studentId: filterStudentId } : {}),
      ...(filterTeacherId ? { teacherId: filterTeacherId } : {}),
    };

    const entries = await this.prisma.financialEntry.findMany({
      where: baseEntryWhere,
      select: { amount: true, paidAmount: true, status: true, dueDate: true, studentId: true, teacherId: true }
    });

    const now = new Date();

    let totalExpectedIncome = 0;
    let totalCollectedIncome = 0;
    let overdueAmount = 0;
    let pendingConfirmations = 0;
    let totalSalaryExpenses = 0;

    for (const entry of entries) {
      if (entry.studentId) {
        totalExpectedIncome += entry.amount;
        totalCollectedIncome += entry.paidAmount;

        if (entry.status === EntryStatus.PENDING || entry.status === EntryStatus.PARTIAL) {
          if (entry.dueDate < now) {
            overdueAmount += (entry.amount - entry.paidAmount);
          }
        }
        if (entry.status === EntryStatus.UNVERIFIED) {
          pendingConfirmations++;
        }
      } else if (entry.teacherId) {
        totalSalaryExpenses += entry.amount;
      }
    }

    const recentTransactions = await this.getTransactions(orgId, user, filterStudentId, filterTeacherId);

    return {
      totalExpectedIncome,
      totalCollectedIncome,
      overdueAmount,
      totalSalaryExpenses,
      pendingConfirmations,
      recentTransactions: recentTransactions.slice(0, 5)
    };
  }

  async createManualEntry(dto: CreateManualEntryDto, user: AuthenticatedRequest['user']) {
    const orgId = dto.organizationId || user.organizationId;
    if (user.role !== Role.SUPER_ADMIN && orgId !== user.organizationId) {
      throw new ForbiddenException('Cannot create entries for a different organization');
    }
    if (!dto.studentId && !dto.teacherId) {
      throw new BadRequestException('Must provide either studentId or teacherId');
    }
    return this.prisma.financialEntry.create({
      data: {
        ...dto,
        organizationId: orgId as string,
        source: EntrySource.MANUAL,
        status: EntryStatus.PENDING,
      },
    });
  }

  async markEntryPaid(id: string, user: AuthenticatedRequest['user'], dto: MarkPaidDto) {
    const entry = await this.prisma.financialEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Entry not found');

    if (user.role === Role.STUDENT) {
      const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
      if (!student || entry.studentId !== student.id) {
        throw new ForbiddenException('You can only mark your own entries as paid');
      }
    } else if (user.role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher || entry.teacherId !== teacher.id) {
        throw new ForbiddenException('You can only mark your own entries as paid');
      }
    } else if (user.role !== Role.SUPER_ADMIN && entry.organizationId !== user.organizationId) {
      throw new ForbiddenException('Cannot modify entries of a different organization');
    }

    return this.prisma.financialEntry.update({
      where: { id },
      data: {
        status: EntryStatus.UNVERIFIED,
        markedByUser: true,
        markedAt: new Date(),
        paymentMethod: dto.paymentMethod,
        receiptUrl: dto.receiptUrl,
      },
    });
  }

  async confirmEntry(id: string, user: AuthenticatedRequest['user'], dto: ConfirmEntryDto) {
    const entry = await this.prisma.financialEntry.findUnique({ where: { id }, include: { structure: true } });
    if (!entry) throw new NotFoundException('Entry not found');

    if (user.role !== Role.SUPER_ADMIN && entry.organizationId !== user.organizationId) {
      throw new ForbiddenException('Cannot confirm entries of a different organization');
    }

    if (entry.status === EntryStatus.PAID) {
      throw new ConflictException('This entry is already fully paid.');
    }

    const amountPaid = dto.paidAmount ?? (entry.amount - entry.paidAmount);
    if (amountPaid <= 0) {
      throw new BadRequestException('Amount paid must be greater than zero.');
    }

    const newPaidAmount = entry.paidAmount + amountPaid;
    const isPartial = newPaidAmount < entry.amount;

    const newStatus = isPartial ? EntryStatus.PARTIAL : EntryStatus.PAID;
    const type = entry.studentId ? TransactionType.INCOME : TransactionType.EXPENSE;
    const category = entry.structure?.category || FinanceCategory.OTHER;

    return this.prisma.$transaction(async (tx) => {
      // Find row without modifying so tx can proceed safely if concurrent update happens 
      // (Since findUnique inside transaction usually acts as snapshot, and update handles conflicts in serializable)
      const lockedEntry = await tx.financialEntry.findUnique({
        where: { id }
      });

      if (!lockedEntry || lockedEntry.status === EntryStatus.PAID) {
        throw new ConflictException('Entry was modified concurrently.');
      }

      const updatedEntry = await tx.financialEntry.update({
        where: { id },
        data: {
          status: newStatus,
          paidAmount: { increment: amountPaid },
          confirmedByAdmin: true,
          confirmedAt: new Date(),
          confirmedById: user.id,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          organizationId: entry.organizationId,
          type,
          category,
          amount: amountPaid,
          currency: entry.structure?.currency || 'USD',
          description: `Confirmed payment for ${entry.title}`,
          relatedEntryId: entry.id,
          paymentMethod: entry.paymentMethod,
          createdById: user.id,
        },
      });

      return { entry: updatedEntry, transaction };
    });
  }
}
