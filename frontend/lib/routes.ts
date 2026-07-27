export const USER_ROUTES = {
    root: '/users',
    students: '/users/students',
    teachers: '/users/teachers',
    subAdmins: '/users/sub-admins',
    financeManagers: '/users/finance-managers',
    guardians: '/users/guardians',
} as const;

export function studentPortalPath(userId: string, tab?: string) {
    const path = `/student/${userId}`;
    return tab ? `${path}?tab=${tab}` : path;
}

export function settingsPath(userId: string, tab?: string) {
    const path = `/settings/${userId}`;
    return tab ? `${path}?tab=${tab}` : path;
}

export function teacherPortalPath(userId: string) {
    return `/teacher/${userId}`;
}

export function teacherFeedbackPath(userId: string) {
    return `/teacher/${userId}/feedback`;
}
