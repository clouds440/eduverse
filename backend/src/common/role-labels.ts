const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  PLATFORM_ADMIN: 'Platform Admin',
  ORG_ADMIN: 'Admin',
  SUB_ADMIN: 'Sub Admin',
  ORG_MANAGER: 'Manager',
  FINANCE_MANAGER: 'Finance Manager',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  GUARDIAN: 'Guardian',
};

export function formatRoleLabel(role?: string | null, fallback = 'User') {
  if (!role) return fallback;
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  return (
    role
      .split('_')
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
      .join(' ') || fallback
  );
}
