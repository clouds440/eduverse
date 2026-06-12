import { Role } from '@/types';

type RoleLike = Role | string | null | undefined;

interface RoleIdentity {
    id?: string | null;
    role?: RoleLike;
}

const ROLE_LABELS: Record<Role, string> = {
    [Role.SUPER_ADMIN]: 'Super Admin',
    [Role.PLATFORM_ADMIN]: 'Platform Admin',
    [Role.ORG_ADMIN]: 'Admin',
    [Role.SUB_ADMIN]: 'Sub Admin',
    [Role.ORG_MANAGER]: 'Manager',
    [Role.FINANCE_MANAGER]: 'Finance Manager',
    [Role.TEACHER]: 'Teacher',
    [Role.STUDENT]: 'Student',
    [Role.GUARDIAN]: 'Guardian',
};

function isRole(value: RoleLike): value is Role {
    return !!value && Object.values(Role).includes(value as Role);
}

function titleCaseRole(value: string) {
    return value
        .split('_')
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
        .join(' ');
}

export function getRoleLabel(role: RoleLike, fallback = 'User') {
    if (!role) return fallback;
    if (isRole(role)) return ROLE_LABELS[role];
    return titleCaseRole(role) || fallback;
}

export function canManageRole(actorRole: RoleLike, targetRole: RoleLike) {
    if (actorRole === Role.ORG_ADMIN) {
        return [
            Role.SUB_ADMIN,
            Role.FINANCE_MANAGER,
            Role.ORG_MANAGER,
            Role.TEACHER,
            Role.STUDENT,
            Role.GUARDIAN,
        ].includes(targetRole as Role);
    }

    if (actorRole === Role.SUB_ADMIN) {
        return [
            Role.FINANCE_MANAGER,
            Role.ORG_MANAGER,
            Role.TEACHER,
            Role.STUDENT,
            Role.GUARDIAN,
        ].includes(targetRole as Role);
    }

    return false;
}

export function getRoleDashboardPath(identity: RoleIdentity | RoleLike, id?: string | null) {
    const role = typeof identity === 'object' && identity !== null ? identity.role : identity;
    const userId = typeof identity === 'object' && identity !== null ? identity.id : id;

    switch (role) {
        case Role.SUPER_ADMIN:
        case Role.PLATFORM_ADMIN:
            return '/admin';
        case Role.FINANCE_MANAGER:
            return '/finance';
        case Role.GUARDIAN:
            return '/guardian';
        case Role.STUDENT:
            return userId ? `/students/${userId}` : '/overview';
        case Role.TEACHER:
        case Role.ORG_MANAGER:
            return userId ? `/teachers/${userId}` : '/overview';
        case Role.ORG_ADMIN:
        case Role.SUB_ADMIN:
            return '/overview';
        default:
            return '/';
    }
}
