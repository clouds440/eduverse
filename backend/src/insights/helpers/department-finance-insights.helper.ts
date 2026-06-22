import { EntryStatus, FinanceTargetType } from '@/prisma/prisma-client';
import { InsightTone } from '../../common/enums';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DashboardInsightGroup } from '../shared/insights.types';

export interface DepartmentFinanceRow {
  departmentId: string;
  department: string;
  expectedAmount: number;
  collectedAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  collectionRatePercent: number;
  estimated: boolean;
}

interface DepartmentAllocation {
  departmentId: string;
  department: string;
  weight: number;
  estimated: boolean;
}

type DepartmentLike = { id: string; name: string; code?: string | null };

function formatDepartmentName(department: DepartmentLike) {
  return department.code ? `${department.code} - ${department.name}` : department.name;
}

function uniqueDepartments(departments: DepartmentLike[]): DepartmentLike[] {
  const seen = new Set<string>();
  return departments.filter((department) => {
    if (seen.has(department.id)) return false;
    seen.add(department.id);
    return true;
  });
}

export function resolveEntryDepartmentAllocations(entry: {
  student?: {
    primaryDepartment?: DepartmentLike | null;
    studentDepartments?: Array<{ department: DepartmentLike }>;
  } | null;
  teacher?: {
    teacherDepartments?: Array<{ department: DepartmentLike }>;
  } | null;
}): DepartmentAllocation[] {
  if (entry.student?.primaryDepartment) {
    return [{
      departmentId: entry.student.primaryDepartment.id,
      department: formatDepartmentName(entry.student.primaryDepartment),
      weight: 1,
      estimated: false,
    }];
  }

  const studentDepartments = uniqueDepartments(
    entry.student?.studentDepartments?.map((link) => link.department) || [],
  );
  if (studentDepartments.length > 0) {
    const weight = 1 / studentDepartments.length;
    return studentDepartments.map((department) => ({
      departmentId: department.id,
      department: formatDepartmentName(department),
      weight,
      estimated: studentDepartments.length > 1,
    }));
  }

  const teacherDepartments = uniqueDepartments(
    entry.teacher?.teacherDepartments?.map((link) => link.department) || [],
  );
  if (teacherDepartments.length > 0) {
    const weight = 1 / teacherDepartments.length;
    return teacherDepartments.map((department) => ({
      departmentId: department.id,
      department: formatDepartmentName(department),
      weight,
      estimated: teacherDepartments.length > 1,
    }));
  }

  return [];
}

export function buildDepartmentFinanceRows(
  entries: Array<{
    amount: number;
    paidAmount: number;
    dueDate: Date;
    status: EntryStatus;
    structure?: { targetType?: FinanceTargetType | null } | null;
    assignment?: { targetType?: FinanceTargetType | null } | null;
    teacherId?: string | null;
    student?: {
      primaryDepartment?: DepartmentLike | null;
      studentDepartments?: Array<{ department: DepartmentLike }>;
    } | null;
    teacher?: {
      teacherDepartments?: Array<{ department: DepartmentLike }>;
    } | null;
  }>,
  now = new Date(),
): DepartmentFinanceRow[] {
  const rows = new Map<string, DepartmentFinanceRow>();

  entries.forEach((entry) => {
    const targetType = entry.assignment?.targetType || entry.structure?.targetType;
    const isExpense = targetType === FinanceTargetType.TEACHER
      || targetType === FinanceTargetType.OTHER_EXPENSE
      || Boolean(entry.teacherId);
    if (isExpense) return;

    const allocations = resolveEntryDepartmentAllocations(entry);
    if (allocations.length === 0) return;

    const outstanding = Math.max(entry.amount - entry.paidAmount, 0);
    const isOverdue = outstanding > 0 && (entry.status === EntryStatus.OVERDUE || entry.dueDate < now);
    const isPending = outstanding > 0 && !isOverdue;

    allocations.forEach((allocation) => {
      const existing = rows.get(allocation.departmentId) || {
        departmentId: allocation.departmentId,
        department: allocation.department,
        expectedAmount: 0,
        collectedAmount: 0,
        pendingAmount: 0,
        overdueAmount: 0,
        collectionRatePercent: 100,
        estimated: false,
      };

      existing.expectedAmount += entry.amount * allocation.weight;
      existing.collectedAmount += entry.paidAmount * allocation.weight;
      if (isOverdue) existing.overdueAmount += outstanding * allocation.weight;
      if (isPending) existing.pendingAmount += outstanding * allocation.weight;
      existing.estimated = existing.estimated || allocation.estimated;
      rows.set(allocation.departmentId, existing);
    });
  });

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      collectionRatePercent: row.expectedAmount > 0
        ? (row.collectedAmount / row.expectedAmount) * 100
        : 100,
    }))
    .sort((a, b) => {
      if (b.overdueAmount !== a.overdueAmount) return b.overdueAmount - a.overdueAmount;
      return b.expectedAmount - a.expectedAmount;
    });
}

export async function getDepartmentFinanceInsights(
  prisma: PrismaService,
  orgId: string,
  currency: string,
): Promise<{
  group: DashboardInsightGroup | null;
  chart: DepartmentFinanceRow[];
}> {
  const [departmentsCount, entries] = await Promise.all([
    prisma.department.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.financialEntry.findMany({
      where: {
        organizationId: orgId,
        status: { not: EntryStatus.CANCELLED },
        OR: [
          { structure: { currency } },
          { structureId: null },
        ],
      },
      include: {
        structure: { select: { targetType: true, currency: true } },
        assignment: { select: { targetType: true } },
        student: {
          select: {
            primaryDepartment: { select: { id: true, name: true, code: true } },
            studentDepartments: {
              select: { department: { select: { id: true, name: true, code: true } } },
            },
          },
        },
        teacher: {
          select: {
            teacherDepartments: {
              select: { department: { select: { id: true, name: true, code: true } } },
            },
          },
        },
      },
    }),
  ]);

  if (departmentsCount === 0) {
    return {
      chart: [],
      group: {
        id: 'department-finance',
        title: 'Department collection',
        description: 'Receivables grouped by student department ownership.',
        items: [{
          id: 'department-finance-empty-departments',
          title: 'No departments created yet',
          description: 'Create departments before comparing collection health by department.',
          href: '/departments',
          badge: 'Setup',
          tone: InsightTone.INFO,
        }],
      },
    };
  }

  const rows = buildDepartmentFinanceRows(entries);
  if (rows.length === 0) {
    return {
      chart: [],
      group: {
        id: 'department-finance',
        title: 'Department collection',
        description: 'Receivables grouped by student department ownership.',
        items: [{
          id: 'department-finance-empty-data',
          title: 'No department finance data available',
          description: 'Entries need student department context before department collection can be compared.',
          href: '/finance/entries',
          badge: 'No data',
          tone: InsightTone.INFO,
        }],
      },
    };
  }

  return {
    chart: rows.slice(0, 8),
    group: null,
  };
}
