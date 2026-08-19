import type { ElementType } from 'react';
import {
    Bell,
    Building,
    Calendar,
    FileCheck2,
    FileText,
    GraduationCap,
    GitBranch,
    Key,
    ListChecks,
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
import { settingsPath } from '@/lib/routes';

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
    prog: ['program', 'programs', 'major'],
    bldg: ['building', 'buildings'],
    rm: ['room', 'rooms'],
    fee: ['finance', 'fees', 'payments'],
    pay: ['payment', 'payments', 'finance'],
    gpa: ['gpa', 'grade', 'grades'],
    cal: ['calendar', 'academic-events'],
    eval: ['evaluation', 'evaluations', 'feedback'],
    msg: ['message', 'messages', 'chat'],
    map: ['campus', 'navigation', 'institute map'],
    nav: ['navigation', 'campus map', 'routes'],
};

const GROUP_BY_ID: Record<string, RouteSearchGroup> = {
    ACADEMIC_CYCLES: 'Academic',
    AI_COPILOT: 'Navigation',
    ASSESSMENTS: 'Academic',
    ATTENDANCE: 'Academic',
    COHORTS: 'Academic',
    COURSES: 'Academic',
    DEPARTMENTS: 'Academic',
    PROGRAMS: 'Academic',
    ONLINE_ADMISSIONS: 'Academic',
    PROGRESSION: 'Academic',
    REASSIGNMENT: 'Academic',
    EVALUATIONS: 'Academic',
    GRADE_FINALIZATION: 'Academic',
    GRADES: 'Academic',
    GPA_POLICIES: 'Settings',
    ACADEMIC_EVENTS: 'Academic',
    PREFERENCES: 'Academic',
    PREFERENCE_WINDOWS: 'Academic',
    PAST_RECORDS: 'Academic',
    SCHEDULES: 'Academic',
    SECTIONS: 'Academic',
    TIMETABLE: 'Academic',
    TRANSCRIPT: 'Academic',
    TRANSCRIPTS: 'Academic',
    FINANCE: 'Finance',
    FEES: 'Finance',
    MY_FINANCE: 'Finance',
    TEACHER_FINANCE: 'Finance',
    SETTINGS: 'Settings',
    PROFILE: 'Settings',
};

