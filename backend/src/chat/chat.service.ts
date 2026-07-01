import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { TeacherService } from '../teacher/teacher.service';
import { CreateDirectChatDto } from './dto/create-direct-chat.dto';
import { CreateGroupChatDto } from './dto/create-group.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Role,
  ChatType,
  ChatParticipantRole,
  ChatMessageType,
  Prisma,
} from '@/prisma/prisma-client';
import { fuzzyFilterAndRank } from '../common/utils';

interface CurrentUser {
  id: string;
  role: Role;
  organizationId: string | null;
  name?: string;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly notifications: NotificationsService,
    private readonly teacherService: TeacherService,
  ) { }

  private isPlatformUser(role: Role) {
    return role === Role.SUPER_ADMIN || role === Role.PLATFORM_ADMIN;
  }

  private async getAssignedStudentUserIds(userId: string, role: Role) {
    if (role !== Role.TEACHER && role !== Role.ORG_MANAGER) return [];

    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
      include: { sections: { select: { id: true } } },
    });
    const sectionIds = teacher?.sections.map((section) => section.id) || [];
    if (sectionIds.length === 0) return [];

    const enrollments = await this.prisma.enrollment.findMany({
      where: { sectionId: { in: sectionIds }, isExcludedFromCohort: false },
      select: { student: { select: { userId: true } } },
    });

    return enrollments.map((enrollment) => enrollment.student.userId);
  }

  private async getAssignedTeacherUserIdsForStudent(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        enrollments: {
          where: { isExcludedFromCohort: false },
          select: {
            section: {
              select: {
                teachers: { select: { userId: true } },
              },
            },
          },
        },
      },
    });

    return [
      ...new Set(
        student?.enrollments.flatMap((enrollment) =>
          enrollment.section.teachers.map((teacher) => teacher.userId),
        ) || [],
      ),
    ];
  }

  private async canCreateDirectChatWith(
    user: CurrentUser,
    targetUser: { id: string; role: Role; organizationId: string | null },
  ) {
    if (user.id === targetUser.id) return false;

    const userIsPlatform = this.isPlatformUser(user.role);
    const targetIsPlatform = this.isPlatformUser(targetUser.role);
    if (userIsPlatform || targetIsPlatform) {
      return userIsPlatform && targetIsPlatform;
    }

    if (targetUser.organizationId !== user.organizationId) return false;

    if (user.role === Role.STUDENT) {
      const teacherUserIds = await this.getAssignedTeacherUserIdsForStudent(user.id);
      return targetUser.role === Role.TEACHER && teacherUserIds.includes(targetUser.id);
    }

    if (user.role === Role.GUARDIAN) {
      return ([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.FINANCE_MANAGER] as Role[]).includes(targetUser.role);
    }

    if (user.role === Role.FINANCE_MANAGER) {
      return ([Role.ORG_ADMIN, Role.SUB_ADMIN] as Role[]).includes(targetUser.role);
    }

    if (user.role === Role.TEACHER) {
      if (([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER] as Role[]).includes(targetUser.role)) {
        return true;
      }
      const studentUserIds = await this.getAssignedStudentUserIds(user.id, user.role);
      return targetUser.role === Role.STUDENT && studentUserIds.includes(targetUser.id);
    }

    if (user.role === Role.ORG_MANAGER) {
      if (([Role.ORG_ADMIN, Role.SUB_ADMIN] as Role[]).includes(targetUser.role)) return true;
      const studentUserIds = await this.getAssignedStudentUserIds(user.id, user.role);
      if (targetUser.role === Role.STUDENT) return studentUserIds.includes(targetUser.id);
      if (targetUser.role === Role.TEACHER) {
        const manager = await this.prisma.teacher.findUnique({
          where: { userId: user.id },
          include: { sections: { select: { teachers: { select: { userId: true } } } } },
        });
        const teacherUserIds = manager?.sections.flatMap((section) =>
          section.teachers.map((teacher) => teacher.userId),
        ) || [];
        return teacherUserIds.includes(targetUser.id);
      }
      return false;
    }

    if (user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN) {
      return targetUser.organizationId === user.organizationId;
    }

    return false;
  }

  private getChatSearchTerms(query: string) {
    const normalized = query.trim().replace(/\s+/g, ' ');
    if (!normalized) return [];

    const terms = new Set([normalized]);
    const lower = normalized.toLowerCase();
    const phoneticPairs: Array<[RegExp, string]> = [
      [/ahmed/g, 'ahmad'],
      [/ahmad/g, 'ahmed'],
      [/mohammed/g, 'muhammad'],
      [/muhammad/g, 'mohammed'],
      [/mohammad/g, 'muhammad'],
      [/fatima/g, 'fatma'],
      [/fatma/g, 'fatima'],
    ];

    for (const [pattern, replacement] of phoneticPairs) {
      const variant = lower.replace(pattern, replacement);
      if (variant !== lower) terms.add(variant);
    }

    const compact = lower.replace(/[aeiou]/g, '');
    if (compact.length >= 3) terms.add(compact);

    return Array.from(terms);
  }

  private getRoleSearchWhere(searchTerms: string[], targetRole?: Role): Prisma.UserWhereInput {
    const userTextSearch = searchTerms.flatMap((term) => [
      { name: { contains: term, mode: 'insensitive' as const } },
      { email: { contains: term, mode: 'insensitive' as const } },
      { phone: { contains: term, mode: 'insensitive' as const } },
    ]);

    const studentSearch = searchTerms.flatMap((term) => [
      { studentProfile: { is: { registrationNumber: { contains: term, mode: 'insensitive' as const } } } },
      { studentProfile: { is: { rollNumber: { contains: term, mode: 'insensitive' as const } } } },
    ]);

    const teacherSearch = searchTerms.map((term) => ({
      teacherProfile: { is: { designation: { contains: term, mode: 'insensitive' as const } } },
    }));

    const guardianSearch = searchTerms.flatMap((term) => [
      { guardianProfile: { is: { phone: { contains: term, mode: 'insensitive' as const } } } },
      {
        guardianProfile: {
          is: {
            studentLinks: {
              some: {
                OR: [
                  { relationshipLabel: { contains: term, mode: 'insensitive' as const } },
                  { student: { registrationNumber: { contains: term, mode: 'insensitive' as const } } },
                  { student: { rollNumber: { contains: term, mode: 'insensitive' as const } } },
                  { student: { user: { name: { contains: term, mode: 'insensitive' as const } } } },
                  { student: { user: { email: { contains: term, mode: 'insensitive' as const } } } },
                ],
              },
            },
          },
        },
      },
    ]);

    if (targetRole === Role.STUDENT) return { OR: [...userTextSearch, ...studentSearch] };
    if (targetRole === Role.TEACHER || targetRole === Role.ORG_MANAGER) return { OR: [...userTextSearch, ...teacherSearch] };
    if (targetRole === Role.GUARDIAN) return { OR: [...userTextSearch, ...guardianSearch] };

    return { OR: [...userTextSearch, ...studentSearch, ...teacherSearch, ...guardianSearch] };
  }

  private getContactableUsersWhere(user: CurrentUser, assignedStudentUserIds: string[], teacherUserIds: string[]): Prisma.UserWhereInput {
    if (user.role === Role.TEACHER) {
      return {
        OR: [
          { role: Role.ORG_ADMIN },
          { role: Role.SUB_ADMIN },
          { role: Role.ORG_MANAGER },
          { role: Role.STUDENT, id: { in: assignedStudentUserIds } },
        ],
      };
    }

    if (user.role === Role.STUDENT) {
      return { role: Role.TEACHER, id: { in: teacherUserIds } };
    }

    if (user.role === Role.GUARDIAN) {
      return { role: { in: [Role.ORG_ADMIN, Role.SUB_ADMIN, Role.FINANCE_MANAGER] } };
    }

    if (user.role === Role.FINANCE_MANAGER) {
      return { role: { in: [Role.ORG_ADMIN, Role.SUB_ADMIN] } };
    }

    if (user.role === Role.ORG_MANAGER) {
      return {
        OR: [
          { role: { in: [Role.ORG_ADMIN, Role.SUB_ADMIN] } },
          { role: Role.TEACHER, id: { in: teacherUserIds } },
          { role: Role.STUDENT, id: { in: assignedStudentUserIds } },
        ],
      };
    }

    if (user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN) {
      return {
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
      };
    }

    if (user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN) {
      return { role: { in: [Role.SUPER_ADMIN, Role.PLATFORM_ADMIN] } };
    }

    return { role: { not: Role.STUDENT } };
  }

  async searchUsers(query: string, user: CurrentUser, selectedRole?: Role) {
    const searchQuery = query.trim();
    if (!searchQuery) return [];

    const roleValues = Object.values(Role) as Role[];
    const targetRole = selectedRole && roleValues.includes(selectedRole) ? selectedRole : undefined;
    if (!targetRole) return [];
    const searchTerms = this.getChatSearchTerms(searchQuery);

    let assignedStudentUserIds: string[] = [];
    let teacherUserIds: string[] = [];

    if (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) {
      assignedStudentUserIds = await this.getAssignedStudentUserIds(user.id, user.role);
    }

    if (user.role === Role.STUDENT) {
      teacherUserIds = await this.getAssignedTeacherUserIdsForStudent(user.id);
    } else if (user.role === Role.ORG_MANAGER) {
      const manager = await this.prisma.teacher.findUnique({
        where: { userId: user.id },
        include: { sections: { select: { teachers: { select: { userId: true } } } } },
      });
      teacherUserIds = manager?.sections.flatMap((section) =>
        section.teachers.map((teacher) => teacher.userId),
      ) || [];
    }

    const baseAnd: Prisma.UserWhereInput[] = [
      this.getContactableUsersWhere(user, assignedStudentUserIds, teacherUserIds),
      ...(targetRole ? [{ role: targetRole }] : []),
    ];
    const whereClause: Prisma.UserWhereInput = {
      id: { not: user.id }, // don't return self
      ...(this.isPlatformUser(user.role) ? {} : { organizationId: user.organizationId }),
      AND: [...baseAnd, this.getRoleSearchWhere(searchTerms, targetRole)],
    };
    const fallbackWhereClause: Prisma.UserWhereInput = {
      id: { not: user.id },
      ...(this.isPlatformUser(user.role) ? {} : { organizationId: user.organizationId }),
      AND: baseAnd,
    };
    const userSelect = {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      avatarUpdatedAt: true,
      phone: true,
      studentProfile: {
        select: {
          registrationNumber: true,
          rollNumber: true,
        },
      },
      teacherProfile: {
        select: {
          designation: true,
        },
      },
      guardianProfile: {
        select: {
          phone: true,
          studentLinks: {
            select: {
              relationshipLabel: true,
              student: {
                select: {
                  registrationNumber: true,
                  rollNumber: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
            take: 5,
          },
        },
      },
    } satisfies Prisma.UserSelect;

    const usersList = await this.prisma.user.findMany({
      where: whereClause,
      select: userSelect,
      take: 20,
    });

    if (usersList.length === 0) {
      const candidates = await this.prisma.user.findMany({
        where: fallbackWhereClause,
        select: userSelect,
        take: 500,
      });
      return fuzzyFilterAndRank(candidates, searchQuery, (candidate) => [
        candidate.name,
        candidate.email,
        candidate.phone,
        candidate.studentProfile?.registrationNumber,
        candidate.studentProfile?.rollNumber,
        candidate.teacherProfile?.designation,
        candidate.guardianProfile?.phone,
        ...(candidate.guardianProfile?.studentLinks || []).flatMap((link) => [
          link.relationshipLabel,
          link.student?.registrationNumber,
          link.student?.rollNumber,
          link.student?.user?.name,
        ]),
      ]).slice(0, 20);
    }

    return usersList;
  }

  async createDirectChat(dto: CreateDirectChatDto, user: CurrentUser) {
    if (user.id === dto.participantId) {
      throw new BadRequestException('Cannot chat with yourself.');
    }

    // Verify target exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.participantId },
    });
    if (!targetUser) throw new NotFoundException('User not found.');

    const allowed = await this.canCreateDirectChatWith(user, {
      id: targetUser.id,
      role: targetUser.role as Role,
      organizationId: targetUser.organizationId,
    });
    if (!allowed) {
      throw new ForbiddenException('You cannot start a direct chat with this user.');
    }

    // Check if chat already exists
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        type: ChatType.DIRECT,
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: dto.participantId } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (existingChat) {
      return existingChat;
    }

    // Create new direct chat
    const chat = await this.prisma.chat.create({
      data: {
        type: ChatType.DIRECT,
        organizationId: user.organizationId,
        creatorId: user.id,
        participants: {
          create: [
            {
              userId: user.id,
              role: ChatParticipantRole.ADMIN,
              membershipHistory: { create: { activatedAt: new Date() } },
            },
            {
              userId: dto.participantId,
              role: ChatParticipantRole.ADMIN,
              membershipHistory: { create: { activatedAt: new Date() } },
            },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    // Emit chat update event so frontend receives full chat data with participants
    this.events.emitToRoom(`chat:${chat.id}`, 'chat:update', chat);
    this.events.emitToRoom(`user:${user.id}`, 'chat:update', chat);
    this.events.emitToRoom(`user:${dto.participantId}`, 'chat:update', chat);

    return chat;
  }

  async createGroupChat(dto: CreateGroupChatDto, user: CurrentUser) {
    if (
      user.role === Role.STUDENT ||
      user.role === Role.GUARDIAN ||
      user.role === Role.FINANCE_MANAGER
    ) {
      throw new ForbiddenException('Your role cannot create group chats.');
    }

    const participants = Array.from(new Set([...dto.participantIds, user.id]));
    if (participants.length < 2) {
      throw new BadRequestException('Group must have at least 2 participants.');
    }

    // Check organization scoping
    const usersList = await this.prisma.user.findMany({
      where: { id: { in: participants } },
    });

    if (usersList.length !== participants.length) {
      throw new NotFoundException('One or more users not found.');
    }

    const isPlatformUser = (role: Role) =>
      role === Role.SUPER_ADMIN || role === Role.PLATFORM_ADMIN;
    const curUserIsPlatform = isPlatformUser(user.role);

    if (curUserIsPlatform) {
      const orgUsers = usersList.filter((u) => !isPlatformUser(u.role));
      if (orgUsers.length > 0) {
        throw new ForbiddenException(
          'Platform Administrators can only include other Platform Administrators in group chats.',
        );
      }
    } else {
      const externalUsers = usersList.filter(
        (u) =>
          u.organizationId !== user.organizationId || isPlatformUser(u.role),
      );
      if (externalUsers.length > 0) {
        throw new ForbiddenException(
          'Cannot include users outside your organization or Platform Administrators in organization group chats.',
        );
      }

      // Organization Policy: Students can only participate in section-based chats initiated by THEIR teachers.
      const studentsInGroup = usersList.filter((u) => u.role === Role.STUDENT);
      if (studentsInGroup.length > 0) {
        if (user.role !== Role.TEACHER && user.role !== Role.ORG_MANAGER) {
          throw new ForbiddenException(
            'Only teachers or managers can create group chats involving students.',
          );
        }
      }
    }

    // If Teacher, enforce they only add students from their sections (and ONLY students)
    if (user.role === Role.TEACHER) {
      const externalStaff = usersList.filter(
        (u) => u.id !== user.id && u.role !== Role.STUDENT,
      );
      if (externalStaff.length > 0) {
        throw new ForbiddenException(
          'Teachers can only create group chats with students. They cannot add other staff members.',
        );
      }

      // Find teacher sections
      const teacher = await this.prisma.teacher.findUnique({
        where: { userId: user.id },
        include: { sections: true },
      });
      const teacherSectionIds = teacher?.sections.map((s) => s.id) || [];

      // Get students they are trying to add
      const targetStudentUserIds = usersList
        .filter((u) => u.role === Role.STUDENT)
        .map((u) => u.id);

      if (targetStudentUserIds.length > 0) {
        const enrolledStudentsCount = await this.prisma.enrollment.groupBy({
          by: ['studentId'],
          where: {
            student: { userId: { in: targetStudentUserIds } },
            sectionId: { in: teacherSectionIds },
          },
        });

        // Comparing unique students enrolled in teacher's sections vs unique students they're adding
        if (enrolledStudentsCount.length < targetStudentUserIds.length) {
          throw new ForbiddenException(
            'Teachers can only add students from their assigned sections.',
          );
        }
      } else if (participants.length > 1) {
        // If there are participants but no students (and we already excluded other staff),
        // this case shouldn't be reachable but good for safety.
        throw new BadRequestException('Group must contain students.');
      }
    }

    if (user.role === Role.ORG_MANAGER) {
      const assignedStudentUserIds = await this.getAssignedStudentUserIds(
        user.id,
        user.role,
      );
      const manager = await this.prisma.teacher.findUnique({
        where: { userId: user.id },
        include: {
          sections: { select: { teachers: { select: { userId: true } } } },
        },
      });
      const assignedTeacherUserIds = manager?.sections.flatMap((section) =>
        section.teachers.map((teacher) => teacher.userId),
      ) || [];

      const disallowed = usersList.filter((participant) => {
        if (participant.id === user.id) return false;
        if (([Role.ORG_ADMIN, Role.SUB_ADMIN] as Role[]).includes(participant.role)) return false;
        if (participant.role === Role.STUDENT) {
          return !assignedStudentUserIds.includes(participant.id);
        }
        if (participant.role === Role.TEACHER) {
          return !assignedTeacherUserIds.includes(participant.id);
        }
        return true;
      });

      if (disallowed.length > 0) {
        throw new ForbiddenException(
          'Managers can only create groups for assigned academic sections.',
        );
      }
    }

    const chat = await this.prisma.chat.create({
      data: {
        type: ChatType.GROUP,
        name: dto.name,
        organizationId: user.organizationId,
        creatorId: user.id,
        participants: {
          create: participants.map((userId) => ({
            userId,
            role:
              userId === user.id
                ? ChatParticipantRole.ADMIN
                : ChatParticipantRole.MEMBER,
            membershipHistory: { create: { activatedAt: new Date() } },
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    // Create initial system message
    const userRec = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    const systemMsg = await this.prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        senderId: user.id,
        organizationId: user.organizationId,
        content: `${userRec?.name || 'Someone'} created the group "${dto.name}"`,
        type: ChatMessageType.SYSTEM,
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    // Broadcast to all participants
    for (const p of participants) {
      this.events.emitToRoom(`user:${p}`, 'chat:message', systemMsg);
    }

    // Emit chat update event so frontend receives full chat data with participants
    this.events.emitToRoom(`chat:${chat.id}`, 'chat:update', chat);
    for (const p of participants) {
      this.events.emitToRoom(`user:${p}`, 'chat:update', chat);
    }

    return chat;
  }

  async addParticipants(
    chatId: string,
    dto: AddParticipantsDto,
    user: CurrentUser,
  ) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw new NotFoundException('Chat not found.');
    if (chat.type === ChatType.DIRECT)
      throw new BadRequestException(
        'Cannot add participants to a direct chat.',
      );

    // Permission check: Creator or Org Admin
    const isCreator = chat.creatorId === user.id;
    const isOrgAdmin = user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN;
    if (!isCreator && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only the group creator or an org admin can add participants.',
      );
    }

    const newUsersList = await this.prisma.user.findMany({
      where: {
        id: { in: dto.participantIds },
        organizationId: user.organizationId,
      },
    });

    if (newUsersList.length !== dto.participantIds.length) {
      throw new BadRequestException(
        'One or more users not found or outside organization.',
      );
    }

    // Organization Policy: Only teachers can add students to groups
    const studentsToAdd = newUsersList.filter((u) => u.role === Role.STUDENT);
    if (studentsToAdd.length > 0) {
      if (user.role !== Role.TEACHER && user.role !== Role.ORG_MANAGER) {
        throw new ForbiddenException(
          'Only teachers or managers can add students to group chats.',
        );
      }

      const targetStudentUserIds = studentsToAdd.map((u) => u.id);
      const assignedStudentUserIds = await this.getAssignedStudentUserIds(
        user.id,
        user.role,
      );

      if (
        targetStudentUserIds.some(
          (studentUserId) => !assignedStudentUserIds.includes(studentUserId),
        )
      ) {
        throw new ForbiddenException(
          'You can only add students from your assigned sections.',
        );
      }
    }

    const adminUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    const systemMessages: string[] = [];

    for (const targetUser of newUsersList) {
      const existing = chat.participants.find(
        (p) => p.userId === targetUser.id,
      );
      if (existing) {
        if (existing.isActive) continue; // Already active
        await this.prisma.$transaction([
          this.prisma.chatParticipant.update({
            where: { id: existing.id },
            data: { isActive: true },
          }),
          this.prisma.chatMembershipHistory.create({
            data: { chatParticipantId: existing.id, activatedAt: new Date() },
          }),
        ]);
      } else {
        await this.prisma.chatParticipant.create({
          data: {
            chatId,
            userId: targetUser.id,
            membershipHistory: { create: { activatedAt: new Date() } },
          },
        });
      }
      systemMessages.push(
        `${adminUser?.name || 'Admin'} added ${targetUser.name || targetUser.email} to the group`,
      );
    }

    // Log system messages
    for (const content of systemMessages) {
      const msg = await this.prisma.chatMessage.create({
        data: {
          chatId,
          senderId: user.id,
          organizationId: user.organizationId,
          content,
          type: ChatMessageType.SYSTEM,
        },
        include: { sender: { select: { id: true, name: true } } },
      });
      this.events.emitToRoom(`chat:${chatId}`, 'chat:message', msg);
      // Notify participants individually
      const currentParticipants = await this.prisma.chatParticipant.findMany({
        where: { chatId, isActive: true },
      });
      for (const p of currentParticipants) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:message', msg);
      }
    }

    // Emit chat update event so frontend can refresh with full participant data
    const updatedChat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });
    if (updatedChat) {
      this.events.emitToRoom(`chat:${chatId}`, 'chat:update', updatedChat);
      for (const p of updatedChat.participants) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:update', updatedChat);
      }
    }

    return { message: 'Participants added successfully.' };
  }

  async updateChatLocalState(chatId: string, userId: string, options: { hide?: boolean; clear?: boolean }) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant) throw new NotFoundException('Participant not found');

    const now = new Date();
    const data: any = {};

    if (options.hide) {
      data.hiddenAt = now;
    }
    if (options.clear) {
      data.clearedAt = now;

      // Find the latest message to mark it as read when clearing
      const latestMsg = await this.prisma.chatMessage.findFirst({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
      });
      data.lastReadMessageId = latestMsg?.id || participant.lastReadMessageId;
    }

    const updated = await this.prisma.chatParticipant.update({
      where: { id: participant.id },
      data,
    });

    // Notify user of the change so frontend can refresh
    this.events.emitToRoom(`user:${userId}`, 'chat:update', {
      id: chatId,
      ...data,
    });

    return { message: 'Chat local state updated successfully.' };
  }

  async removeParticipant(
    chatId: string,
    targetUserId: string,
    user: CurrentUser,
  ) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw new NotFoundException('Chat not found.');
    if (chat.type === ChatType.DIRECT)
      throw new BadRequestException(
        'Cannot remove participants from a direct chat.',
      );

    // Creator cannot be removed
    if (targetUserId === chat.creatorId) {
      throw new ForbiddenException(
        'The group creator cannot be removed from the chat.',
      );
    }

    // Permission check: Creator or Org Admin
    const isCreator = chat.creatorId === user.id;
    const isOrgAdmin = user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN;
    if (!isCreator && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only the group creator or an org admin can remove participants.',
      );
    }

    const participant = chat.participants.find(
      (p) => p.userId === targetUserId,
    );
    if (!participant || !participant.isActive) {
      throw new BadRequestException(
        'User is not an active participant of this chat.',
      );
    }

    const adminUserRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    const targetUserRecord = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    const lastHistory = await this.prisma.chatMembershipHistory.findFirst({
      where: { chatParticipantId: participant.id, deactivatedAt: null },
      orderBy: { activatedAt: 'desc' },
    });

    // Log system message FIRST while user is still active so they can see it
    const content = `${adminUserRecord?.name || 'Admin'} removed ${targetUserRecord?.name || targetUserRecord?.email || 'someone'} from the group`;
    const msg = await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: user.id,
        organizationId: user.organizationId,
        content,
        type: ChatMessageType.SYSTEM,
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    this.events.emitToRoom(`chat:${chatId}`, 'chat:message', msg);
    const activeParticipants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true },
    });
    for (const p of activeParticipants) {
      this.events.emitToRoom(`user:${p.userId}`, 'chat:message', msg);
    }
    // Explicitly notify the removed user if they weren't in the list
    if (!activeParticipants.some((p) => p.userId === targetUserId)) {
      this.events.emitToRoom(`user:${targetUserId}`, 'chat:message', msg);
    }

    // NOW deactivate the participant
    await this.prisma.$transaction([
      this.prisma.chatParticipant.update({
        where: { id: participant.id },
        data: { isActive: false },
      }),
      ...(lastHistory
        ? [
          this.prisma.chatMembershipHistory.update({
            where: { id: lastHistory.id },
            data: { deactivatedAt: new Date() },
          }),
        ]
        : []),
    ]);

    // Terminate WebSocket subscription immediately
    await this.events.forceLeaveRoom(targetUserId, `chat:${chatId}`);

    // Emit chat:update to refresh participant list for all users
    const updatedChat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });
    if (updatedChat) {
      this.events.emitToRoom(`chat:${chatId}`, 'chat:update', updatedChat);
      for (const p of updatedChat.participants) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:update', updatedChat);
      }
    }

    return { message: 'Participant removed successfully.' };
  }

  async updateParticipantRole(
    chatId: string,
    targetUserId: string,
    role: ChatParticipantRole,
    user: CurrentUser,
  ) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: { include: { user: true } } },
    });

    if (!chat) throw new NotFoundException('Chat not found.');
    if (chat.type === ChatType.DIRECT)
      throw new BadRequestException(
        'Cannot update roles in a direct chat.',
      );

    // Creator cannot be demoted from ADMIN
    if (targetUserId === chat.creatorId && role !== ChatParticipantRole.ADMIN) {
      throw new ForbiddenException(
        'The group creator must remain as ADMIN.',
      );
    }

    // Permission check: Creator or Org Admin
    const isCreator = chat.creatorId === user.id;
    const isOrgAdmin = user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN;
    if (!isCreator && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only the group creator or an org admin can update participant roles.',
      );
    }

    const participant = chat.participants.find(
      (p) => p.userId === targetUserId,
    );
    if (!participant || !participant.isActive) {
      throw new BadRequestException(
        'User is not an active participant of this chat.',
      );
    }

    const oldRole = participant.role;
    const updatedParticipant = await this.prisma.chatParticipant.update({
      where: { id: participant.id },
      data: { role },
    });

    // Log system message for role change
    const actorName = user.name || 'Admin';
    const targetName = participant.user?.name || 'User';
    let roleChangeMessage: string;

    if (oldRole === role) {
      roleChangeMessage = `${actorName} set ${targetName}'s role to ${role}`;
    } else if (role === ChatParticipantRole.ADMIN) {
      roleChangeMessage = `${actorName} promoted ${targetName} to Admin`;
    } else if (role === ChatParticipantRole.MOD) {
      roleChangeMessage = `${actorName} promoted ${targetName} to Moderator`;
    } else if (role === ChatParticipantRole.MEMBER) {
      roleChangeMessage = `${actorName} demoted ${targetName} to Member`;
    } else {
      roleChangeMessage = `${actorName} changed ${targetName}'s role to ${role}`;
    }

    const systemMessage = await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: user.id,
        organizationId: user.organizationId,
        content: roleChangeMessage,
        type: ChatMessageType.SYSTEM,
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    this.events.emitToRoom(`chat:${chatId}`, 'chat:message', systemMessage);
    const activeParticipants = chat.participants.filter((p) => p.isActive);
    for (const p of activeParticipants) {
      this.events.emitToRoom(`user:${p.userId}`, 'chat:message', systemMessage);
    }

    // Emit chat:update to refresh participant roles for all users
    const updatedChat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });
    if (updatedChat) {
      this.events.emitToRoom(`chat:${chatId}`, 'chat:update', updatedChat);
      for (const p of activeParticipants) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:update', updatedChat);
      }
    }

    return { message: 'Participant role updated successfully.', participant: updatedParticipant };
  }

  async updateChat(
    chatId: string,
    dto: { name?: string; avatarUrl?: string; readOnly?: boolean },
    user: CurrentUser,
  ) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw new NotFoundException('Chat not found.');
    if (chat.type !== ChatType.GROUP)
      throw new BadRequestException('Only group chats can be updated.');

    // Permission check: Creator or Org Admin
    const isCreator = chat.creatorId === user.id;
    const isOrgAdmin = user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN;
    if (!isCreator && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only the group creator or an org admin can update chat settings.',
      );
    }

    const data: Prisma.ChatUpdateInput = {};
    const systemMessages: string[] = [];
    const userRec = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    const actorName = userRec?.name || 'Admin';

    if (dto.name && dto.name !== chat.name) {
      data.name = dto.name;
      systemMessages.push(
        `${actorName} changed the group name to "${dto.name}"`,
      );
    }
    if (dto.avatarUrl !== undefined && dto.avatarUrl !== chat.avatarUrl && dto.avatarUrl !== '') {
      data.avatarUrl = dto.avatarUrl;
      data.avatarUpdatedAt = new Date();
      systemMessages.push(`${actorName} updated the group picture`);
    }
    if (dto.readOnly !== undefined && dto.readOnly !== chat.readOnly) {
      data.readOnly = dto.readOnly;
      systemMessages.push(
        `${actorName} ${dto.readOnly ? 'enabled' : 'disabled'} read-only mode`,
      );
    }

    if (Object.keys(data).length === 0) return chat;

    const updatedChat = await this.prisma.chat.update({
      where: { id: chatId },
      data,
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    // Log system messages & Emit
    for (const content of systemMessages) {
      const msg = await this.prisma.chatMessage.create({
        data: {
          chatId,
          senderId: user.id,
          organizationId: user.organizationId,
          content,
          type: ChatMessageType.SYSTEM,
        },
        include: { sender: { select: { id: true, name: true } } },
      });

      this.events.emitToRoom(`chat:${chatId}`, 'chat:message', msg);
      const activeParticipants = updatedChat.participants.filter(
        (p) => p.isActive,
      );
      for (const p of activeParticipants) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:message', msg);
      }
    }

    // Emit chat update event
    this.events.emitToRoom(`chat:${chatId}`, 'chat:update', updatedChat);
    const activeParticipants = updatedChat.participants.filter(
      (p) => p.isActive,
    );
    for (const p of activeParticipants) {
      this.events.emitToRoom(`user:${p.userId}`, 'chat:update', updatedChat);
    }

    return updatedChat;
  }

  async deleteMessage(chatId: string, messageId: string, user: CurrentUser) {
    await this.verifyChatAccess(chatId, user.id, true);

    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.chatId !== chatId)
      throw new NotFoundException('Message not found.');

    // Permission: Org Admin can delete anything, others only own
    const isOrgAdmin = user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN;
    const isOwnMessage = message.senderId === user.id;
    if (!isOrgAdmin && !isOwnMessage) {
      throw new ForbiddenException('You can only delete your own messages.');
    }

    if (message.deletedAt) return message;

    const updated = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        deletedById: user.id,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
        deletedBy: { select: { id: true, name: true } },
      },
    });

    this.events.emitToRoom(`chat:${chatId}`, 'chat:message:delete', updated);
    const participants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true },
    });
    for (const p of participants) {
      this.events.emitToRoom(
        `user:${p.userId}`,
        'chat:message:delete',
        updated,
      );
    }

    return updated;
  }

  async editMessage(
    chatId: string,
    messageId: string,
    content: string,
    user: CurrentUser,
  ) {
    await this.verifyChatAccess(chatId, user.id, true);

    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.chatId !== chatId)
      throw new NotFoundException('Message not found.');

    // Only the sender can edit their message
    if (message.senderId !== user.id) {
      throw new ForbiddenException('You can only edit your own messages.');
    }

    if (message.deletedAt)
      throw new BadRequestException('Cannot edit a deleted message.');
    if (message.type === ChatMessageType.SYSTEM)
      throw new BadRequestException('Cannot edit system messages.');

    const updated = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { content },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
        replyTo: { include: { sender: { select: { id: true, name: true } } } },
        deletedBy: { select: { id: true, name: true } },
      },
    });

    // Use same event pattern 'chat:message:edit'
    this.events.emitToRoom(`chat:${chatId}`, 'chat:message:edit', updated);
    const participants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true },
    });
    for (const p of participants) {
      this.events.emitToRoom(`user:${p.userId}`, 'chat:message:edit', updated);
    }

    return updated;
  }
  async getUserChats(user: CurrentUser) {
    const chats = await this.prisma.chat.findMany({
      where: {
        participants: { some: { userId: user.id } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Filter chats based on hiddenAt and latest message (revival logic)
    const visibleChats = chats.filter((chat) => {
      const myParticipant = chat.participants.find((p) => p.userId === user.id);
      if (!myParticipant?.hiddenAt) return true;

      const latestMsg = chat.messages[0];
      if (!latestMsg) return false;

      // Revive if there's a message newer than hiddenAt
      return latestMsg.createdAt > myParticipant.hiddenAt;
    });

    // Add unread count for each chat based on user's lastReadMessageId
    const chatsWithUnread = await Promise.all(
      visibleChats.map(async (chat) => {
        const myParticipant = chat.participants.find(
          (p) => p.userId === user.id,
        );

        let lastReadAt: Date | undefined;
        if (myParticipant?.lastReadMessageId) {
          const lastMsg = await this.prisma.chatMessage.findUnique({
            where: { id: myParticipant.lastReadMessageId },
            select: { createdAt: true },
          });
          lastReadAt = lastMsg?.createdAt;
        }

        const history = await this.prisma.chatMembershipHistory.findMany({
          where: { chatParticipantId: myParticipant!.id },
        });

        const visibilityOR = history.map((h) => ({
          createdAt: {
            gte: h.activatedAt,
            ...(h.deactivatedAt ? { lte: h.deactivatedAt } : {}),
          },
        }));

        // Get last message visible to this user
        const lastMessage = await this.prisma.chatMessage.findFirst({
          where: {
            chatId: chat.id,
            ...(visibilityOR.length > 0 ? { OR: visibilityOR } : {}),
          },
          orderBy: { createdAt: 'desc' },
          include: {
            sender: { select: { id: true, name: true, email: true } },
          },
        });

        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            chatId: chat.id,
            createdAt: lastReadAt
              ? { gt: lastReadAt }
              : myParticipant?.clearedAt
                ? { gt: myParticipant.clearedAt }
                : undefined,
            senderId: { not: user.id },
            deletedAt: null,
            type: { not: ChatMessageType.SYSTEM },
            ...(visibilityOR.length > 0 ? { OR: visibilityOR } : {}),
            ...(myParticipant?.clearedAt
              ? { createdAt: { gt: myParticipant.clearedAt } }
              : {}),
          },
        });
        return {
          ...chat,
          messages: lastMessage ? [lastMessage] : [],
          unreadCount,
        };
      }),
    );

    return chatsWithUnread;
  }

  async getChat(chatId: string, user: CurrentUser) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!chat) throw new NotFoundException('Chat not found');

    const myParticipant = chat.participants.find((p) => p.userId === user.id);
    if (!myParticipant) throw new ForbiddenException('Not a participant');

    const lastReadAt = myParticipant.lastReadMessageId
      ? (
        await this.prisma.chatMessage.findUnique({
          where: { id: myParticipant.lastReadMessageId },
          select: { createdAt: true },
        })
      )?.createdAt
      : null;

    const unreadCount = await this.prisma.chatMessage.count({
      where: {
        chatId: chat.id,
        createdAt: lastReadAt
          ? { gt: lastReadAt }
          : myParticipant?.clearedAt
            ? { gt: myParticipant.clearedAt }
            : undefined,
        senderId: { not: user.id },
        deletedAt: null,
        type: { not: ChatMessageType.SYSTEM },
        ...(myParticipant?.clearedAt
          ? { createdAt: { gt: myParticipant.clearedAt } }
          : {}),
      },
    });

    return {
      ...chat,
      unreadCount,
    };
  }

  async getChatMessages(
    chatId: string,
    user: CurrentUser,
    options: { page?: number; limit?: number; aroundId?: string },
  ) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const aroundId = options.aroundId;

    const participant = await this.verifyChatAccess(chatId, user.id, true);
    const history = await this.prisma.chatMembershipHistory.findMany({
      where: { chatParticipantId: participant.id },
    });

    const visibilityOR = history.map((h) => ({
      createdAt: {
        gte: h.activatedAt,
        ...(h.deactivatedAt ? { lte: h.deactivatedAt } : {}),
      },
    }));

    // Local history clearing logic
    const baseWhere: Prisma.ChatMessageWhereInput = {
      chatId,
      ...(visibilityOR.length > 0 ? { OR: visibilityOR } : {}),
      ...(participant.clearedAt
        ? { createdAt: { gt: participant.clearedAt } }
        : {}),
    };

    const include = {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
      },
      deletedBy: { select: { id: true, name: true } },
      replyTo: {
        include: {
          sender: { select: { id: true, name: true } },
        },
      },
    } as const satisfies Prisma.ChatMessageInclude;

    type MessageWithRelations = Prisma.ChatMessageGetPayload<{
      include: typeof include;
    }>;
    let messagesList: MessageWithRelations[] = [];
    let hasMoreBefore = false;
    let hasMoreAfter = false;

    if (aroundId) {
      const target = await this.prisma.chatMessage.findUnique({
        where: { id: aroundId },
      });
      if (!target) throw new NotFoundException('Target message not found.');

      const halfLimit = Math.floor(limit / 2);

      // Messages before and including target
      const before = await this.prisma.chatMessage.findMany({
        where: {
          ...baseWhere,
          createdAt: { ...baseWhere.createdAt as any, lte: target.createdAt },
        },
        orderBy: { createdAt: 'desc' },
        take: halfLimit + 1,
        include,
      });

      // Messages after target
      const after = await this.prisma.chatMessage.findMany({
        where: {
          ...baseWhere,
          createdAt: { ...baseWhere.createdAt as any, gt: target.createdAt },
        },
        orderBy: { createdAt: 'asc' },
        take: halfLimit,
        include,
      });

      messagesList = [...before.reverse(), ...after];

      // Simple flags for context-mode
      hasMoreBefore = before.length > halfLimit;
      hasMoreAfter = after.length >= halfLimit;
    } else {
      const list = await this.prisma.chatMessage.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include,
      });
      messagesList = list.reverse();
      hasMoreBefore =
        page * limit <
        (await this.prisma.chatMessage.count({
          where: {
            chatId,
            ...(visibilityOR.length > 0 ? { OR: visibilityOR } : {}),
          },
        }));
      hasMoreAfter = page > 1;
    }

    const totalCount = await this.prisma.chatMessage.count({
      where: baseWhere,
    });

    // Include read receipts
    const activeParticipants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true, lastReadMessageId: { not: null } },
      select: { userId: true, lastReadMessageId: true },
    });

    const lastReadMsgIds = Array.from(
      new Set(activeParticipants.map((p) => p.lastReadMessageId!)),
    );
    const readMessages = await this.prisma.chatMessage.findMany({
      where: { id: { in: lastReadMsgIds } },
      select: { id: true, createdAt: true },
    });
    const readMap = new Map(
      readMessages.map((m) => [m.id, m.createdAt.getTime()]),
    );

    return {
      data: messagesList.map((m: MessageWithRelations) => ({
        ...m,
        readBy: activeParticipants
          .filter((p) => {
            const readTime = readMap.get(p.lastReadMessageId!);
            // Use getTime() for comparison safety
            return (
              p.userId !== m.senderId &&
              readTime !== undefined &&
              readTime >= new Date(m.createdAt).getTime()
            );
          })
          .map((p) => p.userId),
      })),
      totalRecords: totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      hasMoreBefore,
      hasMoreAfter,
    };
  }

  async sendMessage(chatId: string, dto: SendMessageDto, user: CurrentUser) {
    const participant = await this.verifyChatAccess(chatId, user.id);
    if (!participant.isActive) {
      throw new ForbiddenException(
        'You have been removed from this chat and can no longer send messages.',
      );
    }

    // Check if chat is in readOnly mode (direct chats should never be read-only)
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { readOnly: true, type: true },
    });

    if (chat?.type === ChatType.GROUP && chat?.readOnly && participant.role !== ChatParticipantRole.ADMIN && participant.role !== ChatParticipantRole.MOD) {
      throw new ForbiddenException(
        'This chat is in read-only mode. Only admins and moderators can send messages.',
      );
    }

    const newMessage = await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: user.id,
        organizationId: user.organizationId,
        content: dto.content,
        type: ChatMessageType.TEXT,
        replyToId: dto.replyToId,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
        chat: { select: { id: true, name: true, type: true } },
        replyTo: {
          include: {
            sender: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Update chat's updatedAt field
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    // Broadcast to ACTIVE participants
    const activeParticipants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true },
    });

    this.events.emitToRoom(`chat:${chatId}`, 'chat:message', newMessage);

    // Mark as read for the sender automatically
    await this.markAsRead(chatId, newMessage.id, user);

    // Notify all participants via WebSocket for real-time UI/badge updates
    for (const p of activeParticipants) {
      this.events.emitToRoom(`user:${p.userId}`, 'chat:message', newMessage);
    }

    if (
      dto.mentionedUserIds &&
      dto.mentionedUserIds.length > 0 &&
      newMessage.chat?.type === ChatType.GROUP
    ) {
      const senderName = newMessage.sender?.name || 'Someone';
      const chatName = newMessage.chat?.name || 'a group';

      for (const userId of dto.mentionedUserIds) {
        if (userId === user.id) continue;
        const isParticipant = activeParticipants.find(
          (p) => p.userId === userId,
        );
        if (isParticipant) {
          const body =
            dto.content.length > 30
              ? dto.content.substring(0, 30) + '...'
              : dto.content;
          await this.notifications.createNotification({
            userId,
            title: `${senderName} mentioned you in ${chatName}.`,
            body,
            type: 'CHAT_MENTION',
            actionUrl: `/chat?id=${chatId}&msgId=${newMessage.id}`,
          });
        }
      }
    }

    this.events.emitToRoom(`chat:${chatId}`, 'chat:typing', {
      chatId,
      userId: user.id,
      name: newMessage.sender?.name || null,
      isTyping: false,
    });

    // Send push-only notifications to offline participants (no DB Notification record).
    // Chat messages are real-time via WebSocket; push is just a fallback for background/offline users.
    const senderName = newMessage.sender?.name || 'Someone';
    const chatName = newMessage.chat?.name;
    const pushTitle = newMessage.chat?.type === 'GROUP'
      ? `${senderName} in ${chatName || 'a group'}`
      : senderName;
    const pushBody = dto.content.length > 80
      ? dto.content.substring(0, 80) + '...'
      : dto.content;

    for (const p of activeParticipants) {
      if (p.userId === user.id) continue; // Don't push to sender
      this.notifications.sendPushOnly(p.userId, {
        title: pushTitle,
        body: pushBody,
        url: `/chat?id=${chatId}`,
      }).catch(e => console.error('Chat push failed:', e));
    }

    return newMessage;
  }

  async markAsRead(
    chatId: string,
    messageId: string | undefined,
    user: CurrentUser,
  ) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId: user.id } },
    });

    // Suppress "Not an active participant" error by returning early
    if (!participant || !participant.isActive)
      return { message: 'Ignored for inactive participant' };

    let finalReadMessageId = messageId;

    if (!finalReadMessageId) {
      const lastMsg = await this.prisma.chatMessage.findFirst({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (lastMsg) {
        finalReadMessageId = lastMsg.id;
      }
    }

    if (!finalReadMessageId) {
      return participant;
    }

    const updatedParticipant = await this.prisma.chatParticipant.update({
      where: { id: participant.id },
      data: { lastReadMessageId: finalReadMessageId },
    });

    this.events.emitToRoom(`chat:${chatId}`, 'chat:read', {
      chatId,
      userId: user.id,
      messageId: finalReadMessageId,
    });
    this.events.emitToRoom(`user:${user.id}`, 'chat:read', {
      chatId,
      userId: user.id,
      messageId: finalReadMessageId,
    });

    // Also emit to all other participants in the chat so senders can see read receipts
    const allParticipants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true },
      select: { userId: true },
    });
    for (const p of allParticipants) {
      if (p.userId !== user.id) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:read', {
          chatId,
          userId: user.id,
          messageId: finalReadMessageId,
        });
      }
    }

    return updatedParticipant;
  }

  async getUnreadCount(user: CurrentUser) {
    const participants = await this.prisma.chatParticipant.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        chat: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    // Filter to only count unread from visible chats (not hidden OR revived)
    const visibleParticipants = participants.filter((p) => {
      if (!p.hiddenAt) return true;
      const latestMsg = p.chat.messages[0];
      if (!latestMsg) return false;
      return latestMsg.createdAt > p.hiddenAt;
    });

    let totalUnread = 0;
    for (const p of visibleParticipants) {
      let lastReadAt: Date | undefined;
      if (p.lastReadMessageId) {
        const lastMsg = await this.prisma.chatMessage.findUnique({
          where: { id: p.lastReadMessageId },
          select: { createdAt: true },
        });
        lastReadAt = lastMsg?.createdAt;
      }

      const history = await this.prisma.chatMembershipHistory.findMany({
        where: { chatParticipantId: p.id },
      });

      const visibilityOR = history.map((h) => ({
        createdAt: {
          gte: h.activatedAt,
          ...(h.deactivatedAt ? { lte: h.deactivatedAt } : {}),
        },
      }));

      const count = await this.prisma.chatMessage.count({
        where: {
          chatId: p.chatId,
          createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
          senderId: { not: user.id },
          deletedAt: null,
          type: { not: ChatMessageType.SYSTEM },
          ...(visibilityOR.length > 0 ? { OR: visibilityOR } : {}),
        },
      });
      totalUnread += count;
    }

    return { unread: totalUnread };
  }

  private async verifyChatAccess(
    chatId: string,
    userId: string,
    allowInactive = false,
  ) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant)
      throw new ForbiddenException('You do not have access to this chat.');
    if (!participant.isActive && !allowInactive) {
      throw new ForbiddenException(
        'You are no longer an active participant of this chat.',
      );
    }
    return participant;
  }
}
