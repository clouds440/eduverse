import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums';
import { GpaService } from '../gpa/gpa.service';
import { GpaRounding, Prisma } from '@/prisma/prisma-client';
import { StudentService } from '../students/student.service';

@Injectable()
export class TranscriptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gpaService: GpaService,
    private readonly studentService: StudentService,
  ) {}

  /**
   * Get a student's transcript for a specific academic cycle.
   * Includes: enrollments, grades, attendance summary, cohort info.
   */
  async getStudentTranscript(
    orgId: string,
    studentId: string,
    cycleId?: string,
    user?: { id: string; role: string },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, avatarUpdatedAt: true } },
        cohort: { select: { id: true, name: true } },
      },
    });

    if (!student) throw new NotFoundException('Student not found');

    if (user?.role === Role.GUARDIAN) {
      await this.studentService.assertGuardianCanAccessStudent(orgId, user.id, studentId);
    }

    if (user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER) {
      const assignedEnrollment = await this.prisma.enrollment.findFirst({
        where: {
          studentId,
          section: {
            course: { organizationId: orgId },
            teachers: { some: { userId: user.id } },
          },
        },
        select: { id: true },
      });

      if (!assignedEnrollment) {
        throw new ForbiddenException(
          'You can only view transcripts for students in your assigned sections',
        );
      }
    }

    // Get all academic cycles this student has enrollment history in
    const cycleFilter = cycleId ? { academicCycleId: cycleId } : {};

    const enrollmentHistories = await this.prisma.enrollmentHistory.findMany({
      where: { studentId, ...cycleFilter },
      include: {
        section: {
          include: {
            course: { select: { id: true, name: true, creditHours: true } },
          },
        },
        academicCycle: { select: { id: true, name: true, startDate: true, endDate: true, gpaPolicySnapshot: true } },
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

    // Get finalized grades grouped by section. Draft and published grades are
    // still editable workflow states and must not appear in transcripts.
    const grades = await this.prisma.grade.findMany({
      where: {
        studentId,
        ...(cycleId ? { academicCycleId: cycleId } : {}),
        status: 'FINALIZED',
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
      cycle: { id: string; name: string; startDate: Date; endDate: Date; gpaPolicySnapshot?: Prisma.JsonValue | null } | null;
      sections: Map<string, {
        sectionId: string;
        sectionName: string;
        sectionColor: string | null;
        courseId: string;
        courseName: string;
        creditHours: number;
        enrollmentType: string;
        wasExcluded: boolean;
        grades: Array<{
          assessmentTitle: string;
          assessmentType: string;
          marksObtained: number;
          totalMarks: number;
          weightage: number;
          percentage: number;
          status: string;
        }>;
        attendance: { present: number; absent: number; late: number; excused: number; total: number };
        totalPercentage: number;
        letterGrade: string;
        gradePoints: number;
        qualityPoints: number;
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
          courseId: eh.section.course.id,
          courseName: eh.section.course.name,
          creditHours: eh.section.course.creditHours,
          enrollmentType: eh.source,
          wasExcluded: eh.wasExcluded,
          grades: [],
          attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
          totalPercentage: 0,
          letterGrade: 'N/A',
          gradePoints: 0,
          qualityPoints: 0,
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
        status: grade.status,
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

    const allGpaCourseResults: Array<{
      creditHours: number;
      gradePoints: number;
      qualityPoints: number;
      policyName: string;
      gpaScale: number;
    }> = [];
    const policyNames = new Set<string>();
    const policyScales = new Set<number>();

    // Format response
    const transcript = await Promise.all(Array.from(cycleMap.entries()).map(async ([_, cycleData]) => {
      const sectionValues = Array.from(cycleData.sections.values());
      const gpaEligibleSections = sectionValues.filter((s) => !s.wasExcluded && s.grades.length > 0);
      const gpaPolicy = await this.gpaService.getPolicyForCycle(orgId, cycleData.cycle);
      const cycleGpa = this.gpaService.calculateCourses(
        gpaEligibleSections.map((s) => ({
          courseId: s.courseId,
          courseName: s.courseName,
          sectionId: s.sectionId,
          sectionName: s.sectionName,
          creditHours: s.creditHours,
          percentage: parseFloat(s.totalPercentage.toFixed(2)),
        })),
        gpaPolicy,
      );

      const gpaBySectionId = new Map(cycleGpa.courses.map((course) => [course.sectionId, course]));
      policyNames.add(cycleGpa.summary.policyName);
      policyScales.add(cycleGpa.summary.gpaScale);
      allGpaCourseResults.push(...cycleGpa.courses.map((course) => ({
        creditHours: course.creditHours,
        gradePoints: course.gradePoints,
        qualityPoints: course.qualityPoints,
        policyName: cycleGpa.summary.policyName,
        gpaScale: cycleGpa.summary.gpaScale,
      })));

      const sections = sectionValues.map((s) => {
        const gpaCourse = gpaBySectionId.get(s.sectionId);
        return {
          ...s,
          totalPercentage: parseFloat(s.totalPercentage.toFixed(2)),
          letterGrade: s.wasExcluded || s.grades.length === 0 ? 'N/A' : (gpaCourse?.letterGrade || 'N/A'),
          gradePoints: s.wasExcluded || s.grades.length === 0 ? 0 : (gpaCourse?.gradePoints || 0),
          qualityPoints: s.wasExcluded || s.grades.length === 0 ? 0 : (gpaCourse?.qualityPoints || 0),
        };
      });

      const overallPercentage = sections.length > 0
        ? parseFloat((sections.reduce((sum, s) => sum + s.totalPercentage, 0) / sections.length).toFixed(2))
        : 0;

      return {
        academicCycle: cycleData.cycle,
        cohortName: cycleData.cohortName,
        sections,
        overallPercentage,
        gpa: cycleGpa.summary.gpa,
        totalCreditHours: cycleGpa.summary.totalCreditHours,
        gpaScale: cycleGpa.summary.gpaScale,
        policyName: cycleGpa.summary.policyName,
      };
    }));

    const totalCreditHours = allGpaCourseResults.reduce((sum, course) => sum + course.creditHours, 0);
    const totalQualityPoints = allGpaCourseResults.reduce((sum, course) => sum + course.qualityPoints, 0);
    const cgpa = totalCreditHours > 0 ? totalQualityPoints / totalCreditHours : 0;

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
      summary: {
        cgpa: this.gpaService.applyRounding(cgpa, GpaRounding.TWO_DECIMALS),
        gpaScale: policyScales.values().next().value ?? 4,
        policyName: policyNames.size > 1 ? 'Multiple policies' : (policyNames.values().next().value ?? 'GPA Policy'),
        totalCreditHours: this.gpaService.applyRounding(totalCreditHours, GpaRounding.TWO_DECIMALS),
      },
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