const ROUTE_METADATA: Record<string, Pick<RouteSearchItem, 'description' | 'aliases' | 'keywords'>> = {
    AI_COPILOT: {
        description: 'Ask role-aware questions using live EduVerse context',
        aliases: ['copilot', 'assistant'],
        keywords: ['ai', 'help', 'credits', 'context'],
    },
    ASSESSMENTS: {
        description: 'Assignments, quizzes, exams, and submissions',
        aliases: ['assignments', 'exams'],
        keywords: ['assessment', 'quiz', 'submission', 'deadline'],
    },
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
    PROGRAMS: {
        description: 'Provider-owned programs, courses, diplomas, curricula, and offerings',
        aliases: ['majors', 'course offerings', 'catalog'],
        keywords: ['program', 'major', 'curriculum', 'stages', 'offering', 'course', 'diploma'],
    },
    ONLINE_ADMISSIONS: {
        description: 'Review provider applications, applicant documents, statuses, and Campus student conversion',
        aliases: ['applications', 'applicants', 'admission inbox'],
        keywords: ['online admission', 'application', 'documents', 'accepted', 'rejected', 'provider outcome', 'admit student'],
    },
    PROGRESSION: {
        description: 'Preview and resolve student program stage progression',
        aliases: ['advance students', 'stage progression'],
        keywords: ['progress', 'advance', 'repeat', 'hold', 'complete program'],
    },
    REASSIGNMENT: {
        description: 'Move students between cohorts and sections safely',
        aliases: ['transfer students', 'move students'],
        keywords: ['reassign', 'transfer', 'cohort', 'section'],
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
    MY_FINANCE: {
        description: 'View personal salary, payments, and finance records',
        aliases: ['my payments', 'salary'],
        keywords: ['finance', 'salary', 'payment', 'claim'],
    },
    TEACHER_FINANCE: {
        description: 'View personal salary, payments, and finance records',
        aliases: ['my payments', 'salary'],
        keywords: ['finance', 'salary', 'payment', 'claim'],
    },
    FEEDBACK: {
        description: 'Review teaching and course feedback',
        aliases: ['evaluations', 'reviews'],
        keywords: ['teacher feedback', 'rating', 'evaluation'],
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
    ACADEMIC_EVENTS: {
        description: 'Academic events calendar',
        aliases: ['academic events', 'calendar'],
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
    PREFERENCES: {
        description: 'Rank open course or section preference polls',
        aliases: ['student polls', 'course preference', 'section preference'],
        keywords: ['poll', 'vote', 'choice', 'rank', 'preferences'],
    },
    PREFERENCE_WINDOWS: {
        description: 'Create, activate, and review section/course polls',
        aliases: ['polls', 'course polls', 'section polls', 'preference windows'],
        keywords: ['poll', 'vote', 'choice', 'ranked preference', 'announcement', 'audience'],
    },
    PAST_RECORDS: {
        description: 'Immutable records from archived academic cycles',
        aliases: ['archives', 'historical records', 'past cycles'],
        keywords: ['archive', 'history', 'old grades', 'past attendance', 'student record'],
    },
    SETTINGS: {
        description: 'Organization and account settings',
        aliases: ['appearance', 'profile'],
        keywords: ['theme', 'organization', 'settings'],
    },
    STUDENTS: {
        description: 'Student records, rosters, and enrollment management',
        aliases: ['learners', 'student enrollment'],
        keywords: ['std', 'stu', 'student', 'enroll', 'withdraw', 'transfer', 'cohort placement'],
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

function platformSearchItems(user: JwtPayload | null): RouteSearchItem[] {
    const role = user?.role;
    if (role !== Role.SUPER_ADMIN && role !== Role.PLATFORM_ADMIN) return [];

    const items: RouteSearchItem[] = [
        routeItem({
            id: 'admin-overview',
            title: 'Platform Overview',
            href: '/admin',
            group: 'Navigation',
            description: 'Platform organizations, activity, and operational summary',
            icon: Shield,
            aliases: ['admin dashboard'],
            keywords: ['platform', 'overview', 'dashboard'],
        }),
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
            id: 'admin-public-mail',
            title: 'Public Support Mail',
            href: '/admin/mail/public',
            group: 'Navigation',
            description: 'Review unauthenticated contact and support requests',
            icon: Mail,
            aliases: ['contact messages'],
            keywords: ['public mail', 'support', 'contact'],
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
            href: user?.id ? settingsPath(user.id) : '/admin',
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
                title: 'Security Audit',
                href: '/admin/logs',
                group: 'Navigation',
                description: 'Review security and account activity',
                icon: ScrollText,
                aliases: ['logs', 'audit logs'],
                keywords: ['audit', 'activity', 'security'],
            }),
            routeItem({
                id: 'admin-copilot-quality',
                title: 'Copilot Quality',
                href: '/admin/copilot-quality',
                group: 'Navigation',
                description: 'Review Copilot quality and tool behavior',
                icon: FileText,
                aliases: ['ai quality'],
                keywords: ['copilot', 'ai', 'quality', 'tools'],
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
    const canManagePolls = role === Role.ORG_ADMIN || role === Role.SUB_ADMIN || role === Role.ORG_MANAGER;
    const canManageStudentEnrollment = role === Role.ORG_ADMIN || role === Role.SUB_ADMIN;
    const canUseFinance = role === Role.ORG_ADMIN || role === Role.SUB_ADMIN || role === Role.FINANCE_MANAGER;
    const canReviewAdmissions = role === Role.ORG_ADMIN || role === Role.SUB_ADMIN || role === Role.ORG_MANAGER;
    const accountSettingsHref = user?.id ? settingsPath(user.id) : '/';

    return [
        ...(role ? [{
            id: 'help-docs',
            title: 'Help & Documentation',
            href: '/docs',
            group: 'Navigation' as const,
            description: 'Search EduVerse guides, workflows, and role documentation',
            icon: FileText,
            aliases: ['help center', 'guides'],
            keywords: ['docs', 'documentation', 'how to', 'support'],
        }, {
            id: 'public-admissions',
            title: 'Public Admissions Portal',
            href: '/admissions',
            group: 'Navigation' as const,
            description: 'Browse organizations and programs accepting online applications',
            icon: FileCheck2,
            aliases: ['apply online'],
            keywords: ['public', 'admissions', 'programs', 'applications'],
        }, {
            id: 'ai-subscription',
            title: 'AI Subscription & Credits',
            href: '/ai/subscription',
            group: 'Settings' as const,
            description: 'Review Copilot availability, subscription, and AI Credits',
            icon: Settings,
            aliases: ['copilot subscription'],
            keywords: ['ai', 'credits', 'subscription', 'plan'],
        }] : []),
        ...(canManageAcademic ? [
            {
                id: 'create-program',
                title: 'Add Program',
                href: '/programs/create',
                group: 'Actions' as const,
                description: 'Create a department program and curriculum',
                icon: GraduationCap,
                aliases: ['new program', 'new major'],
                keywords: ['program', 'major', 'curriculum'],
            },
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
            {
                id: 'section-relationships',
                title: 'Section Relationships',
                href: '/section-relationships',
                group: 'Academic' as const,
                description: 'Configure theory, lab, practical, and component section results',
                icon: GitBranch,
                aliases: ['course result scheme', 'lab theory relationship'],
                keywords: ['section components', 'theory', 'lab', 'weights'],
            },
            {
                id: 'manage-academic-calendar',
                title: 'Manage Academic Calendar',
                href: '/academic-calendar/manage',
                group: 'Actions' as const,
                description: 'Create and update academic events and closures',
                icon: Calendar,
                aliases: ['add academic event'],
                keywords: ['calendar', 'event', 'holiday', 'closure'],
            },
        ] : []),
        ...(canReviewAdmissions ? [{
            id: 'admissions-setup',
            title: 'Admissions Setup',
            href: '/admissions-setup',
            group: 'Academic' as const,
            description: 'Publish provider offerings with fees, funding, eligibility, forms, documents, and admissions lifecycle',
            icon: FileCheck2,
            aliases: ['application setup', 'program listing setup', 'discover setup', 'public admissions setup'],
            keywords: ['admission', 'offering', 'program', 'course', 'diploma', 'fees', 'funding', 'eligibility', 'requirements', 'publish', 'open applications', 'discover'],
        }, {
            id: 'admission-forms',
            title: 'Admission Forms',
            href: '/admission-forms',
            group: 'Academic' as const,
            description: 'Manage versioned application forms and document requirements',
            icon: FileCheck2,
            aliases: ['application forms', 'form builder'],
            keywords: ['admission', 'schema', 'documents', 'versions'],
        }, {
            id: 'admissions-missing-documents',
            title: 'Admissions Missing Documents',
            href: '/online-admissions?missingRequiredDocuments=true',
            group: 'Academic' as const,
            description: 'Show applications missing required uploads',
            icon: FileCheck2,
            aliases: ['incomplete applications'],
            keywords: ['admission', 'documents', 'missing', 'applicant'],
        }, {
            id: 'admissions-rejected',
            title: 'Rejected Admissions',
            href: '/online-admissions?status=REJECTED',
            group: 'Academic' as const,
            description: 'Review retained rejected applications',
            icon: FileCheck2,
            aliases: ['rejected applications'],
            keywords: ['admission', 'rejected', 'decision'],
        }] : []),
        ...(canManageAcademic ? [{
            id: 'create-admission-form',
            title: 'Create Admission Form',
            href: '/admission-forms/new',
            group: 'Actions' as const,
            description: 'Build a new online application form',
            icon: FileCheck2,
            aliases: ['new application form'],
            keywords: ['admission', 'form', 'documents'],
        }] : []),
        ...(canManageAcademic ? [{
            id: 'create-evaluation-window',
            title: 'Add Evaluation Window',
            href: '/evaluations/windows/create',
            group: 'Actions' as const,
            description: 'Open a teacher or course evaluation period',
            icon: ListChecks,
            aliases: ['new evaluation'],
            keywords: ['feedback', 'evaluation', 'window'],
        }] : []),
        ...(canManagePolls ? [{
            id: 'create-preference-poll',
            title: 'New Section/Course Poll',
            href: '/preference-windows?create=poll',
            group: 'Actions' as const,
            description: 'Open the poll window creator',
            icon: ListChecks,
            aliases: ['new preference window', 'create poll', 'course poll', 'section poll'],
            keywords: ['poll', 'vote', 'choice', 'ranked preference', 'announcement audience'],
        }] : []),
        ...(canManageStudentEnrollment ? [{
            id: 'manage-student-enrollment',
            title: 'Manage Student Enrollment',
            href: '/users/students',
            group: 'Actions' as const,
            description: 'Choose a student, then manage cohort placement and section enrollment',
            icon: GraduationCap,
            aliases: ['student enrollment', 'enroll student', 'withdraw student', 'change cohort'],
            keywords: ['enroll', 'withdraw', 'transfer', 'section enrollment', 'cohort placement'],
        }] : []),
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
            {
                id: 'finance-payroll',
                title: 'Payroll',
                href: '/finance/payroll',
                group: 'Finance' as const,
                description: 'Review staff payroll and salary entries',
                icon: Wallet,
                aliases: ['salaries'],
                keywords: ['payroll', 'salary', 'staff pay'],
            },
            {
                id: 'finance-audit-logs',
                title: 'Finance Audit Logs',
                href: '/finance/audit-logs',
                group: 'Finance' as const,
                description: 'Review finance activity and changes',
                icon: ScrollText,
                aliases: ['finance history'],
                keywords: ['audit', 'finance', 'activity'],
            },
        ] : []),
        ...(role === Role.ORG_ADMIN ? [{
            id: 'settings-gpa-policies',
            title: 'GPA Policies',
            href: user?.id ? settingsPath(user.id, 'gpa-policies') : '/',
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
            href: accountSettingsHref,
            group: 'Settings' as const,
            description: 'Update your profile',
            icon: Settings,
            aliases: ['profile'],
            keywords: ['account'],
        }] : []),
        ...(role === Role.STUDENT ? [{
            id: 'student-profile',
            title: 'Profile Settings',
            href: accountSettingsHref,
            group: 'Settings' as const,
            description: 'View your student profile',
            icon: Settings,
            aliases: ['profile'],
            keywords: ['account'],
        }] : []),
        ...(role === Role.SUB_ADMIN ? [{
            id: 'sub-admin-profile',
            title: 'Profile Settings',
            href: accountSettingsHref,
            group: 'Settings' as const,
            description: 'Update your profile',
            icon: Settings,
            aliases: ['profile'],
            keywords: ['account'],
        }] : []),
        ...(role === Role.FINANCE_MANAGER ? [{
            id: 'finance-manager-profile',
            title: 'Profile Settings',
            href: accountSettingsHref,
            group: 'Settings' as const,
            description: 'Update your profile',
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
        return platformSearchItems(user);
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
            else if (token.length >= 4 && fieldTokens.some((fieldToken) => {
                const maxDistance = token.length >= 7 && fieldToken.length >= 7 ? 2 : 1;
                const anchored = token[0] === fieldToken[0] || token.slice(0, 2) === fieldToken.slice(0, 2);
                return anchored && editDistance(token, fieldToken) <= maxDistance;
            })) {
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
