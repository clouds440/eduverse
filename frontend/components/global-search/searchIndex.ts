import type { ElementType } from 'react';
import {
    Bell,
    Building,
    Calendar,
    FileText,
    Key,
    Mail,
    MessageSquare,
    ReceiptText,
    ScrollText,
    Settings,
    Shield,
    UserPlus,
    Users,
    Wallet,
} from 'lucide-react';
import { Role } from '@/types';
import type { JwtPayload } from '@/context/AuthContext';
import { buildOrgSidebarLinks } from '@/lib/orgSidebar';

export type RouteSearchGroup = 'Navigation' | 'Actions' | 'Settings' | 'Academic' | 'Finance';

export interface RouteSearchItem {
    id: string;
    title: string;
    href: string;
    group: RouteSearchGroup;
    description?: string;
    icon?: ElementType;
    keywords?: string[];
    aliases?: string[];
}

export type ScoredRouteSearchItem = RouteSearchItem & { score: number };

const SHORTHANDS: Record<string, string[]> = {
    std: ['student', 'students'],
    stu: ['student', 'students'],
    teach: ['teacher', 'teachers'],
    cls: ['class', 'classes', 'section', 'sections'],
    sec: ['section', 'sections'],
    dept: ['department', 'departments'],
    bldg: ['building', 'buildings'],
    rm: ['room', 'rooms'],
    fee: ['finance', 'fees', 'payments'],
    pay: ['payment', 'payments', 'finance'],
    gpa: ['gpa', 'grade', 'grades'],
    cal: ['calendar', 'holidays'],
    eval: ['evaluation', 'evaluations', 'feedback'],
    msg: ['message', 'messages', 'chat'],
    map: ['campus', 'navigation', 'institute map'],
    nav: ['navigation', 'campus map', 'routes'],
};

const GROUP_BY_ID: Record<string, RouteSearchGroup> = {
    ACADEMIC_CYCLES: 'Academic',
    ATTENDANCE: 'Academic',
    COHORTS: 'Academic',
    COURSES: 'Academic',
    DEPARTMENTS: 'Academic',
    EVALUATIONS: 'Academic',
    GRADE_FINALIZATION: 'Academic',
    GRADES: 'Academic',
    GPA_POLICIES: 'Settings',
    HOLIDAYS: 'Academic',
    SCHEDULES: 'Academic',
    SECTIONS: 'Academic',
    TIMETABLE: 'Academic',
    TRANSCRIPT: 'Academic',
    TRANSCRIPTS: 'Academic',
    FINANCE: 'Finance',
    FEES: 'Finance',
    SETTINGS: 'Settings',
    PROFILE: 'Settings',
};

