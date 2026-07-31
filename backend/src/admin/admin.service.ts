import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Injectable,
} from '@nestjs/common';
import {
  Prisma,
  User as UserEntity,
  Organization,
} from '@/prisma/prisma-client';
import { OrgStatus, Role, MailCategory } from '../common/enums';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../users/user.service';
import { OrgService } from '../org/org.service';
import {
  getPaginationOptions,
  formatPaginatedResponse,
  mapStatusCounts,
  PaginationOptions,
} from '../common/utils';
import { MailService } from '../mail/mail.service';
import { MailUser } from '../mail/interfaces/mail-user.interface';
import { EmailService } from '../security/email.service';
import { PlatformActivityService } from '../activity-logs/platform-activity.service';
import { OrganizationActivityService } from '../activity-logs/organization-activity.service';
import { ActivityLogType } from '../activity-logs/activity-log.types';

import { CreatePlatformAdminDto } from './dto/create-platform-admin.dto';
import { UpdatePlatformAdminDto } from './dto/update-platform-admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
    private readonly orgService: OrgService,
    private readonly platformActivity: PlatformActivityService,
    private readonly organizationActivity: OrganizationActivityService,
  ) {}

  private orgWithAdminInclude = {
    users: {
      where: { role: Role.ORG_ADMIN },
      select: { id: true },
      take: 1,
    },
  } satisfies Prisma.OrganizationInclude;

  async getOrganizations(
    options: PaginationOptions & {
      status?: OrgStatus;
      type?: string;
      contactEmailStatus?: 'verified' | 'unverified' | 'all';
      createdFrom?: string;
      createdTo?: string;
    },
  ) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'createdAt',
      sortOrder: options.sortOrder || 'desc',
    });

    // Map frontend sort keys to Prisma fields
    let prismaSortBy = sortBy;
    if (sortBy === 'email' || sortBy === 'contact') {
      prismaSortBy = 'contactEmail';
    }

    const contactEmailWhere = this.getContactEmailStatusWhere(
      options.contactEmailStatus,
    );
    const createdAtWhere = this.getCreatedAtRangeWhere(
      options.createdFrom,
      options.createdTo,
    );

    const where: Prisma.OrganizationWhereInput = {
      ...contactEmailWhere,
      ...createdAtWhere,
      ...(options.status ? { status: options.status } : {}),
      ...(options.type && options.type !== 'ALL' ? { type: options.type } : {}),
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' } },
              { location: { contains: options.search, mode: 'insensitive' } },
              { type: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // For dynamic counts based on SEARCH and TYPE but NOT on status
    const countWhere: Prisma.OrganizationWhereInput = {
      ...contactEmailWhere,
      ...createdAtWhere,
      ...(options.type && options.type !== 'ALL' ? { type: options.type } : {}),
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' } },
              { location: { contains: options.search, mode: 'insensitive' } },
              { type: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [orgs, totalRecords, statusCounts] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: {
          [prismaSortBy]: sortOrder,
        } as Prisma.OrganizationOrderByWithRelationInput,
        include: {
          users: {
            where: { role: Role.ORG_ADMIN },
            select: { id: true },
            take: 1,
          },
        },
      }) as unknown as Promise<(Organization & { users: { id: string }[] })[]>,
      this.prisma.organization.count({ where }),
      this.prisma.organization.groupBy({
        by: ['status'],
        where: countWhere,
        _count: { _all: true },
      }),
    ]);

    const countsMap = mapStatusCounts(statusCounts, OrgStatus);

    const mappedData = orgs.map((org) => ({
      id: org.id,
      name: org.name,
      logoUrl: org.logoUrl,
      location: org.location,
      type: org.type,
      status: org.status,
      statusHistory: org.statusHistory,
      createdAt: org.createdAt,
      phone: org.phone,
      email: org.contactEmail,
      contactEmail: org.contactEmail,
      contactEmailVerifiedAt: org.contactEmailVerifiedAt,
      adminUserId: (org as Organization & { users: { id: string }[] })
        .users?.[0]?.id,
    }));

    const response = formatPaginatedResponse(
      mappedData,
      totalRecords,
      options.page,
      options.limit,
    );
    return {
      ...response,
      counts: countsMap,
    };
  }

  private getContactEmailStatusWhere(
    status?: 'verified' | 'unverified' | 'all',
  ): Prisma.OrganizationWhereInput {
    if (status === 'all') return {};
    if (status === 'unverified') {
      return { contactEmailVerifiedAt: null };
    }
    return { contactEmailVerifiedAt: { not: null } };
  }

  async approveOrganization(id: string, admin: UserEntity) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const result = await this.orgService.approveOrganization(id, admin);

    // Find the admin user to send the welcome/re-approval mail
    const orgAdmins = await this.userService.getUsersByOrgAndRole(
      id,
      Role.ORG_ADMIN,
    );
    const orgAdmin = orgAdmins[0];

    if (orgAdmin) {
      let subject = `Welcome to EduVerse: ${org.name}`;
      let message = `Congratulations! Your organization **${org.name}** has been approved. You now have full access to your dashboard.\n\nWelcome to the EduVerse community!`;

      if (org.status === OrgStatus.REJECTED) {
        subject = `Re-approval of Your Organization: ${org.name}`;
        message = `Great news! Your organization **${org.name}** has been re-approved after your application was revised. You now have full access back to your dashboard.`;
      } else if (org.status === OrgStatus.SUSPENDED) {
        subject = `Account Unsuspended: ${org.name}`;
        message = `Your organization **${org.name}** has been unsuspended. You can now resume your activities on the platform.`;
      }

      // Send NO_REPLY mail
      await this.mailService.createMail(
        {
          subject,
          category: MailCategory.PLATFORM_NOTICE,
          priority: 'NORMAL',
          message,
          noReply: true,
          assigneeIds: [orgAdmin.id],
        },
        {
          id: admin.id,
          role: admin.role,
          name: admin.name || null,
          email: admin.email,
          organizationId: null,
        },
      );

      // Also send a congrats email to the organization's contact email using the Resend util
      if (org.contactEmail) {
        const text = message.replace(/\*\*(.+?)\*\*/g, '$1');
        const html = message
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .split('\n')
          .map((p) => `<p>${p}</p>`)
          .join('');
        try {
          await this.emailService.send({
            to: org.contactEmail,
            subject,
            text,
            html,
          });
        } catch (err) {
          // don't block approval on email failure
          console.error('EmailService error sending org approval notice:', err);
        }
      }
    }

    return result;
  }

  async setOrganizationContactEmail(
    id: string,
    contactEmail: string,
    admin: UserEntity,
  ) {
    return this.orgService.setRecoveryContactEmail(id, contactEmail, {
      id: admin.id,
      role: admin.role,
    });
  }

  async updateOrganizationStatus(
    id: string,
    status: OrgStatus.SUSPENDED | OrgStatus.REJECTED,
    reason: string,
    admin: UserEntity,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const result = await this.orgService.updateOrganizationStatus(
      id,
      status,
      reason,
      admin,
    );

    // Find any admin user of this organization to be the target of the mail
    const orgAdmins = await this.userService.getUsersByOrgAndRole(
      id,
      Role.ORG_ADMIN,
    );
    const orgAdmin = orgAdmins[0];

    // Create a Mail thread (Notice) - No Reply
    const subject =
      status === OrgStatus.REJECTED
        ? 'Application Status Update: REJECTED'
        : 'Organization Status Update: SUSPENDED';
    const category =
      status === OrgStatus.REJECTED ? 'System Notice' : 'Security/Admin Notice';

    await this.mailService.createMail(
      {
        subject,
        category,
        priority: 'URGENT',
        message: reason,
        noReply: true,
        assigneeIds: orgAdmin ? [orgAdmin.id] : [],
      },
      {
        id: admin.id,
        role: admin.role,
        name: admin.name || null,
        email: admin.email,
        organizationId: id,
      },
    );

    return result;
  }

  async getAdminStats(user: MailUser) {
    const [orgStatusCounts, unreadMail, platformAdmins] = await Promise.all([
      this.prisma.organization.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.mailService.getUnreadCount(user),
      this.prisma.user.count({ where: { role: Role.PLATFORM_ADMIN } }),
    ]);

    const orgCounts = mapStatusCounts(orgStatusCounts, OrgStatus);

    return {
      ...orgCounts,
      UNREAD_MAIL: unreadMail.unread,
      TOTAL_MAIL: unreadMail.total,
      PLATFORM_ADMINS: platformAdmins,
    };
  }

  private getCreatedAtRangeWhere(
    createdFrom?: string,
    createdTo?: string,
  ): Prisma.OrganizationWhereInput {
    const range: Prisma.DateTimeFilter = {};
    const from = this.parseDateBoundary(createdFrom, 'start');
    const to = this.parseDateBoundary(createdTo, 'end');
    if (from) range.gte = from;
    if (to) range.lte = to;
    return Object.keys(range).length ? { createdAt: range } : {};
  }

  private parseDateBoundary(value: string | undefined, boundary: 'start' | 'end') {
    if (!value) return null;
    const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = dateOnlyMatch
      ? new Date(`${value}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`)
      : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  async getOrganizationOverview(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
        location: true,
        contactEmail: true,
        contactEmailVerifiedAt: true,
        phone: true,
        logoUrl: true,
        avatarUpdatedAt: true,
        currency: true,
        statusHistory: true,
        createdAt: true,
      },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const [
      users,
      students,
      teachers,
      courses,
      sections,
      departments,
      income,
      expenses,
      recentCriticalEvents,
      activeSessions,
    ] = await Promise.all([
      this.prisma.user.count({ where: { organizationId: id } }),
      this.prisma.student.count({ where: { organizationId: id } }),
      this.prisma.teacher.count({ where: { organizationId: id } }),
      this.prisma.course.count({ where: { organizationId: id } }),
      this.prisma.section.count({ where: { organizationId: id } }),
      this.prisma.department.count({ where: { organizationId: id } }),
      this.prisma.transaction.aggregate({
        where: { organizationId: id, type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { organizationId: id, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
      this.prisma.organizationActivityLog.count({
        where: {
          organizationId: id,
          OR: [
            { action: { contains: 'failed', mode: 'insensitive' } },
            { action: { contains: 'reset', mode: 'insensitive' } },
            { action: { contains: 'delete', mode: 'insensitive' } },
            { action: { contains: 'recovered', mode: 'insensitive' } },
            { action: { contains: 'suspend', mode: 'insensitive' } },
          ],
        },
      }),
      this.prisma.session.count({
        where: { isActive: true, user: { organizationId: id } },
      }),
    ]);

    const incomeTotal = income._sum.amount || new Prisma.Decimal(0);
    const expenseTotal = expenses._sum.amount || new Prisma.Decimal(0);

    return {
      organization: {
        ...org,
        email: org.contactEmail,
      },
      counts: {
        users,
        students,
        teachers,
        courses,
        sections,
        departments,
        activeSessions,
        recentCriticalEvents,
      },
      finance: {
        income: incomeTotal.toFixed(2),
        expenses: expenseTotal.toFixed(2),
        netCashflow: incomeTotal.minus(expenseTotal).toFixed(2),
      },
    };
  }

  async getAuditLogs(
    options: PaginationOptions & {
      action?: string;
      type?: string;
    },
  ) {
    return this.platformActivity.list(options);
  }

  async getOrganizationActivityLogs(
    organizationId: string,
    options: PaginationOptions & {
      action?: string;
      type?: string;
    },
  ) {
    return this.organizationActivity.list(organizationId, options);
  }

  async deleteOrganization(id: string, admin: UserEntity) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.status === OrgStatus.APPROVED) {
      throw new BadRequestException(
        'Approved organizations cannot be deleted. Suspend the organization first if it needs administrative action.',
      );
    }

    await this.platformActivity.record({
      type: ActivityLogType.ADMIN,
      action: 'organization_deleted',
      actorUserId: admin.id,
      module: 'admin',
      resourceType: 'organization',
      resourceId: id,
      resourceTitle: org.name,
      details: {
        organizationId: id,
        organizationName: org.name,
        previousStatus: org.status,
      },
    });

    await this.prisma.organization.delete({ where: { id } });
    return { message: `${org.name} was deleted permanently.` };
  }

  // --- Platform Admins ---
  async getPlatformAdmins(options: PaginationOptions) {
    const { skip, take, search } = getPaginationOptions(options);

    const where: Prisma.UserWhereInput = {
      role: Role.PLATFORM_ADMIN,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [admins, totalRecords] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return formatPaginatedResponse(
      admins,
      totalRecords,
      options.page,
      options.limit,
    );
  }

  async createPlatformAdmin(data: CreatePlatformAdminDto) {
    return this.userService.createUser({
      email: data.email,
      password: data.password,
      role: Role.PLATFORM_ADMIN,
      name: data.name,
      phone: data.phone,
      avatarUrl: '/assets/eduverse-icon-192.png',
    });
  }

  async updatePlatformAdmin(id: string, data: UpdatePlatformAdminDto) {
    const admin = await this.userService.getUserById(id);
    if (admin.role !== Role.PLATFORM_ADMIN)
      throw new NotFoundException('Platform admin not found');

    const updateData: Prisma.UserUpdateInput = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.phone) updateData.phone = data.phone;
    if (data.password) updateData.password = data.password;

    return this.userService.updateUser(id, updateData);
  }

  async deletePlatformAdmin(id: string) {
    const admin = await this.userService.getUserById(id);
    if (admin.role !== Role.PLATFORM_ADMIN)
      throw new NotFoundException('Platform admin not found');

    return this.userService.deleteUser(id);
  }

  async changeAdminPassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.userService.getUserById(userId);
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.PLATFORM_ADMIN) {
      throw new UnauthorizedException('Admin not found');
    }

    const updatedUser = await this.userService.changePassword(
      userId,
      oldPass,
      newPass,
    );
    return this.authService.generateToken(updatedUser);
  }
}
