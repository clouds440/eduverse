import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus, EntryStatus, GradeStatus, Prisma, TargetType } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums';
import { fuzzyFilterAndRank } from '../common/utils';
import { UserService } from '../users/user.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';

function moneyNumber(value: unknown): number {
  if (value && typeof value === 'object' && 'toString' in value) {
    return Number((value as { toString(): string }).toString());
  }
  return Number(value || 0);
}

type GuardianStudentForInsight = {
  id: string;
  registrationNumber: string | null;
  rollNumber: string | null;
  status?: string | null;
  guardianRelationship?: string | null;
  cohort?: { name: string | null } | null;
  user?: {
    name: string | null;
    avatarUrl?: string | null;
    avatarUpdatedAt?: Date | string | null;
  } | null;
};

type GuardianStudentInsightSummary = {
  attendance: { rate: number | null };
  sections: unknown[];
  assessments: { upcomingCount: number };
  timetable: { todayCount: number };
  finance: { balance: number; overdueAmount: number; overdueCount: number };
};

type GuardianWithStudentLinks = {
  id?: string;
  studentLinks?: Array<{
    relationshipLabel: string | null;
    student: GuardianStudentForInsight & Record<string, unknown>;
  }>;
};

type NormalizedGuardian<T extends GuardianWithStudentLinks> = Omit<T, 'studentLinks'> & {
  studentLinks: NonNullable<T['studentLinks']>;
  students: GuardianStudentForInsight[];
};