const ROUTE_METADATA: Record<string, Pick<RouteSearchItem, 'description' | 'aliases' | 'keywords'>> = {
    ACADEMIC_CYCLES: {
        description: 'Sessions and academic years',
        aliases: ['sessions', 'terms'],
        keywords: ['academic calendar', 'cycle', 'year'],
    },
    BUILDINGS_AND_ROOMS: {
        description: 'Campus buildings, rooms, labs, and halls',
        aliases: ['rooms', 'buildings'],
        keywords: ['bldg', 'room', 'rm', 'classroom', 'lab'],
    },
    CAMPUS_NAVIGATION: {
        description: 'Find buildings, rooms, floors, departments, landmarks, and directions',
        aliases: ['campus map', 'institute map', 'directory map'],
        keywords: ['map', 'navigation', 'building image', 'room image', 'directions', 'landmark', 'floor', 'room code'],
    },
    CHAT: {
        description: 'Messages and conversations',
        aliases: ['messages', 'chat'],
        keywords: ['msg', 'conversation', 'inbox'],
    },
    COHORTS: {
        description: 'Student batches and cohorts',
        aliases: ['batches'],
        keywords: ['batch', 'cohort'],
    },
    COURSES: {
        description: 'Course catalog and assigned courses',
        aliases: ['classes', 'subjects'],
        keywords: ['course', 'my courses', 'subject'],
    },
    DEPARTMENTS: {
        description: 'Academic departments',
        aliases: ['dept'],
        keywords: ['department', 'scope'],
    },
    EVALUATIONS: {
        description: 'Teacher and course feedback',
        aliases: ['feedback', 'teacher feedback'],
        keywords: ['eval', 'rating', 'review'],
    },
    FEES: {
        description: 'Fees and payment history',
        aliases: ['payments'],
        keywords: ['fee', 'pay', 'finance', 'billing'],
    },
    FINANCE: {
        description: 'Finance, fee structures, entries, and transactions',
        aliases: ['payments', 'fees'],
        keywords: ['fee', 'pay', 'salary', 'salaries', 'billing'],
    },
    GRADE_FINALIZATION: {
        description: 'Finalize grades and assessment status',
        aliases: ['final grades', 'grade final'],
        keywords: ['grade', 'finalization', 'assessment'],
    },
    GPA_POLICIES: {
        description: 'GPA calculation rules and transcript policies',
        aliases: ['gpa settings'],
        keywords: ['gpa', 'transcript', 'policy'],
    },
    GRADES: {
        description: 'Grades and assessments',
        aliases: ['marks'],
        keywords: ['assessment', 'score', 'result'],
    },
    GUARDIAN_ANNOUNCEMENTS: {
        description: 'Announcements for linked students',
        aliases: ['notices'],
        keywords: ['announcement', 'notice'],
    },
    HOLIDAYS: {
        description: 'Holidays and academic calendar events',
        aliases: ['holidays', 'calendar'],
        keywords: ['cal', 'event', 'closure'],
    },
    MAIL: {
        description: 'Mail and support requests',
        aliases: ['inbox'],
        keywords: ['mail', 'request', 'support'],
    },
    SCHEDULES: {
        description: 'Section schedules',
        aliases: ['class schedules'],
        keywords: ['schedule', 'time'],
    },
    SECTIONS: {
        description: 'Class sections and rosters',
        aliases: ['classes'],
        keywords: ['cls', 'sec', 'section', 'roster'],
    },
    SETTINGS: {
        description: 'Organization and account settings',
        aliases: ['appearance', 'profile'],
        keywords: ['theme', 'organization', 'settings'],
    },
    STUDENTS: {
        description: 'Student records and rosters',
        aliases: ['learners'],
        keywords: ['std', 'stu', 'student'],
    },
    TIMETABLE: {
        description: 'Weekly timetable',
        aliases: ['schedule'],
        keywords: ['time', 'calendar'],
    },
    TRANSCRIPTS: {
        description: 'Student transcripts',
        aliases: ['transcript'],
        keywords: ['gpa', 'grades', 'records'],
    },
    USERS: {
        description: 'Role accounts and people',
        aliases: ['accounts', 'staff'],
        keywords: ['students', 'teachers', 'guardians', 'sub admins', 'finance managers'],
    },
};

function routeItem(
    item: RouteSearchItem,
): RouteSearchItem {
    return item;
}

function platformSearchItems(role?: Role | null): RouteSearchItem[] {
    if (role !== Role.SUPER_ADMIN && role !== Role.PLATFORM_ADMIN) return [];

    const items: RouteSearchItem[] = [
        routeItem({
            id: 'admin-organizations',
            title: 'Organizations',
            href: '/admin/organizations',
            group: 'Navigation',
            description: 'Review organization registrations and status',
            icon: Building,
            aliases: ['schools', 'institutions'],
            keywords: ['pending', 'approve', 'reject', 'suspend'],
        }),
        routeItem({
            id: 'admin-mail',
            title: 'Mail',
            href: '/admin/mail',
            group: 'Navigation',
            description: 'Platform mail and support requests',
            icon: Mail,
            aliases: ['inbox', 'requests'],
            keywords: ['support', 'mail'],
        }),
        routeItem({
            id: 'admin-chat',
            title: 'Messages',
            href: '/admin/chat',
            group: 'Navigation',
            description: 'Platform conversations',
            icon: MessageSquare,
            aliases: ['chat'],
            keywords: ['message', 'msg'],
        }),
        routeItem({
            id: 'admin-change-password',
            title: 'Change Password',
            href: '/admin/change-password',
            group: 'Settings',
            description: 'Update your account password',
            icon: Key,
            keywords: ['security', 'password'],
        }),
        routeItem({
            id: 'admin-settings',
            title: 'Settings',
            href: '/admin/settings',
            group: 'Settings',
            description: 'Platform account settings',
            icon: Settings,
            keywords: ['theme', 'profile'],
        }),
    ];

    if (role === Role.SUPER_ADMIN) {
        items.push(
            routeItem({
                id: 'admin-platform-admins',
                title: 'Platform Admins',
                href: '/admin/platform-admins',
                group: 'Navigation',
                description: 'Manage platform administrator accounts',
                icon: Users,
                aliases: ['admins'],
                keywords: ['user', 'account'],
            }),
            routeItem({
                id: 'admin-audit-logs',
                title: 'Audit Logs',
                href: '/admin/logs',
                group: 'Navigation',
                description: 'Review platform activity',
                icon: ScrollText,
                aliases: ['logs'],
                keywords: ['audit', 'activity'],
            }),
        );
    }

    return items;
}

