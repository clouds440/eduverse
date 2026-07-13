import {
  ChatParticipant,
  Role,
} from '@/prisma/prisma-client';
import { ChatMentionTargetDto } from './dto/send-message.dto';

type MentionParticipant = Pick<ChatParticipant, 'userId' | 'isActive'> & {
  user?: { role: Role } | null;
};

type MentionProfileUser = {
  id: string;
  role: Role;
  studentProfile?: {
    cohortId?: string | null;
    primaryDepartmentId?: string | null;
    enrollments?: Array<{
      isExcludedFromCohort: boolean;
      sectionId: string;
    }>;
    studentDepartments?: Array<{ departmentId: string }>;
  } | null;
  teacherProfile?: {
    sections?: Array<{
      id: string;
      cohortId?: string | null;
    }>;
    teacherDepartments?: Array<{ departmentId: string }>;
  } | null;
};

export type MentionOptionRole = {
  role: Role;
  count: number;
};

export type MentionOptionScope = {
  type: 'SECTION' | 'DEPARTMENT' | 'COHORT';
  audienceRole: Role | 'EVERYONE';
  id: string;
  name: string;
  code?: string | null;
  count: number;
};

export type ChatMentionOptions = {
  roles: MentionOptionRole[];
  scopes: MentionOptionScope[];
};

export function getActiveMentionParticipantUserIds(
  participants: MentionParticipant[],
) {
  return participants
    .filter((participant) => participant.isActive)
    .map((participant) => participant.userId);
}

export function getMentionOptionRoles(
  participants: MentionParticipant[],
): MentionOptionRole[] {
  const counts = new Map<Role, number>();
  participants
    .filter((participant) => participant.isActive && participant.user?.role)
    .forEach((participant) => {
      const role = participant.user!.role;
      counts.set(role, (counts.get(role) || 0) + 1);
    });

  if (counts.size <= 1) return [];

  return Array.from(counts.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => a.role.localeCompare(b.role));
}

export function addScopeCount(
  map: Map<string, MentionOptionScope>,
  scope: Omit<MentionOptionScope, 'count'>,
  userId: string,
  seen: Set<string>,
) {
  const key = `${scope.audienceRole}:${scope.type}:${scope.id}`;
  const userKey = `${key}:${userId}`;
  if (seen.has(userKey)) return;
  seen.add(userKey);

  const current = map.get(key);
  if (current) {
    current.count += 1;
  } else {
    map.set(key, { ...scope, count: 1 });
  }
}

export function getMentionRecipientIdsFromTargets(options: {
  targets?: ChatMentionTargetDto[];
  legacyUserIds?: string[];
  senderId: string;
  participants: MentionParticipant[];
  users: MentionProfileUser[];
}) {
  const activeParticipantIds = new Set(
    getActiveMentionParticipantUserIds(options.participants),
  );
  const recipients = new Set<string>();
  const usersById = new Map(options.users.map((user) => [user.id, user]));

  const addRecipient = (userId: string | undefined) => {
    if (!userId || userId === options.senderId) return;
    if (!activeParticipantIds.has(userId)) return;
    recipients.add(userId);
  };

  for (const userId of options.legacyUserIds || []) {
    addRecipient(userId);
  }

  for (const target of options.targets || []) {
    if (target.type === 'USER') {
      addRecipient(target.userId);
      continue;
    }

    if (target.type === 'EVERYONE') {
      activeParticipantIds.forEach((userId) => addRecipient(userId));
      continue;
    }

    if (target.type === 'ROLE' && target.role) {
      options.users
        .filter((candidate) => candidate.role === target.role)
        .forEach((candidate) => addRecipient(candidate.id));
      continue;
    }

    if (
      target.type === 'RELATED_SCOPE' &&
      target.scopeType &&
      target.scopeId &&
      target.audienceRole
    ) {
      for (const userId of activeParticipantIds) {
        const candidate = usersById.get(userId);
        if (!candidate) continue;
        if (target.audienceRole !== 'EVERYONE' && candidate.role !== target.audienceRole) continue;

        if (target.audienceRole === 'EVERYONE' || target.audienceRole === Role.STUDENT) {
          const student = candidate.studentProfile;
          if (!student) {
            if (target.audienceRole === Role.STUDENT) continue;
          } else {

            const matchesSection =
              target.scopeType === 'SECTION' &&
              student.enrollments?.some((enrollment) =>
                  !enrollment.isExcludedFromCohort &&
                  enrollment.sectionId === target.scopeId,
              );
            const matchesDepartment =
              target.scopeType === 'DEPARTMENT' &&
              (student.primaryDepartmentId === target.scopeId ||
                student.studentDepartments?.some((department) =>
                  department.departmentId === target.scopeId,
                ));
            const matchesCohort =
              target.scopeType === 'COHORT' &&
              student.cohortId === target.scopeId;

            if (matchesSection || matchesDepartment || matchesCohort) {
              addRecipient(candidate.id);
              continue;
            }
          }
        }

        if (target.audienceRole === 'EVERYONE' || target.audienceRole === Role.TEACHER) {
          const teacher = candidate.teacherProfile;
          if (!teacher) {
            if (target.audienceRole === Role.TEACHER) continue;
          } else {

            const matchesSection =
              target.scopeType === 'SECTION' &&
              teacher.sections?.some((section) => section.id === target.scopeId);
            const matchesDepartment =
              target.scopeType === 'DEPARTMENT' &&
              teacher.teacherDepartments?.some(
                (department) => department.departmentId === target.scopeId,
              );
            const matchesCohort =
              target.scopeType === 'COHORT' &&
              teacher.sections?.some(
                (section) => section.cohortId === target.scopeId,
              );

            if (matchesSection || matchesDepartment || matchesCohort) {
              addRecipient(candidate.id);
            }
          }
        }
      }
    }
  }

  return Array.from(recipients);
}
