import { InsightTone, StudentStatus, TeacherStatus } from '../../common/enums';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DashboardInsightGroup } from '../shared/insights.types';

export interface DepartmentActivityPoint {
  department: string;
  courses: number;
  sections: number;
  students: number;
  teachers: number;
  color?: string | null;
}

export interface DepartmentPerformancePoint {
  department: string;
  averageGradePercent: number;
  attendanceRatePercent: number;
  gradedAssessments: number;
  attendanceMarks: number;
  color?: string | null;
}

function formatDepartmentName(department: { name: string; code?: string | null }) {
  return department.code ? `${department.code} - ${department.name}` : department.name;
}

export async function getDepartmentAdminInsights(
  prisma: PrismaService,
  orgId: string,
): Promise<{
  group: DashboardInsightGroup | null;
  chart: DepartmentActivityPoint[];
  performance: DepartmentPerformancePoint[];
}> {
  const [departments, grades, attendanceRecords] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId: orgId, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        color: true,
        courses: {
          select: {
            id: true,
            sections: { select: { id: true } },
          },
        },
        studentPrimaryLinks: {
          where: { status: { not: StudentStatus.DELETED } },
          select: { id: true },
        },
        studentDepartments: {
          where: { student: { status: { not: StudentStatus.DELETED } } },
          select: { studentId: true },
        },
        teacherDepartments: {
          where: { teacher: { status: { not: TeacherStatus.DELETED } } },
          select: { teacherId: true },
        },
      },
      orderBy: [{ name: 'asc' }],
    }),
    prisma.grade.findMany({
      where: {
        assessment: {
          organizationId: orgId,
          totalMarks: { gt: 0 },
          course: { departmentId: { not: null } },
        },
      },
      select: {
        marksObtained: true,
        assessment: {
          select: {
            totalMarks: true,
            course: { select: { departmentId: true } },
          },
        },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        session: {
          section: {
            course: {
              organizationId: orgId,
              departmentId: { not: null },
            },
          },
        },
      },
      select: {
        status: true,
        session: {
          select: {
            section: {
              select: {
                course: { select: { departmentId: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  if (departments.length === 0) {
    return {
      chart: [],
      performance: [],
      group: {
        id: 'department-activity',
        title: 'Department activity',
        description: 'Course, section, student, and teacher distribution by department.',
        items: [{
          id: 'department-empty',
          title: 'No departments created yet',
          description: 'Create departments to compare academic structure and staffing coverage.',
          href: '/departments',
          badge: 'Setup',
          tone: InsightTone.INFO,
        }],
      },
    };
  }

  const chart = departments.map((department) => {
    const studentIds = new Set<string>();
    department.studentPrimaryLinks.forEach((student) => studentIds.add(student.id));
    department.studentDepartments.forEach((link) => studentIds.add(link.studentId));

    return {
      department: formatDepartmentName(department),
      courses: department.courses.length,
      sections: department.courses.reduce((sum, course) => sum + course.sections.length, 0),
      students: studentIds.size,
      teachers: new Set(department.teacherDepartments.map((link) => link.teacherId)).size,
      color: department.color,
    };
  });

  const ranked = [...chart].sort((a, b) => (
    (b.sections + b.students + b.teachers) - (a.sections + a.students + a.teachers)
  ));
  const departmentMeta = new Map(departments.map((department) => [
    department.id,
    {
      department: formatDepartmentName(department),
      color: department.color,
      gradeTotal: 0,
      gradedAssessments: 0,
      attendancePresent: 0,
      attendanceMarks: 0,
    },
  ]));

  grades.forEach((grade) => {
    const departmentId = grade.assessment.course.departmentId;
    if (!departmentId) return;
    const row = departmentMeta.get(departmentId);
    if (!row) return;
    row.gradeTotal += (grade.marksObtained / grade.assessment.totalMarks) * 100;
    row.gradedAssessments += 1;
  });

  attendanceRecords.forEach((record) => {
    const departmentId = record.session.section.course.departmentId;
    if (!departmentId) return;
    const row = departmentMeta.get(departmentId);
    if (!row) return;
    row.attendanceMarks += 1;
    if (record.status === 'PRESENT' || record.status === 'LATE') {
      row.attendancePresent += 1;
    }
  });

  const performance = Array.from(departmentMeta.values())
    .filter((row) => row.gradedAssessments > 0 || row.attendanceMarks > 0)
    .map((row) => ({
      department: row.department,
      averageGradePercent: row.gradedAssessments > 0 ? Number((row.gradeTotal / row.gradedAssessments).toFixed(1)) : 0,
      attendanceRatePercent: row.attendanceMarks > 0 ? Number(((row.attendancePresent / row.attendanceMarks) * 100).toFixed(1)) : 0,
      gradedAssessments: row.gradedAssessments,
      attendanceMarks: row.attendanceMarks,
      color: row.color,
    }))
    .sort((a, b) => {
      const bScore = b.averageGradePercent + b.attendanceRatePercent;
      const aScore = a.averageGradePercent + a.attendanceRatePercent;
      return bScore - aScore;
    })
    .slice(0, 8);

  return {
    chart: ranked.slice(0, 8),
    performance,
    group: null,
  };
}
