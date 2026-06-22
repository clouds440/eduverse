import { Prisma } from '@/prisma/prisma-client';
import { BadRequestException } from '@nestjs/common';
import { Role, DepartmentScopeType } from './enums';
import { PrismaService } from '../prisma/prisma.service';

export interface DepartmentScopedUser {
  id: string;
  role?: string;
}

export interface DepartmentScope {
  applies: boolean;
  all: boolean;
  departmentIds: string[];
}

const unrestrictedScope: DepartmentScope = {
  applies: false,
  all: true,
  departmentIds: [],
};

export async function getDepartmentScope(
  prisma: PrismaService,
  orgId: string,
  user?: DepartmentScopedUser,
): Promise<DepartmentScope> {
  if (!user) return unrestrictedScope;

  if (user.role === Role.SUB_ADMIN) {
    const account = await prisma.user.findFirst({
      where: { id: user.id, organizationId: orgId, role: Role.SUB_ADMIN },
      select: {
        departmentScopeType: true,
        subAdminDepartments: { select: { departmentId: true } },
      },
    });

    if (!account || account.departmentScopeType !== DepartmentScopeType.SELECTED) {
      return { applies: true, all: true, departmentIds: [] };
    }

    return {
      applies: true,
      all: false,
      departmentIds: account.subAdminDepartments.map((entry) => entry.departmentId),
    };
  }

  if (user.role === Role.ORG_MANAGER) {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, organizationId: orgId },
      select: {
        departmentScopeType: true,
        managerDepartments: { select: { departmentId: true } },
      },
    });

    if (!teacher || teacher.departmentScopeType !== DepartmentScopeType.SELECTED) {
      return { applies: true, all: true, departmentIds: [] };
    }

    return {
      applies: true,
      all: false,
      departmentIds: teacher.managerDepartments.map((entry) => entry.departmentId),
    };
  }

  return unrestrictedScope;
}

function selectedDepartmentOrLegacyNull(departmentIds: string[]) {
  return [{ departmentId: { in: departmentIds } }, { departmentId: null }];
}

export function courseDepartmentScopeWhere(scope: DepartmentScope): Prisma.CourseWhereInput {
  if (!scope.applies || scope.all) return {};
  if (scope.departmentIds.length === 0) return { id: '__no_department_scope__' };
  return { OR: selectedDepartmentOrLegacyNull(scope.departmentIds) };
}

export function sectionDepartmentScopeWhere(scope: DepartmentScope): Prisma.SectionWhereInput {
  if (!scope.applies || scope.all) return {};
  if (scope.departmentIds.length === 0) return { id: '__no_department_scope__' };
  return { course: { OR: selectedDepartmentOrLegacyNull(scope.departmentIds) } };
}

export function teacherDepartmentScopeWhere(scope: DepartmentScope): Prisma.TeacherWhereInput {
  if (!scope.applies || scope.all) return {};
  if (scope.departmentIds.length === 0) return { id: '__no_department_scope__' };
  return {
    OR: [
      { teacherDepartments: { some: { departmentId: { in: scope.departmentIds } } } },
      { teacherDepartments: { none: {} } },
    ],
  };
}

export function studentDepartmentScopeWhere(scope: DepartmentScope): Prisma.StudentWhereInput {
  if (!scope.applies || scope.all) return {};
  if (scope.departmentIds.length === 0) return { id: '__no_department_scope__' };
  return {
    OR: [
      { primaryDepartmentId: { in: scope.departmentIds } },
      { studentDepartments: { some: { departmentId: { in: scope.departmentIds } } } },
      { primaryDepartmentId: null, studentDepartments: { none: {} } },
    ],
  };
}

export function assertDepartmentInScope(
  scope: DepartmentScope,
  departmentId?: string | null,
  message = 'You do not have access to this department',
) {
  if (!scope.applies || scope.all || !departmentId) return;
  if (!scope.departmentIds.includes(departmentId)) {
    throw new BadRequestException(message);
  }
}

export async function assertDepartmentIdsBelongToOrg(
  prisma: PrismaService | Prisma.TransactionClient,
  orgId: string,
  departmentIds: string[] = [],
) {
  const uniqueIds = Array.from(new Set(departmentIds.filter(Boolean)));
  if (uniqueIds.length === 0) return uniqueIds;

  const count = await prisma.department.count({
    where: { id: { in: uniqueIds }, organizationId: orgId },
  });

  if (count !== uniqueIds.length) {
    throw new BadRequestException('One or more departments do not belong to this organization');
  }

  return uniqueIds;
}

export async function validateRoomBelongsToOrg(
  prisma: PrismaService | Prisma.TransactionClient,
  orgId: string,
  roomId?: string | null,
) {
  if (!roomId) return null;

  const room = await prisma.room.findFirst({
    where: { id: roomId, organizationId: orgId, isActive: true },
    include: { building: true },
  });

  if (!room) {
    throw new BadRequestException('Room must be active and belong to this organization');
  }

  return room;
}