@Injectable()
export class GuardiansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async createGuardian(orgId: string, data: CreateGuardianDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const linkedStudentIds = await this.assertLinkedStudentsBelongToOrg(tx, orgId, data.linkedStudentIds);
        const user = await this.userService.createUser(
          {
            email: data.email,
            password: data.password,
            role: Role.GUARDIAN,
            organizationId: orgId,
            name: data.name,
            phone: data.phone,
            status: data.status,
          },
          tx,
        );

        const guardian = await tx.guardianProfile.create({
          data: {
            userId: user.id,
            organizationId: orgId,
            phone: data.phone,
            address: data.address,
          },
          include: this.guardianInclude(),
        });

        for (const studentId of linkedStudentIds) {
          await tx.guardianStudent.upsert({
            where: { studentId },
            create: {
              guardianId: guardian.id,
              studentId,
              organizationId: orgId,
              relationshipLabel: 'Guardian',
            },
            update: {
              guardianId: guardian.id,
              organizationId: orgId,
              relationshipLabel: 'Guardian',
            },
          });
        }

        if (linkedStudentIds.length) {
          const linkedGuardian = await tx.guardianProfile.findUnique({
            where: { id: guardian.id },
            include: this.guardianInclude(),
          });
          return this.normalizeGuardian(linkedGuardian);
        }

        return this.normalizeGuardian(guardian);
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Guardian account already exists');
      }
      console.error('[CreateGuardian Error]:', error);
      throw new InternalServerErrorException(
        'An unexpected error occurred while creating the guardian account',
      );
    }
  }

  async getGuardians(orgId: string, search?: string) {
    const baseWhere: Prisma.GuardianProfileWhereInput = {
      organizationId: orgId,
    };
    const searchWhere: Prisma.GuardianProfileWhereInput = search
      ? {
          OR: [
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const where: Prisma.GuardianProfileWhereInput = { ...baseWhere, ...searchWhere };

    const guardians = await this.prisma.guardianProfile.findMany({
      where,
      include: this.guardianInclude(),
      orderBy: { createdAt: 'desc' },
    });

    if (search && guardians.length === 0) {
      const candidates = await this.prisma.guardianProfile.findMany({
        where: baseWhere,
        take: 500,
        include: this.guardianInclude(),
        orderBy: { createdAt: 'desc' },
      });
      const ranked = fuzzyFilterAndRank(candidates, search, (guardian) => [
        guardian.user?.name,
        guardian.user?.email,
        guardian.user?.phone,
        guardian.phone,
        guardian.address,
        ...(guardian.studentLinks || []).flatMap((link) => [
          link.student?.user?.name,
          link.student?.registrationNumber,
          link.student?.rollNumber,
        ]),
      ]);
      return ranked.map((guardian) => this.normalizeGuardian(guardian));
    }

    return guardians.map((guardian) => this.normalizeGuardian(guardian));
  }

  async getGuardian(orgId: string, id: string) {
    const guardian = await this.prisma.guardianProfile.findFirst({
      where: { id, organizationId: orgId },
      include: this.guardianInclude(),
    });

    if (!guardian) throw new NotFoundException('Guardian not found');
    return this.normalizeGuardian(guardian);
  }

  async updateGuardian(orgId: string, id: string, data: UpdateGuardianDto) {
    const guardian = await this.prisma.guardianProfile.findFirst({
      where: { id, organizationId: orgId },
      include: { user: true },
    });

    if (!guardian) throw new NotFoundException('Guardian not found');

    const userData: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) userData.name = data.name;
    if (data.email !== undefined) userData.email = data.email;
    if (data.phone !== undefined) userData.phone = data.phone;
    if (data.password !== undefined && data.password.trim() !== '') {
      userData.password = data.password;
    }
    if (data.status !== undefined) userData.status = data.status;

    const profileData: Prisma.GuardianProfileUpdateInput = {};
    if (data.phone !== undefined) profileData.phone = data.phone;
    if (data.address !== undefined) profileData.address = data.address;
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await this.userService.updateUser(guardian.userId, userData, tx);
      }
      if (Object.keys(profileData).length > 0) {
        await tx.guardianProfile.update({
          where: { id },
          data: profileData,
        });
      }
    });

    return this.getGuardian(orgId, id);
  }

  async getMyGuardianProfile(orgId: string, userId: string) {
    const guardian = await this.prisma.guardianProfile.findFirst({
      where: { userId, organizationId: orgId },
      include: this.guardianInclude(),
    });

    if (!guardian) throw new NotFoundException('Guardian profile not found');
    return this.normalizeGuardian(guardian);
  }

  async getMyOverview(orgId: string, userId: string, studentId?: string) {
    const guardian = await this.getMyGuardianProfile(orgId, userId);
    const linkedStudents = guardian.students;
    const now = new Date();
    const studentInsights = await Promise.all(
      linkedStudents.map((student) => this.buildStudentInsight(orgId, student, now)),
    );
    const overviewTotals = this.buildOverviewTotals(studentInsights);
    const selectedStudent = studentId
      ? linkedStudents.find((student) => student.id === studentId)
      : linkedStudents[0];

    if (studentId && !selectedStudent) {
      throw new ForbiddenException(
        'You can only view students linked to your guardian account',
      );
    }

    if (!selectedStudent) {
      return {
        guardian,
        linkedStudents,
        selectedStudent: null,
        studentInsights,
        overviewTotals,
        attendanceSummary: null,
        recentGrades: [],
        upcomingAssessments: [],
        upcomingSchedule: [],
        financeSummary: null,
        recentFinanceEntries: [],
        recentAnnouncements: [],
      };
    }

    const selectedInsight = studentInsights.find((insight) => insight.studentId === selectedStudent.id) ?? null;
    const enrolledSections = await this.prisma.enrollment.findMany({
      where: {
        studentId: selectedStudent.id,
        isExcludedFromCohort: false,
      },
      select: { sectionId: true },
    });
    const sectionIds = enrolledSections.map((enrollment) => enrollment.sectionId);

    const [
      attendanceRecords,
      recentGrades,
      upcomingAssessments,
      upcomingSchedule,
      recentFinanceEntries,
      recentAnnouncements,
    ] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { studentId: selectedStudent.id },
        include: {
          session: {
            select: {
              date: true,
              startTime: true,
              endTime: true,
              section: { select: { id: true, name: true, course: { select: { name: true } } } },
            },
          },
        },
        orderBy: { session: { date: 'desc' } },
        take: 30,
      }),
      this.prisma.grade.findMany({
        where: {
          studentId: selectedStudent.id,
          status: { in: [GradeStatus.PUBLISHED, GradeStatus.FINALIZED] },
        },
        include: {
          assessment: {
            select: {
              id: true,
              title: true,
              type: true,
              totalMarks: true,
              weightage: true,
              section: { select: { id: true, name: true, course: { select: { name: true } } } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      sectionIds.length
        ? this.prisma.assessment.findMany({
            where: {
              organizationId: orgId,
              sectionId: { in: sectionIds },
              dueDate: { gte: now },
            },
            include: {
              section: { select: { id: true, name: true, course: { select: { name: true } } } },
            },
            orderBy: { dueDate: 'asc' },
            take: 8,
          })
        : Promise.resolve([]),
      sectionIds.length
        ? this.prisma.sectionSchedule.findMany({
            where: { sectionId: { in: sectionIds } },
            include: {
              section: { select: { id: true, name: true, course: { select: { name: true } } } },
            },
            orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
            take: 12,
          })
        : Promise.resolve([]),
      this.prisma.financialEntry.findMany({
        where: { organizationId: orgId, studentId: selectedStudent.id },
        orderBy: { dueDate: 'desc' },
        take: 8,
      }),
      this.prisma.announcement.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { targetType: TargetType.GLOBAL },
            { targetType: TargetType.ORG },
            { targetType: TargetType.ROLE, targetId: Role.GUARDIAN },
            { targetType: TargetType.ROLE, targetId: Role.STUDENT },
            ...(sectionIds.length
              ? [{ targetType: TargetType.SECTION, targetId: { in: sectionIds } }]
              : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

    const attendanceSummary = attendanceRecords.reduce(
      (summary, record) => ({
        total: summary.total + 1,
        present: summary.present + (record.status === AttendanceStatus.PRESENT ? 1 : 0),
        absent: summary.absent + (record.status === AttendanceStatus.ABSENT ? 1 : 0),
        late: summary.late + (record.status === AttendanceStatus.LATE ? 1 : 0),
        excused: summary.excused + (record.status === AttendanceStatus.EXCUSED ? 1 : 0),
      }),
      { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
    );

    const totalDue = recentFinanceEntries.reduce((sum, entry) => sum + moneyNumber(entry.amount), 0);
    const totalPaid = recentFinanceEntries.reduce((sum, entry) => sum + moneyNumber(entry.paidAmount), 0);

    return {
      guardian,
      linkedStudents,
      selectedStudent,
      studentInsights,
      overviewTotals,
      selectedInsight,
      attendanceSummary,
      recentAttendance: attendanceRecords,
      recentGrades,
      upcomingAssessments,
      upcomingSchedule,
      financeSummary: {
        totalDue,
        totalPaid,
        balance: Math.max(totalDue - totalPaid, 0),
      },
      recentFinanceEntries,
      recentAnnouncements,
    };
  }

  private async buildStudentInsight(orgId: string, student: GuardianStudentForInsight, now: Date) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        isExcludedFromCohort: false,
      },
      include: {
        section: {
          select: {
            id: true,
            name: true,
            room: true,
            color: true,
            course: { select: { id: true, name: true, creditHours: true } },
            academicCycle: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });
    const sectionIds = enrollments.map((enrollment) => enrollment.sectionId);

    const [
      attendanceRecords,
      grades,
      upcomingAssessments,
      schedules,
      financeEntries,
      announcementsCount,
    ] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { studentId: student.id },
        include: {
          session: {
            select: {
              date: true,
              section: { select: { id: true, name: true, course: { select: { name: true } } } },
            },
          },
        },
        orderBy: { session: { date: 'desc' } },
        take: 40,
      }),
      this.prisma.grade.findMany({
        where: {
          studentId: student.id,
          status: { in: [GradeStatus.PUBLISHED, GradeStatus.FINALIZED] },
        },
        include: {
          assessment: {
            select: {
              id: true,
              title: true,
              totalMarks: true,
              type: true,
              section: { select: { id: true, name: true, course: { select: { name: true } } } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      sectionIds.length
        ? this.prisma.assessment.findMany({
            where: {
              organizationId: orgId,
              sectionId: { in: sectionIds },
              dueDate: { gte: now },
            },
            include: {
              section: { select: { id: true, name: true, course: { select: { name: true } } } },
            },
            orderBy: { dueDate: 'asc' },
            take: 10,
          })
        : Promise.resolve([]),
      sectionIds.length
        ? this.prisma.sectionSchedule.findMany({
            where: { sectionId: { in: sectionIds } },
            include: {
              section: { select: { id: true, name: true, room: true, course: { select: { name: true } } } },
            },
            orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
          })
        : Promise.resolve([]),
      this.prisma.financialEntry.findMany({
        where: { organizationId: orgId, studentId: student.id },
        orderBy: { dueDate: 'desc' },
      }),
      this.prisma.announcement.count({
        where: {
          organizationId: orgId,
          OR: [
            { targetType: TargetType.GLOBAL },
            { targetType: TargetType.ORG },
            { targetType: TargetType.ROLE, targetId: Role.GUARDIAN },
            { targetType: TargetType.ROLE, targetId: Role.STUDENT },
            ...(sectionIds.length
              ? [{ targetType: TargetType.SECTION, targetId: { in: sectionIds } }]
              : []),
          ],
        },
      }),
    ]);

    const attendance = attendanceRecords.reduce(
      (summary, record) => ({
        total: summary.total + 1,
        present: summary.present + (record.status === AttendanceStatus.PRESENT ? 1 : 0),
        absent: summary.absent + (record.status === AttendanceStatus.ABSENT ? 1 : 0),
        late: summary.late + (record.status === AttendanceStatus.LATE ? 1 : 0),
        excused: summary.excused + (record.status === AttendanceStatus.EXCUSED ? 1 : 0),
      }),
      { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
    );
    const attendanceRate = attendance.total
      ? Math.round(((attendance.present + attendance.late) / attendance.total) * 100)
      : null;
    const latestAttendance = attendanceRecords[0];

    const gradePercentages = grades
      .map((grade) => {
        const totalMarks = grade.assessment?.totalMarks || 0;
        return totalMarks > 0 ? (grade.marksObtained / totalMarks) * 100 : null;
      })
      .filter((value): value is number => value !== null);
    const averagePercentage = gradePercentages.length
      ? Math.round(gradePercentages.reduce((sum, value) => sum + value, 0) / gradePercentages.length)
      : null;
    const latestGrade = grades[0];
    const latestGradePercentage = latestGrade?.assessment?.totalMarks
      ? Math.round((latestGrade.marksObtained / latestGrade.assessment.totalMarks) * 100)
      : null;

    const activeFinanceEntries = financeEntries.filter((entry) => entry.status !== EntryStatus.CANCELLED);
    const totalDue = activeFinanceEntries.reduce((sum, entry) => sum + moneyNumber(entry.amount), 0);
    const totalPaid = activeFinanceEntries.reduce((sum, entry) => sum + moneyNumber(entry.paidAmount), 0);
    const balance = Math.max(totalDue - totalPaid, 0);
    const overdueEntries = activeFinanceEntries.filter((entry) => {
      const dueDate = new Date(entry.dueDate);
      return entry.status === EntryStatus.OVERDUE || (dueDate < now && entry.status !== EntryStatus.PAID);
    });

    const scheduleList = schedules as Array<{
      day: number;
      startTime: string;
      endTime: string;
      room: string | null;
      section?: { name?: string | null; room?: string | null; course?: { name?: string | null } | null } | null;
    }>;
    const today = now.getDay();
    const todaySchedules = scheduleList.filter((schedule) => schedule.day === today);
    const nextSchedule = scheduleList.find((schedule) => schedule.day >= today) || scheduleList[0] || null;

    return {
      studentId: student.id,
      studentName: student.user?.name || student.registrationNumber || 'Student',
      avatarUrl: student.user?.avatarUrl ?? null,
      avatarUpdatedAt: student.user?.avatarUpdatedAt ?? null,
      relationship: student.guardianRelationship ?? null,
      registrationNumber: student.registrationNumber,
      rollNumber: student.rollNumber,
      status: student.status ?? null,
      cohortName: student.cohort?.name ?? null,
      sections: enrollments.map((enrollment) => ({
        id: enrollment.section.id,
        name: enrollment.section.name,
        color: enrollment.section.color,
        room: enrollment.section.room,
        courseName: enrollment.section.course?.name ?? enrollment.section.name,
        academicCycleName: enrollment.section.academicCycle?.name ?? null,
      })),
      attendance: {
        ...attendance,
        rate: attendanceRate,
        latestStatus: latestAttendance?.status ?? null,
        latestDate: latestAttendance?.session?.date ?? null,
        latestSectionName: latestAttendance?.session?.section?.course?.name
          ?? latestAttendance?.session?.section?.name
          ?? null,
      },
      grades: {
        count: grades.length,
        averagePercentage,
        latestTitle: latestGrade?.assessment?.title ?? null,
        latestCourseName: latestGrade?.assessment?.section?.course?.name
          ?? latestGrade?.assessment?.section?.name
          ?? null,
        latestPercentage: latestGradePercentage,
        latestStatus: latestGrade?.status ?? null,
        latestUpdatedAt: latestGrade?.updatedAt ?? null,
      },
      assessments: {
        upcomingCount: upcomingAssessments.length,
        nextTitle: upcomingAssessments[0]?.title ?? null,
        nextDueDate: upcomingAssessments[0]?.dueDate ?? null,
        nextCourseName: upcomingAssessments[0]?.section?.course?.name
          ?? upcomingAssessments[0]?.section?.name
          ?? null,
      },
      timetable: {
        scheduledClasses: schedules.length,
        todayCount: todaySchedules.length,
        nextClassName: nextSchedule?.section?.course?.name ?? nextSchedule?.section?.name ?? null,
        nextClassDay: nextSchedule?.day ?? null,
        nextClassTime: nextSchedule ? `${nextSchedule.startTime} - ${nextSchedule.endTime}` : null,
        nextClassRoom: nextSchedule?.room ?? nextSchedule?.section?.room ?? null,
      },
      finance: {
        totalDue,
        totalPaid,
        balance,
        overdueAmount: overdueEntries.reduce((sum, entry) => sum + Math.max(moneyNumber(entry.amount) - moneyNumber(entry.paidAmount), 0), 0),
        overdueCount: overdueEntries.length,
        pendingCount: activeFinanceEntries.filter((entry) => (
          [EntryStatus.PENDING, EntryStatus.PARTIAL, EntryStatus.UNVERIFIED] as EntryStatus[]
        ).includes(entry.status)).length,
      },
      announcementsCount,
    };
  }

  private buildOverviewTotals(insights: GuardianStudentInsightSummary[]) {
    const insightsWithAttendance = insights.filter(
      (insight): insight is GuardianStudentInsightSummary & { attendance: { rate: number } } => insight.attendance.rate !== null,
    );
    return {
      linkedStudents: insights.length,
      totalSections: insights.reduce((sum, insight) => sum + insight.sections.length, 0),
      upcomingAssessments: insights.reduce((sum, insight) => sum + insight.assessments.upcomingCount, 0),
      todayClasses: insights.reduce((sum, insight) => sum + insight.timetable.todayCount, 0),
      totalBalance: insights.reduce((sum, insight) => sum + insight.finance.balance, 0),
      overdueAmount: insights.reduce((sum, insight) => sum + insight.finance.overdueAmount, 0),
      overdueEntries: insights.reduce((sum, insight) => sum + insight.finance.overdueCount, 0),
      averageAttendanceRate: insightsWithAttendance.length
        ? Math.round(
            insightsWithAttendance.reduce((sum, insight) => sum + insight.attendance.rate, 0)
            / insightsWithAttendance.length,
          )
        : null,
    };
  }

  private normalizeLinkedStudentIds(studentIds?: string[]) {
    return Array.from(new Set((studentIds || []).map((id) => id.trim()).filter(Boolean)));
  }

  private async assertLinkedStudentsBelongToOrg(
    tx: Prisma.TransactionClient,
    orgId: string,
    studentIds?: string[],
  ) {
    const uniqueIds = this.normalizeLinkedStudentIds(studentIds);
    if (!uniqueIds.length) return [];

    const students = await tx.student.findMany({
      where: { id: { in: uniqueIds }, organizationId: orgId },
      select: { id: true },
    });

    if (students.length !== uniqueIds.length) {
      throw new BadRequestException('One or more linked students do not belong to this organization');
    }

    return uniqueIds;
  }

  private normalizeGuardian<T extends GuardianWithStudentLinks>(guardian: T): NormalizedGuardian<T>;
  private normalizeGuardian<T extends GuardianWithStudentLinks>(guardian: T | null): NormalizedGuardian<T> | null;
  private normalizeGuardian(guardian: null | undefined): null | undefined;
  private normalizeGuardian<T extends GuardianWithStudentLinks>(guardian: T | null | undefined): NormalizedGuardian<T> | null | undefined {
    if (!guardian) return guardian;
    const { studentLinks, ...rest } = guardian;
    return {
      ...rest,
      studentLinks: studentLinks || [],
      students: (studentLinks || []).map((link) => ({
        ...link.student,
        guardianId: (rest as { id?: string }).id,
        guardianRelationship: link.relationshipLabel,
      })) as GuardianStudentForInsight[],
    };
  }

  private guardianInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          avatarUrl: true,
          avatarUpdatedAt: true,
        },
      },
      studentLinks: {
        include: {
          student: {
            select: {
              id: true,
              userId: true,
              registrationNumber: true,
              rollNumber: true,
              status: true,
              cohort: { select: { id: true, name: true } },
              user: { select: { id: true, name: true, email: true, avatarUrl: true, avatarUpdatedAt: true } },
            },
          },
        },
      },
    } satisfies Prisma.GuardianProfileInclude;
  }
}
