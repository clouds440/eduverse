import { EntryStatus, FinanceTargetType } from '@/prisma/prisma-client';
import { buildDepartmentFinanceRows, resolveEntryDepartmentAllocations } from './department-finance-insights.helper';

const cs = { id: 'dept-cs', name: 'Computer Science', code: 'CS' };
const math = { id: 'dept-math', name: 'Mathematics', code: 'MATH' };
const history = { id: 'dept-history', name: 'History', code: null };

describe('department finance insights helpers', () => {
  it('prefers student primary department over secondary department links', () => {
    const allocations = resolveEntryDepartmentAllocations({
      student: {
        primaryDepartment: cs,
        studentDepartments: [{ department: math }],
      },
    });

    expect(allocations).toEqual([{
      departmentId: cs.id,
      department: 'CS - Computer Science',
      weight: 1,
      estimated: false,
    }]);
  });

  it('splits student finance entries equally when multiple departments are linked without a primary department', () => {
    const rows = buildDepartmentFinanceRows([
      {
        amount: 1000,
        paidAmount: 400,
        dueDate: new Date('2026-01-15'),
        status: EntryStatus.PENDING,
        structure: { targetType: FinanceTargetType.STUDENT },
        assignment: null,
        teacherId: null,
        student: {
          primaryDepartment: null,
          studentDepartments: [{ department: cs }, { department: math }],
        },
      },
    ], new Date('2026-01-01'));

    expect(rows).toHaveLength(2);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        departmentId: cs.id,
        expectedAmount: 500,
        collectedAmount: 200,
        pendingAmount: 300,
        overdueAmount: 0,
        collectionRatePercent: 40,
        estimated: true,
      }),
      expect.objectContaining({
        departmentId: math.id,
        expectedAmount: 500,
        collectedAmount: 200,
        pendingAmount: 300,
        overdueAmount: 0,
        collectionRatePercent: 40,
        estimated: true,
      }),
    ]));
  });

  it('counts overdue outstanding amounts by department', () => {
    const rows = buildDepartmentFinanceRows([
      {
        amount: 800,
        paidAmount: 300,
        dueDate: new Date('2026-01-01'),
        status: EntryStatus.PENDING,
        structure: { targetType: FinanceTargetType.STUDENT },
        assignment: null,
        teacherId: null,
        student: {
          primaryDepartment: history,
          studentDepartments: [],
        },
      },
    ], new Date('2026-02-01'));

    expect(rows).toEqual([
      expect.objectContaining({
        departmentId: history.id,
        expectedAmount: 800,
        collectedAmount: 300,
        pendingAmount: 0,
        overdueAmount: 500,
        collectionRatePercent: 37.5,
        estimated: false,
      }),
    ]);
  });

  it('skips teacher and other expense entries for collection reporting', () => {
    const rows = buildDepartmentFinanceRows([
      {
        amount: 1200,
        paidAmount: 1200,
        dueDate: new Date('2026-01-01'),
        status: EntryStatus.PAID,
        structure: { targetType: FinanceTargetType.TEACHER },
        assignment: null,
        teacherId: 'teacher-1',
        teacher: {
          teacherDepartments: [{ department: cs }],
        },
      },
      {
        amount: 600,
        paidAmount: 0,
        dueDate: new Date('2026-01-01'),
        status: EntryStatus.PENDING,
        structure: { targetType: FinanceTargetType.OTHER_EXPENSE },
        assignment: null,
        teacherId: null,
      },
    ]);

    expect(rows).toEqual([]);
  });
});
