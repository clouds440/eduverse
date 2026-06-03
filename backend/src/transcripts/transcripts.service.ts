import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums';

@Injectable()
export class TranscriptsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get a student's transcript for a specific academic cycle.
   * Includes: enrollments, grades, attendance summary, cohort info.
   */
  async getStudentTranscript(orgId: string, studentId: string, cycleId?: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, avatarUpdatedAt: true } },
        cohort: { select: { id: true, name: true } },
      },
    });

    if (!student) throw new NotFoundException('Student not found');

    // Get all academic cycles this student has enrollment history in
    const cycleFilter = cycleId ? { academicCycleId: cycleId } : {};

    const enrollmentHistories = await this.prisma.enrollmentHistory.findMany({
      where: { studentId, ...cycleFilter },
      include: {
        section: {
          include: {
            course: { select: { id: true, name: true } },
          },
        },
        academicCycle: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
      orderBy: { enrolledAt: 'asc' },
    });

    const cohortHistory = await this.prisma.cohortMembershipHistory.findMany({
      where: { studentId, ...cycleFilter },
      include: {
        cohort: { select: { id: true, name: true } },
        academicCycle: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    // Get grades grouped by section
    const grades = await this.prisma.grade.findMany({
      where: {
        studentId,
        ...(cycleId ? { academicCycleId: cycleId } : {}),
        status: { in: ['PUBLISHED', 'FINALIZED'] },
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            type: true,
            totalMarks: true,
            weightage: true,
            sectionId: true,
          },
        },
      },
    });

    // Get attendance summary per section
    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        session: {
          ...(cycleId ? { academicCycleId: cycleId } : {}),
          section: { course: { organizationId: orgId } },
        },
      },
      include: {
        session: {
          select: { sectionId: true, academicCycleId: true },
        },
      },
    });

    // Group data by academic cycle
    const cycleMap = new Map<string, {
      cycle: { id: string; name: string; startDate: Date; endDate: Date } | null;
      sections: Map<string, {
        sectionId: string;
        sectionName: string;
        sectionColor: string | null;
        courseName: string;
        enrollmentType: string;
        wasExcluded: boolean;
        grades: Array<{
          assessmentTitle: string;
          assessmentType: string;
          marksObtained: number;
          totalMarks: number;
          weightage: number;
          percentage: number;
        }>;
        attendance: { present: number; absent: number; late: number; excused: number; total: number };
        totalPercentage: number;
      }>;
      cohortName: string | null;
    }>();

    // Build section data from enrollment history
    for (const eh of enrollmentHistories) {
      const cId = eh.academicCycleId || 'unassigned';
      if (!cycleMap.has(cId)) {
        cycleMap.set(cId, {
          cycle: eh.academicCycle,
          sections: new Map(),
          cohortName: null,
        });
      }

      const cycleData = cycleMap.get(cId)!;
      if (!cycleData.sections.has(eh.sectionId)) {
        cycleData.sections.set(eh.sectionId, {
          sectionId: eh.sectionId,
          sectionName: eh.section.name,
          sectionColor: eh.section.color,
          courseName: eh.section.course.name,
          enrollmentType: eh.source,
          wasExcluded: eh.wasExcluded,
          grades: [],
          attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
          totalPercentage: 0,
        });
      }
    }

    // Fill in cohort names
    for (const ch of cohortHistory) {
      const cId = ch.academicCycleId || 'unassigned';
      if (cycleMap.has(cId)) {
        cycleMap.get(cId)!.cohortName = ch.cohort.name;
      }
    }

    // Fill in grades
    for (const grade of grades) {
      const a = grade.assessment;
      const cId = grade.academicCycleId || 'unassigned';
      const cycleData = cycleMap.get(cId);
      if (!cycleData) continue;

      const sectionData = cycleData.sections.get(a.sectionId);
      if (!sectionData) continue;

      const percentage = (grade.marksObtained / a.totalMarks) * a.weightage;
      sectionData.grades.push({
        assessmentTitle: a.title,
        assessmentType: a.type,
        marksObtained: grade.marksObtained,
        totalMarks: a.totalMarks,
        weightage: a.weightage,
        percentage: parseFloat(percentage.toFixed(2)),
      });
      sectionData.totalPercentage += percentage;
    }

    // Fill in attendance
    for (const record of attendanceRecords) {
      const cId = record.session.academicCycleId || 'unassigned';
      const cycleData = cycleMap.get(cId);
      if (!cycleData) continue;

      const sectionData = cycleData.sections.get(record.session.sectionId);
      if (!sectionData) continue;

      sectionData.attendance.total++;
      switch (record.status) {
        case 'PRESENT': sectionData.attendance.present++; break;
        case 'ABSENT': sectionData.attendance.absent++; break;
        case 'LATE': sectionData.attendance.late++; break;
        case 'EXCUSED': sectionData.attendance.excused++; break;
      }
    }

    // Format response
    const transcript = Array.from(cycleMap.entries()).map(([_, cycleData]) => {
      const sections = Array.from(cycleData.sections.values()).map((s) => ({
        ...s,
        totalPercentage: parseFloat(s.totalPercentage.toFixed(2)),
      }));

      const overallPercentage = sections.length > 0
        ? parseFloat((sections.reduce((sum, s) => sum + s.totalPercentage, 0) / sections.length).toFixed(2))
        : 0;

      return {
        academicCycle: cycleData.cycle,
        cohortName: cycleData.cohortName,
        sections,
        overallPercentage,
      };
    });

    return {
      student: {
        id: student.id,
        name: student.user.name,
        email: student.user.email,
        avatarUrl: student.user.avatarUrl,
        avatarUpdatedAt: student.user.avatarUpdatedAt,
        registrationNumber: student.registrationNumber,
        rollNumber: student.rollNumber,
        currentCohort: student.cohort,
      },
      transcript,
    };
  }

  /**
   * Get transcript across all cycles for a student.
   */
  async getStudentTranscriptAllCycles(orgId: string, studentId: string) {
    return this.getStudentTranscript(orgId, studentId);
  }

  /**
   * Get a summary report for all students in a given academic cycle.
   */
  async getCycleReport(orgId: string, cycleId: string) {
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id: cycleId, organizationId: orgId },
    });
    if (!cycle) throw new NotFoundException('Academic cycle not found');

    // Get all enrollments for this cycle
    const enrollments = await this.prisma.enrollment.findMany({
      where: { academicCycleId: cycleId },
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        section: {
          include: { course: { select: { name: true } } },
        },
      },
    });

    // Get unique students
    const studentMap = new Map<string, {
      studentId: string;
      name: string | null;
      email: string;
      registrationNumber: string;
      sectionsCount: number;
      enrollmentTypes: Set<string>;
    }>();

    for (const enrollment of enrollments) {
      if (!studentMap.has(enrollment.studentId)) {
        studentMap.set(enrollment.studentId, {
          studentId: enrollment.studentId,
          name: enrollment.student.user.name,
          email: enrollment.student.user.email,
          registrationNumber: enrollment.student.registrationNumber,
          sectionsCount: 0,
          enrollmentTypes: new Set(),
        });
      }
      const s = studentMap.get(enrollment.studentId)!;
      s.sectionsCount++;
      s.enrollmentTypes.add(enrollment.source);
    }

    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
      },
      totalStudents: studentMap.size,
      totalEnrollments: enrollments.length,
      students: Array.from(studentMap.values()).map((s) => ({
        ...s,
        enrollmentTypes: Array.from(s.enrollmentTypes),
      })),
    };
  }
}
