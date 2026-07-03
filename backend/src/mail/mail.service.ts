import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { MailStatus, Role, OrgStatus } from '../common/enums';
import {
  getPaginationOptions,
  formatPaginatedResponse,
  PaginationOptions,
} from '../common/utils';
import { CreateMailDto } from './dto/create-mail.dto';
import { UpdateMailDto } from './dto/update-mail.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { MailUser } from './interfaces/mail-user.interface';
import { formatRoleLabel } from '../common/role-labels';

/** Maximum active (non-resolved/closed) mails per user */
const MAX_ACTIVE_MAILS = 10;

/** Roles that can manage (view all, assign, change status) mails */
const ADMIN_ROLES = new Set([Role.SUPER_ADMIN, Role.PLATFORM_ADMIN]);
const ORG_OPERATIONAL_ROLES = new Set([Role.ORG_ADMIN, Role.SUB_ADMIN]);
const FINANCE_MAIL_CATEGORIES = new Set([
  'BILLING',
  'PAYMENT',
  'PAYMENT_CLAIM',
  'FEES',
  'FINANCE',
  'GENERAL_INQUIRY',
  'OTHER',
]);

export interface ContactTarget {
  id: string;
  label: string;
  email?: string;
  type: 'USER' | 'ROLE';
  role: string;
  avatarUrl?: string | null;
  description?: string;
}