function userManagementItems(role?: Role | null): RouteSearchItem[] {
    const canManagePeople = role === Role.ORG_ADMIN || role === Role.SUB_ADMIN;
    if (!canManagePeople) return [];

    const canManageAdmins = role === Role.ORG_ADMIN;

    return [
        ...(canManageAdmins ? [{
            id: 'sub-admins',
            title: 'Sub Admins',
            href: '/users/sub-admins',
            group: 'Navigation' as const,
            description: 'Manage sub admin accounts',
            icon: Shield,
            aliases: ['admins'],
            keywords: ['subadmin', 'users'],
        }, {
            id: 'add-sub-admin',
            title: 'Add Sub Admin',
            href: '/users/sub-admins/add',
            group: 'Actions' as const,
            description: 'Create a sub admin account',
            icon: UserPlus,
            aliases: ['new sub admin'],
            keywords: ['create', 'admin', 'user'],
        }] : []),
        {
            id: 'finance-managers',
            title: 'Finance Managers',
            href: '/users/finance-managers',
            group: 'Navigation',
            description: 'Manage finance manager accounts',
            icon: Wallet,
            aliases: ['finance users'],
            keywords: ['fee', 'pay', 'salary'],
        },
        {
            id: 'add-finance-manager',
            title: 'Add Finance Manager',
            href: '/users/finance-managers/add',
            group: 'Actions',
            description: 'Create a finance manager account',
            icon: UserPlus,
            aliases: ['new finance manager'],
            keywords: ['finance', 'create', 'user'],
        },
        {
            id: 'teachers',
            title: 'Teachers',
            href: '/users/teachers',
            group: 'Navigation',
            description: 'Manage faculty accounts',
            icon: Users,
            aliases: ['faculty'],
            keywords: ['teach', 'staff'],
        },
        {
            id: 'add-teacher',
            title: 'Add Teacher',
            href: '/users/teachers/add',
            group: 'Actions',
            description: 'Create a teacher account',
            icon: UserPlus,
            aliases: ['new teacher'],
            keywords: ['teach', 'faculty', 'create'],
        },
        {
            id: 'students',
            title: 'Students',
            href: '/users/students',
            group: 'Navigation',
            description: 'Manage student records',
            icon: Users,
            aliases: ['learners'],
            keywords: ['std', 'stu'],
        },
        {
            id: 'add-student',
            title: 'Add Student',
            href: '/users/students/add',
            group: 'Actions',
            description: 'Create a student record',
            icon: UserPlus,
            aliases: ['new student'],
            keywords: ['std', 'stu', 'import students'],
        },
        {
            id: 'guardians',
            title: 'Guardians',
            href: '/users/guardians',
            group: 'Navigation',
            description: 'Manage guardian accounts',
            icon: Users,
            aliases: ['parents'],
            keywords: ['guardian', 'parent'],
        },
        {
            id: 'add-guardian',
            title: 'Add Guardian',
            href: '/users/guardians/add',
            group: 'Actions',
            description: 'Create a guardian account',
            icon: UserPlus,
            aliases: ['new guardian', 'add parent'],
            keywords: ['guardian', 'parent', 'create'],
        },
    ];
}

