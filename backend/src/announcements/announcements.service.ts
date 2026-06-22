import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { StudentService } from '../students/student.service';
import { TeacherService } from '../teacher/teacher.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { Prisma, Role, TargetType } from '@/prisma/prisma-client';
import { formatRoleLabel } from '../common/role-labels';

interface CurrentUser {
  id: string;
  role: Role;
  organizationId: string | null;
}

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly studentService: StudentService,
    private readonly teacherService: TeacherService,
  ) {}

  async createAnnouncement(dto: CreateAnnouncementDto, user: CurrentUser) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Students cannot create announcements.');
    }

    // --- Permission Checks based on TargetType ---
    if (dto.targetType === TargetType.GLOBAL) {
      if (user.role !== Role.SUPER_ADMIN && user.role !== Role.PLATFORM_ADMIN) {
        throw new ForbiddenException(
          'Only System Admins can create GLOBAL announcements.',
        );
      }
    } else if (dto.targetType === TargetType.ORG) {
      if (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) {
        throw new ForbiddenException(
          `As a ${formatRoleLabel(user.role)}, you are not authorized to create organization-wide announcements.`,
        );
      }
      if (
        dto.targetId &&
        dto.targetId !== user.organizationId &&
        user.role !== Role.SUPER_ADMIN &&
        user.role !== Role.PLATFORM_ADMIN
      ) {
        throw new ForbiddenException(
          'Cannot target an Organization you do not belong to.',
        );
      }
    } else if (dto.targetType === TargetType.ROLE) {
      if (user.role === Role.TEACHER) {
        throw new ForbiddenException(
          'Teachers are not authorized to create role-based announcements.',
        );
      }

      const targetRole = dto.targetId as Role;
      const isPlatformTarget =
        targetRole === Role.SUPER_ADMIN || targetRole === Role.PLATFORM_ADMIN;

      if (
        user.role !== Role.SUPER_ADMIN &&
        user.role !== Role.PLATFORM_ADMIN &&
        isPlatformTarget
      ) {
        throw new ForbiddenException(
          `As a ${formatRoleLabel(user.role)}, you cannot target Platform or Super Administrators.`,
        );
      }

      if (user.role === Role.ORG_MANAGER && targetRole === Role.ORG_ADMIN) {
        throw new ForbiddenException(
          'Org Managers are not authorized to target Org Administrators.',
        );
      }
    } else if (dto.targetType === TargetType.SECTION) {
      if (user.role === Role.TEACHER) {
        const teacher = await this.teacherService.getTeacherByUserId(user.id);
        if (teacher) {
          const teacherWithSections = await this.prisma.teacher.findUnique({
            where: { userId: user.id },
            include: { sections: true },
          });
          const sectionIds = teacherWithSections?.sections.map((s) => s.id) || [];
          if (!dto.targetId || !sectionIds.includes(dto.targetId)) {
            throw new ForbiddenException(
              'You can only send announcements to your assigned sections.',
            );
          }
        } else {
          throw new ForbiddenException('Teacher profile not found');
        }
      }
    }

    // Set OrganizationId if it's not a global announcement and creator is part of an org
    // Or if super admin is specifying an org via targetId (for ORG targetType)
    let orgId = user.organizationId;
    if (dto.targetType === TargetType.ORG && dto.targetId) {
      orgId = dto.targetId;
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        targetType: dto.targetType,
        targetId: dto.targetId,
        actionUrl: dto.actionUrl,
        priority: dto.priority,
        creatorId: user.id,
        organizationId: orgId,
      },
      include: {
        creator: {
          select: { id: true, name: true, role: true, avatarUrl: true },
        },
      },
    });

    // Broadcast Emit
    const eventName = 'announcement:new';
    if (dto.targetType === TargetType.GLOBAL) {
      this.events.emitToRoom('role:SUPER_ADMIN', eventName, announcement);
      this.events.emitToRoom('role:PLATFORM_ADMIN', eventName, announcement);
      this.events.emitToRoom('role:ORG_ADMIN', eventName, announcement);
      this.events.emitToRoom('role:ORG_MANAGER', eventName, announcement);
      this.events.emitToRoom('role:TEACHER', eventName, announcement);
      this.events.emitToRoom('role:STUDENT', eventName, announcement);
      // In a real highly scalable app, you'd use a single "global" room.
    } else if (dto.targetType === TargetType.ORG && orgId) {
      this.events.emitToOrg(orgId, eventName, announcement);
    } else if (dto.targetType === TargetType.ROLE && dto.targetId) {
      if (orgId) {
        // Technically EventsGateway doesn't have org+role intersection rooms natively,
        // so we emit to org, but frontend must filter by role.
        this.events.emitToOrg(orgId, eventName, announcement);
      } else {
        this.events.emitToRole(dto.targetId as Role, eventName, announcement);
      }
    } else if (dto.targetType === TargetType.SECTION && dto.targetId) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { sectionId: dto.targetId },
        select: { student: { select: { userId: true } } },
      });
      enrollments.forEach((e) => {
        this.events.emitToUser(e.student.userId, eventName, announcement);
      });
    }

    return announcement;
  }

  async getAnnouncements(
    user: CurrentUser,
    page: number = 1,
    limit: number = 10,
  ) {
    // Build OR conditions to fetch only announcements relevant to the user's hierarchy
    const conditions: Prisma.AnnouncementWhereInput[] = [
      { targetType: TargetType.GLOBAL },
      { targetType: TargetType.ORG, organizationId: user.organizationId },
      {
        targetType: TargetType.ROLE,
        targetId: user.role,
        organizationId: user.organizationId,
      },
      // If they are platform admin, they might see more, but keep it simple for now
    ];

    // If User is Teacher/Student, fetch their sections
    if (user.role === Role.TEACHER) {
      const teacher = await this.teacherService.getTeacherByUserId(user.id);
      if (teacher) {
        const profile = await this.prisma.teacher.findUnique({
          where: { userId: user.id },
          include: { sections: true },
        });
        if (profile && profile.sections.length > 0) {
          conditions.push({
            targetType: TargetType.SECTION,
            targetId: { in: profile.sections.map((s) => s.id) },
          });
        }
      }
    } else if (user.role === Role.STUDENT) {
      const student = await this.studentService.getStudentByUserId(user.id);
      if (student) {
        const profile = await this.prisma.student.findUnique({
          where: { userId: user.id },
          include: { enrollments: true },
        });
        if (profile && profile.enrollments.length > 0) {
          conditions.push({
            targetType: TargetType.SECTION,
            targetId: { in: profile.enrollments.map((e) => e.sectionId) },
          });
        }
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const where: Prisma.AnnouncementWhereInput = {
      AND: [{ OR: conditions }, { createdAt: { gte: thirtyDaysAgo } }],
    };

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          creator: {
            select: { id: true, name: true, role: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