type NotificationMetadata = Record<string, unknown>;
type MailIdentity = {
  role?: Role | string | null;
  name?: string | null;
  email?: string | null;
} & Record<string, unknown>;
type TransformableMailMessage = {
  sender?: MailIdentity | null;
} & Record<string, unknown>;
type TransformableMailActionLog = {
  performer?: MailIdentity | null;
} & Record<string, unknown>;
type TransformableMail = {
  creator?: MailIdentity | null;
  assignee?: MailIdentity | null;
  assignees?: MailIdentity[] | null;
  messages?: TransformableMailMessage[] | null;
  actionLogs?: TransformableMailActionLog[] | null;
} & Record<string, unknown>;

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly notifications: NotificationsService,
  ) {}

  // ──────────────────────────────── Create ─────────────────────────────────

  async createMail(dto: CreateMailDto, user: MailUser) {
    // --- Org Status Enforcement ---
    const isPlatformAdmin = user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN;
    
    if (!isPlatformAdmin && user.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { status: true },
      });
      const status = org?.status as OrgStatus | undefined;
      
      if (status && status !== OrgStatus.APPROVED) {
        // Restricted orgs can only contact platform support
        const contactingSupport = 
          dto.targetRole === Role.PLATFORM_ADMIN || 
          dto.targetRole === Role.SUPER_ADMIN;
          
        if (!contactingSupport) {
          throw new ForbiddenException(
            'Your organization is not active. You can only contact the platform administrative team.',
          );
        }
      }
    }

    await this.validateMailRecipients(dto, user);

    // --- Role-based Messaging Restrictions ---
    if (user.role === Role.ORG_MANAGER) {
      if (
        dto.targetRole === 'ORG_STAFF' ||
        dto.targetRole === Role.ORG_MANAGER
      ) {
        throw new ForbiddenException(
          'Managers are not authorized to send mail to large groups (All Staff/Managers).',
        );
      }
    }

    if (user.role === Role.TEACHER) {
      if (
        dto.targetRole === Role.ORG_ADMIN ||
        dto.targetRole === Role.PLATFORM_ADMIN ||
        dto.targetRole === Role.SUPER_ADMIN
      ) {
        throw new ForbiddenException(
          `Teachers are not authorized to send mail to ${formatRoleLabel(dto.targetRole)}s.`,
        );
      }
      if (dto.assigneeIds?.length) {
        const recipients = await this.prisma.user.findMany({
          where: { id: { in: dto.assigneeIds } },
          select: { role: true },
        });
        if (
          recipients.some(
            (r) =>
              r.role === Role.ORG_ADMIN ||
              r.role === Role.PLATFORM_ADMIN ||
              r.role === Role.SUPER_ADMIN,
          )
        ) {
          throw new ForbiddenException(
            'Teachers are not authorized to send mail to Organization or Platform Admins.',
          );
        }
      }
    }

    // Rate limiting: check active mail count
    const activeCount = await this.prisma.mail.count({
      where: {
        creatorId: user.id,
        status: { notIn: [MailStatus.RESOLVED, MailStatus.CLOSED] },
      },
    });

    // --- Role Enum Consistency Enforcement (Backend Only) ---
    if (dto.targetRole && dto.targetRole !== 'ORG_STAFF') {
      if (!Object.values(Role).includes(dto.targetRole as Role)) {
        throw new BadRequestException(
          `Invalid target role provided. Must be a valid system role.`,
        );
      }
    }
    if (!Object.values(Role).includes(user.role as Role)) {
      throw new BadRequestException(`Invalid creator role context.`);
    }

    if (activeCount >= MAX_ACTIVE_MAILS) {
      throw new BadRequestException(
        `You have reached the maximum of ${MAX_ACTIVE_MAILS} active mails. Please resolve or close existing mails first.`,
      );
    }

    // Create mail + initial message + action log in a transaction
    const mail = await this.prisma.$transaction(async (tx) => {
      const req = await tx.mail.create({
        data: {
          subject: dto.subject,
          category: dto.category,
          priority: dto.priority || 'NORMAL',
          status: dto.noReply
            ? MailStatus.NO_REPLY
            : dto.status || MailStatus.OPEN,
          creatorId: user.id,
          creatorRole: user.role,
          organizationId: user.organizationId,
          targetRole: dto.targetRole,
          assigneeId: dto.assigneeIds?.[0], // For legacy compatibility/single field
          assignees: dto.assigneeIds?.length
            ? {
                connect: dto.assigneeIds.map((id) => ({ id })),
              }
            : undefined,
          metadata: (dto.metadata as Prisma.InputJsonValue) ?? undefined,
        },
      });

      // Initial message
      await tx.mailMessage.create({
        data: {
          mailId: req.id,
          senderId: user.id,
          content: dto.message,
        },
      });

      // Action log
      await tx.mailActionLog.create({
        data: {
          mailId: req.id,
          performedBy: user.id,
          action: 'CREATED',
          details: {
            category: dto.category,
            priority: dto.priority || 'NORMAL',
          },
        },
      });

      // Mark as read for the creator immediately
      await tx.mailUserView.upsert({
        where: { userId_mailId: { userId: user.id, mailId: req.id } },
        update: { lastViewedAt: new Date() },
        create: { userId: user.id, mailId: req.id, lastViewedAt: new Date() },
      });

      return req;
    });

    // Fetch the full mail with relations for the response & event
    const fullMail = await this.getMailByIdInternal(mail.id);
    const transformed = this.transformMail(fullMail, user.role as Role);

    // Emit to targeted role, assignee, or platform admins
    let targetRoom = `role:${Role.PLATFORM_ADMIN}`;
    if (dto.assigneeIds?.length) {
      targetRoom = `user:${dto.assigneeIds[0]}`;

      // Notify all participants using the new consolidated helper
      await this.notifyParticipants(
        mail,
        {
          title: 'New Mail Received',
          body: `New mail received: "${dto.subject}".`,
          type: 'MAIL_ASSIGNED',
        },
        user.id,
      );
    } else if (dto.targetRole) {
      targetRoom = `role:${dto.targetRole}`;
    }

    // Use transformed for potentially organization-level rooms
    const isOrgTarget =
      targetRoom.startsWith('user:') ||
      (dto.targetRole && !ADMIN_ROLES.has(dto.targetRole as Role));
    this.events.emitToRoom(
      targetRoom,
      'mail:new',
      isOrgTarget ? transformed : fullMail,
    );

    // Also emit to super admins if not already targeted (always untransformed for admins)
    if (targetRoom !== `role:${Role.SUPER_ADMIN}`) {
      this.events.emitToRole(Role.SUPER_ADMIN, 'mail:new', fullMail);
    }

    // Notify all participants about unread count change
    this.emitUnreadUpdateToParticipants(
      {
        creatorId: user.id,
        assigneeId: dto.assigneeIds?.[0] ?? null,
        targetRole: dto.targetRole ?? null,
      },
      user.id,
    );

    return transformed;
  }

  private async validateMailRecipients(dto: CreateMailDto, user: MailUser) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Students are not allowed to submit mails.');
    }

    const recipientRoles = new Set<string>();
    if (dto.targetRole) recipientRoles.add(dto.targetRole);

    if (dto.assigneeIds?.length) {
      const recipients = await this.prisma.user.findMany({
        where: { id: { in: dto.assigneeIds } },
        select: { id: true, role: true, organizationId: true },
      });

      if (recipients.length !== dto.assigneeIds.length) {
        throw new BadRequestException('One or more recipients were not found.');
      }

      if (
        user.organizationId &&
        recipients.some(
          (recipient) =>
            recipient.organizationId !== user.organizationId &&
            recipient.role !== Role.PLATFORM_ADMIN &&
            recipient.role !== Role.SUPER_ADMIN,
        )
      ) {
        throw new ForbiddenException('Cannot send mail outside your organization.');
      }

      recipients.forEach((recipient) => recipientRoles.add(recipient.role));
    }

    if (user.role === Role.GUARDIAN) {
      const allowedRoles = new Set<string>([
        Role.ORG_ADMIN,
        Role.SUB_ADMIN,
        Role.FINANCE_MANAGER,
        Role.PLATFORM_ADMIN,
        Role.SUPER_ADMIN,
      ]);
      if ([...recipientRoles].some((role) => !allowedRoles.has(role))) {
        throw new ForbiddenException(
          'Guardians can only contact school administration, finance, or platform support.',
        );
      }
    }

    if (user.role === Role.FINANCE_MANAGER) {
      if (dto.targetRole) {
        throw new ForbiddenException(
          'Finance Managers can only send mail to selected individual recipients.',
        );
      }
      const allowedRoles = new Set<string>([
        Role.ORG_ADMIN,
        Role.SUB_ADMIN,
        Role.STUDENT,
        Role.GUARDIAN,
      ]);
      if ([...recipientRoles].some((role) => !allowedRoles.has(role))) {
        throw new ForbiddenException(
          'Finance Managers can only mail students, guardians, Admins, or Sub Admins.',
        );
      }
      if (!FINANCE_MAIL_CATEGORIES.has(dto.category)) {
        throw new ForbiddenException(
          'Finance Managers can only send finance-related mail.',
        );
      }
    }
  }

  // ───────────────────────────────── List ──────────────────────────────────

  async getMails(
    user: MailUser,
    options: PaginationOptions & { status?: string; category?: string },
  ) {
    const { skip, take, search, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'updatedAt',
      sortOrder: options.sortOrder || 'desc',
    });

    const where: Prisma.MailWhereInput = {
      AND: [
        // Optional base filters
        ...(options.status ? [{ status: options.status as MailStatus }] : []),
        ...(options.category ? [{ category: options.category }] : []),

        // Participation / Visibility Filter
        ...(user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN
          ? [
              {
                OR: [
                  { creatorId: user.id },
                  { assigneeId: user.id },
                  { assignees: { some: { id: user.id } } },
                  { targetRole: user.role as Role },
                  ...(user.role === Role.SUPER_ADMIN
                    ? [
                        { targetRole: Role.PLATFORM_ADMIN },
                        { targetRole: Role.SUPER_ADMIN },
                      ]
                    : []),
                  // Super admins also see any mail where organizationId is null (system level)
                  ...(user.role === Role.SUPER_ADMIN
                    ? [{ organizationId: null }]
                    : []),
                ],
              },
            ]
          : [
              {
                OR: [
                  { creatorId: user.id },
                  { assigneeId: user.id },
                  { assignees: { some: { id: user.id } } },
                  { targetRole: user.role as Role },
                  // Organization admins and sub admins see all mails in their Org
                  ...(user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN
                    ? [{ organizationId: user.organizationId }]
                    : []),
                  // Staff see mails targeted to ORG_STAFF
                  ...(user.role === Role.TEACHER ||
                  user.role === Role.ORG_MANAGER
                    ? [{ targetRole: 'ORG_STAFF' }]
                    : []),
                ],
              },
            ]),

        // Search Filter
        ...(search
          ? (() => {
              const normalizedSearch = search
                .trim()
                .toUpperCase()
                .replace(/\s+/g, '_');

              const possibleStatuses = Object.values(MailStatus) as string[];
              const isStatusMatch = possibleStatuses.find(
                (s) => s === normalizedSearch || s.includes(normalizedSearch),
              );

              // Also check for category matches
              const possibleCategories = [
                'ACCOUNT_STATUS',
                'BUG_REPORT',
                'FEATURE_REQUEST',
                'BILLING',
                'PLATFORM_SUPPORT',
                'ORG_COMPLIANCE',
                'ORG_ACCOUNT',
                'PLATFORM_NOTICE',
                'TASK_ASSIGNMENT',
                'SCHEDULE_CHANGE',
                'POLICY_UPDATE',
                'PERFORMANCE',
                'GENERAL_NOTICE',
                'LEAVE_REQUEST',
                'RESOURCE_REQUEST',
                'SCHEDULE_CONFLICT',
                'COLLABORATION',
                'GENERAL_INQUIRY',
                'OTHER',
              ];
              const isCategoryMatch = possibleCategories.find(
                (c) => c === normalizedSearch || c.includes(normalizedSearch),
              );

              return [
                {
                  OR: [
                    {
                      subject: {
                        contains: search,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      category: {
                        contains: search,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      creator: {
                        name: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                    {
                      creator: {
                        email: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                    {
                      assignee: {
                        name: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                    {
                      assignee: {
                        email: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                    {
                      assignees: {
                        some: {
                          name: {
                            contains: search,
                            mode: 'insensitive' as const,
                          },
                        },
                      },
                    },
                    {
                      assignees: {
                        some: {
                          email: {
                            contains: search,
                            mode: 'insensitive' as const,
                          },
                        },
                      },
                    },
                    ...(isStatusMatch
                      ? [{ status: isStatusMatch as MailStatus }]
                      : []),
                    ...(isCategoryMatch ? [{ category: isCategoryMatch }] : []),
                  ],
                },
              ];
            })()
          : []),
      ],
    };

    const [mails, totalRecords] = await Promise.all([
      this.prisma.mail.findMany({
        where,
        skip,
        take,
        orderBy: [
          { [sortBy]: sortOrder } as Prisma.MailOrderByWithRelationInput,
        ],
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
          assignee: {
            select: { id: true, name: true, email: true, role: true },
          },
          assignees: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
          organization: {
            select: { id: true, name: true, logoUrl: true },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
      this.prisma.mail.count({ where }),
    ]);

    const result = formatPaginatedResponse(
      mails,
      totalRecords,
      options.page,
      options.limit,
    );

    // Fetch unread count for each mail efficiently
    const mailIds = mails.map((r) => r.id);
    const userViews = await this.prisma.mailUserView.findMany({
      where: { userId: user.id, mailId: { in: mailIds } },
    });
    const viewMap = new Map(userViews.map((v) => [v.mailId, v.lastViewedAt]));

    const mailsWithUnread = await Promise.all(
      mails.map(async (req) => {
        const lastViewedAt = viewMap.get(req.id);
        const unreadCount = await this.prisma.mailMessage.count({
          where: {
            mailId: req.id,
            senderId: { not: user.id },
            deletedAt: null,
            ...(lastViewedAt ? { createdAt: { gt: lastViewedAt } } : {}),
          },
        });
        return { ...req, unreadCount };
      }),
    );

    return {
      ...result,
      data: mailsWithUnread.map((r) =>
        this.transformMail(r, user.role as Role),
      ),
    };
  }

  // ──────────────────────────── Get Single ─────────────────────────────────

  private async getMailByIdInternal(mailId: string) {
    const mail = await this.prisma.mail.findUnique({
      where: { id: mailId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
        assignee: {
          select: { id: true, name: true, email: true, role: true },
        },
        assignees: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
        organization: {
          select: { id: true, name: true, logoUrl: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatarUrl: true,
              },
            },
          },
        },
        actionLogs: {
          orderBy: { createdAt: 'asc' },
          include: {
            performer: {
              select: { id: true, name: true, role: true },
            },
          },
        },
        _count: { select: { messages: true } },
      },
    });

    if (!mail) return null;

    // Optimized: Fetch all files for all messages in this mail with a single query
    const messageIds = mail.messages.map((m) => m.id);
    const allFiles = await this.prisma.file.findMany({
      where: {
        entityType: 'MAIL_MESSAGE',
        entityId: { in: messageIds },
      },
      select: {
        id: true,
        path: true,
        filename: true,
        mimeType: true,
        size: true,
        entityId: true,
      },
    });

    // Group files by messageId for easy lookup
    type FileRecord = (typeof allFiles)[number];
    const filesMap = allFiles.reduce<Record<string, FileRecord[]>>(
      (acc, file) => {
        if (!acc[file.entityId]) acc[file.entityId] = [];
        acc[file.entityId].push(file);
        return acc;
      },
      {},
    );

    const messagesWithFiles = mail.messages.map((msg) => ({
      ...msg,
      files: filesMap[msg.id] || [],
    }));

    return { ...mail, messages: messagesWithFiles };
  }

  async getMailById(mailId: string, user: MailUser) {
    const mail = await this.getMailByIdInternal(mailId);

    if (!mail) {
      throw new NotFoundException('Mail not found');
    }

    // Permission check: creator, assignee (single or M2M), target role, or admin
    const isAdmin =
      ADMIN_ROLES.has(user.role as Role) ||
      (ORG_OPERATIONAL_ROLES.has(user.role as Role) &&
        mail.organizationId === user.organizationId);
    const isCreator = mail.creatorId === user.id;
    const isSingleAssignee = mail.assigneeId === user.id;
    const isM2MAssignee =
      mail.assignees?.some((a) => a.id === user.id) ?? false;
    const isTargetRole =
      mail.targetRole === user.role ||
      (mail.targetRole === 'ORG_STAFF' &&
        (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER));

    if (
      !isAdmin &&
      !isCreator &&
      !isSingleAssignee &&
      !isM2MAssignee &&
      !isTargetRole
    ) {
      throw new ForbiddenException('You do not have access to this mail');
    }

    // Mark as read when viewed
    await this.markAsRead(mailId, user.id);

    return this.transformMail(mail, user.role as Role);
  }

  // ──────────────────────────── Update ─────────────────────────────────────

  async updateMail(mailId: string, dto: UpdateMailDto, user: MailUser) {
    const existing = await this.prisma.mail.findUnique({
      where: { id: mailId },
    });

    if (!existing) {
      throw new NotFoundException('Mail not found');
    }

    // Permission: only admins or the assignee can update
    const isAdmin =
      ADMIN_ROLES.has(user.role as Role) ||
      (ORG_OPERATIONAL_ROLES.has(user.role as Role) &&
        existing.organizationId === user.organizationId);
    const isAssignee = existing.assigneeId === user.id;
    const isCreator = existing.creatorId === user.id;

    if (!isAdmin && !isAssignee && !isCreator) {
      throw new ForbiddenException(
        'You do not have permission to update this mail',
      );
    }

    // Non-admins can only close their own mails
    if (!isAdmin && !isAssignee && isCreator) {
      if (dto.status && dto.status !== MailStatus.CLOSED) {
        throw new ForbiddenException('You can only close your own mails');
      }
      if (dto.assigneeId || dto.priority) {
        throw new ForbiddenException(
          'You do not have permission to change assignment or priority',
        );
      }
    }

    const updateData: Prisma.MailUpdateInput = {};
    const logDetails: Record<string, unknown> = {};

    if (dto.status && dto.status !== existing.status) {
      updateData.status = dto.status as MailStatus;
      logDetails.statusFrom = existing.status;
      logDetails.statusTo = dto.status;
    }

    if (dto.assigneeId && dto.assigneeId !== existing.assigneeId) {
      // Verify assignee exists
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
        select: { id: true },
      });
      if (!assignee) {
        throw new BadRequestException('Assignee user not found');
      }
      updateData.assignee = { connect: { id: dto.assigneeId } };
      logDetails.assigneeId = dto.assigneeId;
    }

    if (dto.priority && dto.priority !== existing.priority) {
      updateData.priority = dto.priority;
      logDetails.priorityFrom = existing.priority;
      logDetails.priorityTo = dto.priority;
    }

    if (Object.keys(updateData).length === 0) {
      return this.transformMail(
        await this.getMailByIdInternal(mailId),
        user.role as Role,
      );
    }

    const updatedMail = await this.prisma.$transaction(async (tx) => {
      const req = await tx.mail.update({
        where: { id: mailId },
        data: updateData,
      });

      const action = dto.status
        ? 'STATUS_CHANGED'
        : dto.assigneeId
          ? 'ASSIGNED'
          : 'UPDATED';

      await tx.mailActionLog.create({
        data: {
          mailId,
          performedBy: user.id,
          action,
          details: logDetails as Prisma.InputJsonValue,
        },
      });
      return req;
    });

    // --- Persistent Notifications for Updates ---
    if (dto.status && dto.status !== existing.status) {
      await this.notifyParticipants(
        updatedMail,
        {
          title: 'Mail Status Updated',
          body: `The status of mail "${existing.subject}" is now ${dto.status}.`,
          type: 'MAIL_STATUS_CHANGE',
          metadata: { status: dto.status },
        },
        user.id,
      );
    }

    if (dto.assigneeId && dto.assigneeId !== existing.assigneeId) {
      await this.notifyParticipants(
        updatedMail,
        {
          title: 'Mail Assigned to You',
          body: `You have been assigned to mail "${existing.subject}".`,
          type: 'MAIL_ASSIGNED',
        },
        user.id,
        [dto.assigneeId],
      );
    }

    const fullMail = await this.getMailByIdInternal(mailId);
    const transformed = this.transformMail(fullMail, user.role as Role);

    // Emit update to appropriate rooms
    this.events.emitToRoom(`mail:${mailId}`, 'mail:update', transformed);
    this.events.emitToRoom(
      `role:${Role.PLATFORM_ADMIN}`,
      'mail:update',
      fullMail,
    );
    this.events.emitToRole(Role.SUPER_ADMIN, 'mail:update', fullMail);

    return transformed;
  }

  // ──────────────────────────── Add Message ────────────────────────────────

  async addMessage(mailId: string, dto: CreateMessageDto, user: MailUser) {
    const mail = await this.prisma.mail.findUnique({
      where: { id: mailId },
    });

    if (!mail) throw new NotFoundException('Mail not found');

    // --- Org Status Enforcement for Replies ---
    if (user.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { status: true },
      });
      const status = org?.status as OrgStatus | undefined;
      if (status && status !== OrgStatus.APPROVED) {
        // Only allow if this is a support thread (to/from platform admin)
        const isSupportThread =
          mail.targetRole === Role.PLATFORM_ADMIN ||
          mail.targetRole === Role.SUPER_ADMIN ||
          mail.creatorRole === Role.PLATFORM_ADMIN ||
          mail.creatorRole === Role.SUPER_ADMIN;
        if (!isSupportThread) {
          throw new ForbiddenException(
            'Your organization is not active. You can only reply to platform support threads.',
          );
        }
      }
    }

    if (
      mail.status === MailStatus.CLOSED ||
      mail.status === MailStatus.RESOLVED ||
      mail.status === MailStatus.NO_REPLY
    ) {
      throw new BadRequestException(
        'This thread is closed or does not allow replies.',
      );
    }

    // Permission: creator, assignee, target role, or admin
    const isAdmin =
      ADMIN_ROLES.has(user.role as Role) ||
      (ORG_OPERATIONAL_ROLES.has(user.role as Role) &&
        mail.organizationId === user.organizationId);
    const isCreator = mail.creatorId === user.id;
    const isAssignee = mail.assigneeId === user.id;
    const isM2MAssignee = (await this.prisma.mail.count({
      where: { id: mailId, assignees: { some: { id: user.id } } },
    })) > 0;
    const isTargetRole =
      mail.targetRole === user.role ||
      (mail.targetRole === 'ORG_STAFF' &&
        (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER));

    if (!isAdmin && !isCreator && !isAssignee && !isM2MAssignee && !isTargetRole) {
      throw new ForbiddenException(
        'You do not have permission to reply to this mail',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const msg = await tx.mailMessage.create({
        data: {
          mailId,
          senderId: user.id,
          content: dto.content,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
        },
      });

      await tx.mailActionLog.create({
        data: {
          mailId,
          performedBy: user.id,
          action: 'MESSAGE_SENT',
        },
      });

      // Auto-update status if needed AND always update mail.updatedAt
      let newStatus: MailStatus | undefined;
      if (
        mail.status === MailStatus.AWAITING_RESPONSE &&
        mail.creatorId !== user.id
      ) {
        newStatus = MailStatus.IN_PROGRESS;
      } else if (mail.status === MailStatus.OPEN && isAdmin) {
        newStatus = MailStatus.IN_PROGRESS;
      }

      await tx.mail.update({
        where: { id: mailId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      // Mark as read for the sender immediately
      await tx.mailUserView.upsert({
        where: { userId_mailId: { userId: user.id, mailId } },
        update: { lastViewedAt: new Date() },
        create: { userId: user.id, mailId, lastViewedAt: new Date() },
      });

      return [msg];
    });

    const fullMail = await this.getMailByIdInternal(mailId);
    const transformed = this.transformMail(fullMail, user.role as Role);
    if (!transformed) throw new NotFoundException('Mail not found');

    // --- Persistent Notifications for Replies ---
    const bodyContent = `${user.name || user.email} replied to mail "${mail.subject}".`;
    await this.notifyParticipants(
      mail,
      {
        title: 'New Reply in Mail Thread',
        body: bodyContent,
        type: 'MAIL_MESSAGE',
      },
      user.id,
    );

    // Notify rooms (real-time)
    this.events.emitToRoom(`mail:${mailId}`, 'mail:message', {
      mailId,
      message: transformed.messages[transformed.messages.length - 1],
    });

    // Notify total unread count changes
    this.emitUnreadUpdateToParticipants(mail, user.id);

    return transformed;
  }

  // ────────────────────────── Contactable Users ─────────────────────────────

  async getContactableUsers(
    user: MailUser,
    search?: string,
  ): Promise<ContactTarget[]> {
    const role = user.role as Role;
    const searchQuery = search?.trim();
    const includeRoleTargets = !searchQuery;
    const searchRole = searchQuery && (Object.values(Role) as string[]).includes(searchQuery.toUpperCase())
      ? (searchQuery.toUpperCase() as Role)
      : undefined;

    const targets: ContactTarget[] = [];

    const searchFilter: Prisma.UserWhereInput = searchQuery
      ? {
          OR: [
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { email: { contains: searchQuery, mode: 'insensitive' } },
            { phone: { contains: searchQuery, mode: 'insensitive' } },
            ...(searchRole ? [{ role: { equals: searchRole } }] : []),
            {
              teacherProfile: {
                is: { designation: { contains: searchQuery, mode: 'insensitive' } },
              },
            },
            { studentProfile: { is: { registrationNumber: { contains: searchQuery, mode: 'insensitive' } } } },
            { studentProfile: { is: { rollNumber: { contains: searchQuery, mode: 'insensitive' } } } },
            { guardianProfile: { is: { phone: { contains: searchQuery, mode: 'insensitive' } } } },
          ],
        }
      : {};

    // Helper to add users
    const addUsers = async (where: Prisma.UserWhereInput) => {
      const users = await this.prisma.user.findMany({
        where: { id: { not: user.id }, ...where, ...searchFilter },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          teacherProfile: { select: { designation: true } },
        },
        orderBy: [{ name: 'asc' }, { email: 'asc' }],
        take: 20,
      });
      users.forEach((u) => {
        const profile = u.teacherProfile as { designation?: string } | null;
        targets.push({
          id: u.id,
          label: u.name || u.email,
          email: u.email,
          type: 'USER',
          role: u.role,
          avatarUrl: u.avatarUrl,
          description: profile?.designation || formatRoleLabel(u.role),
        });
      });
    };

    // --- Org Status Enforcement for Contacts ---
    let organizationStatus: OrgStatus = OrgStatus.APPROVED;
    if (user.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { status: true },
      });
      organizationStatus = (org?.status as OrgStatus) || OrgStatus.APPROVED;
    }

    if (organizationStatus !== OrgStatus.APPROVED) {
      // Suspended/Rejected/Pending orgs can ONLY see platform administrative team
      if (includeRoleTargets) {
        targets.push({
          id: `ROLE:${Role.PLATFORM_ADMIN}`,
          label: 'Platform Administrative Team',
          type: 'ROLE',
          role: Role.PLATFORM_ADMIN,
        });
      }
      return targets;
    }

    if (role === Role.SUPER_ADMIN) {
      // Super Admin -> All/Single Platform Admin, All/Single Org Admin
      if (includeRoleTargets) {
        targets.push({
          id: `ROLE:${Role.PLATFORM_ADMIN}`,
          label: 'All Platform Admins',
          type: 'ROLE',
          role: Role.PLATFORM_ADMIN,
        });
        targets.push({
          id: `ROLE:${Role.ORG_ADMIN}`,
          label: 'All Org Admins',
          type: 'ROLE',
          role: Role.ORG_ADMIN,
        });
      }
      await addUsers({ role: { in: [Role.PLATFORM_ADMIN, Role.ORG_ADMIN] } });
    } else if (role === Role.PLATFORM_ADMIN) {
      // Platform Admin -> Super Admin, All/Single Org Admin
      if (includeRoleTargets) {
        targets.push({
          id: `ROLE:${Role.ORG_ADMIN}`,
          label: 'All Org Admins',
          type: 'ROLE',
          role: Role.ORG_ADMIN,
        });
      }
      await addUsers({ role: { in: [Role.SUPER_ADMIN, Role.ORG_ADMIN] } });
    } else if (role === Role.ORG_ADMIN || role === Role.SUB_ADMIN) {
      // Org Admin/Sub Admin -> operational org contacts plus platform support.
      if (includeRoleTargets) {
        targets.push({
          id: `ROLE:${Role.PLATFORM_ADMIN}`,
          label: 'Platform Administrative Team',
          type: 'ROLE',
          role: Role.PLATFORM_ADMIN,
        });
        targets.push({
          id: `ROLE:${Role.TEACHER}`,
          label: 'All Teachers',
          type: 'ROLE',
          role: Role.TEACHER,
        });
        targets.push({
          id: `ROLE:${Role.ORG_MANAGER}`,
          label: 'All Org Managers',
          type: 'ROLE',
          role: Role.ORG_MANAGER,
        });
        targets.push({
          id: `ROLE:${Role.FINANCE_MANAGER}`,
          label: 'All Finance Managers',
          type: 'ROLE',
          role: Role.FINANCE_MANAGER,
        });
        targets.push({
          id: `ROLE:ORG_STAFF`,
          label: 'All Employees (Teachers & Managers)',
          type: 'ROLE',
          role: 'ORG_STAFF',
        });
      }

      await addUsers({
        organizationId: user.organizationId,
        role: {
          in: [
            Role.ORG_ADMIN,
            Role.SUB_ADMIN,
            Role.ORG_MANAGER,
            Role.FINANCE_MANAGER,
            Role.TEACHER,
            Role.STUDENT,
            Role.GUARDIAN,
          ],
        },
      });
    } else if (role === Role.ORG_MANAGER) {
      await addUsers({
        organizationId: user.organizationId,
        role: { in: [Role.ORG_ADMIN, Role.SUB_ADMIN, Role.TEACHER] },
      });
    } else if (role === Role.TEACHER) {
      // Teachers -> Single Org Manager, Single Fellow Teacher
      await addUsers({
        organizationId: user.organizationId,
        role: { in: [Role.ORG_MANAGER, Role.SUB_ADMIN, Role.TEACHER] },
      });
    } else if (role === Role.FINANCE_MANAGER) {
      await addUsers({
        organizationId: user.organizationId,
        role: { in: [Role.ORG_ADMIN, Role.SUB_ADMIN, Role.STUDENT, Role.GUARDIAN] },
      });
    } else if (role === Role.GUARDIAN) {
      if (includeRoleTargets) {
        targets.push({
          id: `ROLE:${Role.PLATFORM_ADMIN}`,
          label: 'Platform Administrative Team',
          type: 'ROLE',
          role: Role.PLATFORM_ADMIN,
        });
      }
      await addUsers({
        organizationId: user.organizationId,
        role: { in: [Role.ORG_ADMIN, Role.SUB_ADMIN, Role.FINANCE_MANAGER] },
      });
    }

    return targets;
  }

  // ─────────────────────────── Unread Tracking ─────────────────────────────

  async markAsRead(mailId: string, userId: string) {
    await this.prisma.mailUserView.upsert({
      where: {
        userId_mailId: { userId, mailId },
      },
      update: { lastViewedAt: new Date() },
      create: { userId, mailId, lastViewedAt: new Date() },
    });

    // Emit trigger for frontend to refresh unread count
    this.events.emitToUser(userId, 'unread:update', null);
  }

  async getUnreadCount(user: MailUser): Promise<{
    unread: number;
    total: number;
    countsByStatus: Record<string, number>;
  }> {
    const isOrgStaff =
      user.role === Role.TEACHER || user.role === Role.ORG_MANAGER;

    // Build participation filter (same logic as getMails)
    const participationFilter: Prisma.MailWhereInput =
      user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN
        ? {
            OR: [
              { organizationId: null },
              { creatorId: user.id },
              { assigneeId: user.id },
              { assignees: { some: { id: user.id } } },
              { targetRole: user.role as Role },
              ...(user.role === Role.SUPER_ADMIN
                ? [
                    { targetRole: Role.PLATFORM_ADMIN as Role },
                    { targetRole: Role.SUPER_ADMIN as Role },
                  ]
                : []),
            ],
          }
        : {
            OR: [
              { creatorId: user.id },
              { assigneeId: user.id },
              { assignees: { some: { id: user.id } } },
              { targetRole: user.role as Role },
              ...(isOrgStaff ? [{ targetRole: 'ORG_STAFF' as Role }] : []),
              // Org admins and sub admins see everything in their org
              ...(user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN
                ? [{ organizationId: user.organizationId }]
                : []),
            ],
          };

    // Get status counts (all statuses)
    const statusCounts = await this.prisma.mail.groupBy({
      by: ['status'],
      where: participationFilter,
      _count: { _all: true },
    });

    const countsByStatus: Record<string, number> = {};
    for (const s of statusCounts) {
      countsByStatus[s.status] = s._count._all;
    }

    // 1. All relevant mails based on participation (including platform team mail)
    const relevantMails = await this.prisma.mail.findMany({
      where: participationFilter,
      select: {
        id: true,
        userViews: {
          where: { userId: user.id },
          select: { lastViewedAt: true },
        },
      },
    });

    const totalActive = relevantMails.length;

    // 2. Count mails with unread messages
    let unreadMailCount = 0;

    for (const mail of relevantMails) {
      const lastViewed = mail.userViews[0]?.lastViewedAt;

      const hasUnread = await this.prisma.mailMessage.count({
        where: {
          mailId: mail.id,
          createdAt: lastViewed ? { gt: lastViewed } : undefined,
          senderId: { not: user.id }, // Don't count own messages as unread
          deletedAt: null,
        },
        take: 1,
      });

      if (hasUnread > 0) unreadMailCount++;
    }

    return {
      unread: unreadMailCount,
      total: totalActive,
      countsByStatus,
    };
  }

  // ─────────────────── WebSocket Notification Helpers ───────────────────────

  private emitUnreadUpdateToParticipants(
    mail: {
      creatorId: string;
      assigneeId: string | null;
      targetRole: string | null;
    },
    excludeUserId?: string,
  ) {
    // 1. Creator
    if (mail.creatorId !== excludeUserId) {
      this.events.emitToUser(mail.creatorId, 'unread:update', null);
    }

    // 2. Single assignee (legacy field)
    if (mail.assigneeId && mail.assigneeId !== excludeUserId) {
      this.events.emitToUser(mail.assigneeId, 'unread:update', null);
    }

    // 3. Target role group (covers M2M assignees who are in these role rooms)
    if (mail.targetRole) {
      this.events.emitToRole(mail.targetRole, 'unread:update', null);
    }

    // 4. Platform admins & super admins always see all mails
    this.events.emitToRole(Role.SUPER_ADMIN, 'unread:update', null);
    this.events.emitToRole(Role.PLATFORM_ADMIN, 'unread:update', null);
  }

  /**
   * Helper to send notifications to participants while filtering for admin noise and role-based URLs.
   */
  private async notifyParticipants(
    mail: {
      id: string;
      subject: string;
      creatorId: string;
      assigneeId?: string | null;
      targetRole?: string | null;
      organizationId?: string | null;
    },
    notification: { title: string; body: string; type: string; metadata?: NotificationMetadata },
    senderId: string,
    forceTargetIds?: string[],
  ) {
    const mailId = mail.id;
    const participantIds = new Set<string>(forceTargetIds || []);

    if (!participantIds.size) {
      if (mail.creatorId !== senderId) participantIds.add(mail.creatorId);
      if (mail.assigneeId && mail.assigneeId !== senderId)
        participantIds.add(mail.assigneeId);

      // M2M Assignees
      const m2m = await this.prisma.user.findMany({
        where: {
          assignedMails: { some: { id: mailId } },
          id: { not: senderId },
        },
        select: { id: true },
      });
      m2m.forEach((a) => participantIds.add(a.id));
    }

    if (!participantIds.size && !mail.targetRole) return;

    // Fetch roles and org details for participants and sender
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { role: true },
    });
    const isOrgSender =
      sender?.role !== Role.SUPER_ADMIN && sender?.role !== Role.PLATFORM_ADMIN;

    const recipients = await this.prisma.user.findMany({
      where: { id: { in: Array.from(participantIds) } },
      select: {
        id: true,
        role: true,
        organization: { select: { name: true } },
      },
    });

    for (const recipient of recipients) {
      const isAdminRecipient =
        recipient.role === Role.SUPER_ADMIN ||
        recipient.role === Role.PLATFORM_ADMIN;

      // --- FILTER: Admins don't receive notifications from Org Users ---
      if (isAdminRecipient && isOrgSender) continue;

      // --- URL Logic ---
      let actionUrl = `/mail?mailId=${mailId}`;
      if (isAdminRecipient) {
        actionUrl = `/admin/mail?mailId=${mailId}`;
      }
      await this.notifications.createNotification({
        userId: recipient.id,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        actionUrl,
        metadata: { ...(notification.metadata || {}), mailId },
      });
    }
  }

  /**
   * Anonymizes Super Admin / Platform Admin sender info for non-admin viewers.
   */
  private anonymizeUser<T extends MailIdentity | null | undefined>(user: T, viewerRole: Role): T {
    if (!user) return user;
    const isAdminSender =
      user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN;
    const isNonAdminViewer = !ADMIN_ROLES.has(viewerRole);

    if (isAdminSender && isNonAdminViewer) {
      return {
        ...user,
        name: 'EduVerse Team',
        email:
          user.role === Role.SUPER_ADMIN ? 'System Admin' : 'Platform Admin',
      } as T;
    }
    return user;
  }

  /**
   * Transforms a mail object by anonymizing administrative identities if the viewer is a non-admin.
   */
  private transformMail<T extends TransformableMail | null | undefined>(mail: T, viewerRole: Role): T {
    if (!mail) return mail;

    const anonymized = {
      ...mail,
      creator: this.anonymizeUser(mail.creator, viewerRole),
      assignee: this.anonymizeUser(mail.assignee, viewerRole),
      assignees: mail.assignees?.map((u) => this.anonymizeUser(u, viewerRole)),
      messages: mail.messages?.map((m) => ({
        ...m,
        sender: this.anonymizeUser(m.sender, viewerRole),
      })),
      actionLogs: mail.actionLogs?.map((log) => ({
        ...log,
        performer: this.anonymizeUser(log.performer, viewerRole),
      })),
    };

    return anonymized as T;
  }
}