function contextualActions(user: JwtPayload | null): RouteSearchItem[] {
    const role = user?.role;
    const canManageAcademic = role === Role.ORG_ADMIN || role === Role.SUB_ADMIN;
    const canUseFinance = role === Role.ORG_ADMIN || role === Role.SUB_ADMIN || role === Role.FINANCE_MANAGER;
    const teacherProfileHref = user?.id ? `/teachers/${user.id}/profile` : '/settings';
    const studentProfileHref = user?.id ? `/students/${user.id}?tab=profile` : '/settings';

    return [
        ...(canManageAcademic ? [
            {
                id: 'create-course',
                title: 'Add Course',
                href: '/courses/create',
                group: 'Actions' as const,
                description: 'Create a course',
                icon: UserPlus,
                aliases: ['new course'],
                keywords: ['course', 'subject'],
            },
            {
                id: 'create-section',
                title: 'Add Section',
                href: '/sections/create',
                group: 'Actions' as const,
                description: 'Create a class section',
                icon: UserPlus,
                aliases: ['new section', 'new class'],
                keywords: ['cls', 'sec'],
            },
            {
                id: 'create-cycle',
                title: 'Add Academic Cycle',
                href: '/academic-cycles/create',
                group: 'Actions' as const,
                description: 'Create a session or academic year',
                icon: Calendar,
                aliases: ['new session'],
                keywords: ['cycle', 'session', 'year'],
            },
            {
                id: 'create-cohort',
                title: 'Add Cohort',
                href: '/cohorts/create',
                group: 'Actions' as const,
                description: 'Create a student batch',
                icon: UserPlus,
                aliases: ['new batch'],
                keywords: ['batch', 'cohort'],
            },
        ] : []),
        ...(canUseFinance ? [
            {
                id: 'finance-structures',
                title: 'Fee Structures',
                href: '/finance/structures',
                group: 'Finance' as const,
                description: 'Manage fee and salary structures',
                icon: ReceiptText,
                aliases: ['fees', 'salaries'],
                keywords: ['fee', 'salary', 'billing'],
            },
            {
                id: 'finance-entries',
                title: 'Finance Entries',
                href: '/finance/entries',
                group: 'Finance' as const,
                description: 'Manage payable and receivable entries',
                icon: Wallet,
                aliases: ['payments due'],
                keywords: ['fee', 'pay', 'salary'],
            },
            {
                id: 'finance-transactions',
                title: 'Transactions',
                href: '/finance/transactions',
                group: 'Finance' as const,
                description: 'Review payment transactions',
                icon: Wallet,
                aliases: ['payments'],
                keywords: ['pay', 'receipt'],
            },
        ] : []),
        ...(role === Role.ORG_ADMIN ? [{
            id: 'settings-gpa-policies',
            title: 'GPA Policies',
            href: '/settings/gpa-policies',
            group: 'Settings' as const,
            description: 'Configure GPA calculations',
            icon: FileText,
            aliases: ['gpa settings'],
            keywords: ['transcript', 'grade'],
        }] : []),
        ...(role && role !== Role.SUPER_ADMIN && role !== Role.PLATFORM_ADMIN ? [{
            id: 'mail',
            title: 'Mail',
            href: '/mail',
            group: 'Navigation' as const,
            description: 'Mail and support requests',
            icon: Mail,
            aliases: ['inbox'],
            keywords: ['mail', 'support'],
        }, {
            id: 'change-password',
            title: 'Change Password',
            href: '/change-password',
            group: 'Settings' as const,
            description: 'Update account security',
            icon: Key,
            keywords: ['password', 'security'],
        }] : []),
        ...(role === Role.TEACHER || role === Role.ORG_MANAGER ? [{
            id: 'teacher-profile',
            title: 'Profile Settings',
            href: teacherProfileHref,
            group: 'Settings' as const,
            description: 'Update your profile',
            icon: Settings,
            aliases: ['profile'],
            keywords: ['account'],
        }] : []),
        ...(role === Role.STUDENT ? [{
            id: 'student-profile',
            title: 'Profile Settings',
            href: studentProfileHref,
            group: 'Settings' as const,
            description: 'View your student profile',
            icon: Settings,
            aliases: ['profile'],
            keywords: ['account'],
        }] : []),
    ];
}

