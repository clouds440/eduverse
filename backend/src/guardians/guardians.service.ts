import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums';
import { UserService } from '../users/user.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';

@Injectable()
export class GuardiansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async createGuardian(orgId: string, data: CreateGuardianDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await this.userService.createUser(
          {
            email: data.email,
            password: data.password,
            role: Role.GUARDIAN,
            organizationId: orgId,
            name: data.name,
            phone: data.phone,
          },
          tx,
        );

        return tx.guardianProfile.create({
          data: {
            userId: user.id,
            organizationId: orgId,
            phone: data.phone,
            address: data.address,
            relationshipLabel: data.relationshipLabel,
          },
          include: this.guardianInclude(),
        });
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
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
    return this.prisma.guardianProfile.findMany({
      where: {
        organizationId: orgId,
        ...(search
          ? {
              OR: [
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { phone: { contains: search, mode: 'insensitive' } },
                { relationshipLabel: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: this.guardianInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGuardian(orgId: string, id: string) {
    const guardian = await this.prisma.guardianProfile.findFirst({
      where: { id, organizationId: orgId },
      include: this.guardianInclude(),
    });

    if (!guardian) throw new NotFoundException('Guardian not found');
    return guardian;
  }

  async getMyGuardianProfile(orgId: string, userId: string) {
    const guardian = await this.prisma.guardianProfile.findFirst({
      where: { userId, organizationId: orgId },
      include: this.guardianInclude(),
    });

    if (!guardian) throw new NotFoundException('Guardian profile not found');
    return guardian;
  }

  async getMyOverview(orgId: string, userId: string, studentId?: string) {
    const guardian = await this.getMyGuardianProfile(orgId, userId);
    const linkedStudents = guardian.students;
    const selectedStudent = studentId
      ? linkedStudents.find((student) => student.id === studentId)
      : linkedStudents[0];

    if (studentId && !selectedStudent) {
      throw new ForbiddenException('You can only view linked students');
    }

    if (!selectedStudent) {
      return {
        guardian,
        linkedStudents,
        selectedStudent: null,
        attendanceSummary: null,
        recentGrades: [],
        upcomingAssessments: [],
        upcomingSchedule: [],
        financeSummary: null,
        recentFinanceEntries: [],
        recentAnnouncements: [],
      };
    }

    const enrolledSections = await this.prisma.enrollment.findMany({
      where: {
        studentId: selectedStudent.id,
        isExcludedFromCohort: false,
      },
      select: { sectionId: true },
    });
    const sectionIds = enrolledSections.map((enrollment) => enrollment.sectionId);
    const now = new Date();

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
            { targetType: 'GLOBAL' },
            { targetType: 'ORG' },
            { targetType: 'ROLE', targetId: Role.GUARDIAN },
            { targetType: 'ROLE', targetId: Role.STUDENT },
            ...(sectionIds.length
              ? [{ targetType: 'SECTION' as const, targetId: { in: sectionIds } }]
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
        present: summary.present + (record.status === 'PRESENT' ? 1 : 0),
        absent: summary.absent + (record.status === 'ABSENT' ? 1 : 0),
        late: summary.late + (record.status === 'LATE' ? 1 : 0),
        excused: summary.excused + (record.status === 'EXCUSED' ? 1 : 0),
      }),
      { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
    );

    const totalDue = recentFinanceEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const totalPaid = recentFinanceEntries.reduce((sum, entry) => sum + entry.paidAmount, 0);

    return {
      guardian,
      linkedStudents,
      selectedStudent,
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
      students: {
        select: {
          id: true,
          userId: true,
          guardianRelationship: true,
          registrationNumber: true,
          rollNumber: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    } satisfies Prisma.GuardianProfileInclude;
  }
}