function dedupeItems(items: RouteSearchItem[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = `${item.title}:${item.href}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function buildRouteSearchItems({
    user,
    isApproved,
    unreadChats = 0,
}: {
    user: JwtPayload | null;
    isApproved: boolean;
    unreadChats?: number;
}): RouteSearchItem[] {
    if (!user?.role) return [];

    if (user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN) {
        return platformSearchItems(user.role);
    }

    const sidebarItems = buildOrgSidebarLinks({ user, isApproved, unreadChats }).map<RouteSearchItem>((link) => {
        const metadata = ROUTE_METADATA[link.id] || {};
        return {
            id: link.id.toLowerCase(),
            title: link.label,
            href: link.href,
            group: GROUP_BY_ID[link.id] || 'Navigation',
            icon: link.icon,
            ...metadata,
        };
    });

    return dedupeItems([
        ...sidebarItems,
        ...userManagementItems(user.role),
        ...contextualActions(user),
        ...(user.role === Role.GUARDIAN ? [{
            id: 'guardian-announcements',
            title: 'Announcements',
            href: '/guardian?view=announcements',
            group: 'Navigation' as const,
            description: 'Guardian announcements',
            icon: Bell,
            aliases: ['notices'],
            keywords: ['announcement'],
        }] : []),
        ...(user.role === Role.STUDENT ? [{
            id: 'student-payments',
            title: 'Payments',
            href: '/fees',
            group: 'Finance' as const,
            description: 'Fees and payments',
            icon: Wallet,
            aliases: ['fees'],
            keywords: ['fee', 'pay'],
        }] : []),
    ]);
}

export function normalizeSearchText(value: string) {
    return value
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/[_-]+/g, ' ')
        .replace(/[^a-z0-9\s]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(value: string) {
    const baseTokens = normalizeSearchText(value).split(' ').filter(Boolean);
    return Array.from(new Set(baseTokens.flatMap((token) => [token, ...(SHORTHANDS[token] || [])])));
}

function subsequenceScore(needle: string, haystack: string) {
    if (!needle || !haystack) return 0;
    let needleIndex = 0;
    let gaps = 0;
    let lastMatch = -1;

    for (let i = 0; i < haystack.length && needleIndex < needle.length; i += 1) {
        if (haystack[i] === needle[needleIndex]) {
            if (lastMatch >= 0) gaps += i - lastMatch - 1;
            lastMatch = i;
            needleIndex += 1;
        }
    }

    if (needleIndex !== needle.length) return 0;
    return Math.max(8, 42 - gaps);
}

function editDistance(a: string, b: string) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

    for (let i = 1; i <= a.length; i += 1) {
        let diagonal = previous[0];
        previous[0] = i;

        for (let j = 1; j <= b.length; j += 1) {
            const temp = previous[j];
            previous[j] = Math.min(
                previous[j] + 1,
                previous[j - 1] + 1,
                diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
            diagonal = temp;
        }
    }

    return previous[b.length];
}

function scoreField(field: string, query: string, tokens: string[], weight: number) {
    const normalized = normalizeSearchText(field);
    if (!normalized) return 0;
    let score = 0;

    if (normalized === query) score += 120 * weight;
    if (normalized.startsWith(query)) score += 88 * weight;
    if (normalized.includes(query)) score += 48 * weight;

    const fieldTokens = normalized.split(' ').filter(Boolean);
    for (const token of tokens) {
        if (fieldTokens.includes(token)) score += 28 * weight;
        else if (fieldTokens.some((fieldToken) => fieldToken.startsWith(token))) score += 20 * weight;
        else if (normalized.includes(token)) score += 12 * weight;
        else {
            const fuzzy = Math.max(...fieldTokens.map((fieldToken) => subsequenceScore(token, fieldToken)), 0);
            if (fuzzy) score += fuzzy * weight;
            else if (token.length >= 4 && fieldTokens.some((fieldToken) => editDistance(token, fieldToken) <= 2)) {
                score += 10 * weight;
            }
        }
    }

    return score;
}

export function scoreRouteSearchItem(item: RouteSearchItem, query: string) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return 1;

    const tokens = tokenize(query);
    const titleScore = scoreField(item.title, normalizedQuery, tokens, 7);
    const aliasScore = (item.aliases || []).reduce((sum, alias) => sum + scoreField(alias, normalizedQuery, tokens, 6), 0);
    const keywordScore = (item.keywords || []).reduce((sum, keyword) => sum + scoreField(keyword, normalizedQuery, tokens, 5), 0);
    const descriptionScore = scoreField(item.description || '', normalizedQuery, tokens, 2);
    const groupScore = scoreField(item.group, normalizedQuery, tokens, 2);
    const hrefScore = scoreField(item.href, normalizedQuery, tokens, 1);
    const actionBoost = item.group === 'Actions' && tokens.some((token) => ['add', 'create', 'new', 'import'].includes(token)) ? 80 : 0;

    return titleScore + aliasScore + keywordScore + descriptionScore + groupScore + hrefScore + actionBoost;
}

export function searchRouteItems(query: string, items: RouteSearchItem[], limit = 10): ScoredRouteSearchItem[] {
    return items
        .map((item) => ({ ...item, score: scoreRouteSearchItem(item, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
        .slice(0, limit);
}
