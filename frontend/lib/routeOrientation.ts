import { DASHBOARD_MODULES } from './constants';

export interface RouteBreadcrumb {
    label: string;
    href?: string;
}

export interface RouteOrientation {
    section: string;
    title: string;
    breadcrumbs: RouteBreadcrumb[];
    isDashboardRoute: boolean;
}

const SEGMENT_LABELS: Record<string, string> = {
    admin: 'Admin',
    ai: 'EduVerse Copilot',
    overview: 'Overview',
    organizations: 'Organizations',
    'platform-admins': 'Platform Admins',
    logs: 'Audit Logs',
    mail: 'Mail',
    chat: 'Messages',
    settings: 'Settings',
    'gpa-policies': 'GPA Policies',
    'change-password': 'Security',
    users: 'Users',
    teacher: 'Teacher Portal',
    student: 'Student Portal',
    'sub-admin': 'Sub Admin Profile',
    'finance-manager': 'Finance Manager Profile',
    guardians: 'Guardians',
    'sub-admins': 'Sub Admins',
    'finance-managers': 'Finance Managers',
    teachers: 'Faculty',
    students: 'Students',
    sections: 'Sections',
    courses: 'Courses',
    cohorts: 'Cohorts',
    'academic-cycles': 'Academic Cycles',
    attendance: 'Attendance',
    grades: 'Grades',
    schedules: 'Schedules',
    timetable: 'Timetable',
    transcripts: 'Transcripts',
    reassignment: 'Reassignment',
    finance: 'Finance',
    fees: 'Fees & Payments',
    structures: 'Structures',
    entries: 'Entries',
    transactions: 'Transactions',
    assessments: 'Assessments',
    announcements: 'Announcements',
    tasks: 'Tasks',
    profile: 'Profile',
    profiles: 'Profiles',
    add: 'Add',
    create: 'Create',
    edit: 'Edit',
    link: 'Link',
};

const ROOT_SECTIONS: Record<string, string> = {
    admin: 'Platform',
    ai: 'EduVerse Copilot',
    finance: 'Finance',
    overview: 'Organization',
    users: 'People',
    teacher: 'Teacher Portal',
    student: 'Student Portal',
    'sub-admin': 'Account',
    'finance-manager': 'Account',
    profiles: 'People',
    guardians: 'People',
    'sub-admins': 'People',
    'finance-managers': 'People',
    students: 'People',
    teachers: 'People',
    sections: 'Academics',
    courses: 'Academics',
    cohorts: 'Academics',
    'academic-cycles': 'Academics',
    attendance: 'Academics',
    grades: 'Academics',
    schedules: 'Academics',
    timetable: 'Academics',
    transcripts: 'Academics',
    reassignment: 'Academics',
    fees: 'Finance',
    mail: 'Communication',
    chat: 'Communication',
    settings: 'Account',
    'change-password': 'Account',
};

const ACTION_SEGMENTS = ['add', 'create', 'edit', 'link'];
const USER_AREA_SEGMENTS = ['sub-admins', 'finance-managers', 'teachers', 'students', 'guardians'];

function cleanPath(pathname: string) {
    return pathname.split('?')[0].split('#')[0] || '/';
}

function isLikelyRecordId(segment: string) {
    return segment.length >= 16 || /^[0-9a-f-]{8,}$/i.test(segment);
}

function humanizeSegment(segment: string) {
    if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
    if (isLikelyRecordId(segment)) return 'Details';

    return decodeURIComponent(segment)
        .split('-')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function singularize(label: string) {
    if (label === 'Faculty') return label;
    if (label.endsWith('ies')) return `${label.slice(0, -3)}y`;
    if (label.endsWith('s')) return label.slice(0, -1);
    return label;
}

function isNonRoutableBreadcrumbSegment(segment: string, segments: string[], index: number) {
    return segment === 'assessments' && isLikelyRecordId(segments[index - 1] || '');
}

function buildUsersOrientation(segments: string[]): RouteOrientation {
    const isNestedUsersRoute = segments[0] === 'users';
    const userArea = isNestedUsersRoute ? segments[1] : segments[0];
    const actionSegment = segments.find((segment) => ACTION_SEGMENTS.includes(segment));
    const areaLabel = userArea ? humanizeSegment(userArea) : 'Users';
    const title = actionSegment && userArea
        ? `${humanizeSegment(actionSegment)} ${singularize(areaLabel)}`
        : areaLabel;

    const breadcrumbs: RouteBreadcrumb[] = [
        { label: 'Organization' },
        { label: 'Users', href: isNestedUsersRoute && segments.length === 1 ? undefined : '/users' },
    ];

    if (userArea) {
        const areaHref = `/users/${userArea}`;
        const areaIsLast = !actionSegment && (
            (isNestedUsersRoute && segments.length === 2) ||
            (!isNestedUsersRoute && segments.length === 1)
        );
        breadcrumbs.push({
            label: areaLabel,
            href: areaIsLast ? undefined : areaHref,
        });
    }

    if (actionSegment) {
        breadcrumbs.push({ label: humanizeSegment(actionSegment) });
    }

    return {
        section: 'People',
        title: segments.length === 1 && segments[0] === 'users' ? 'Users' : title,
        breadcrumbs,
        isDashboardRoute: true,
    };
}

export function getRouteOrientation(pathname: string): RouteOrientation {
    const path = cleanPath(pathname);
    const segments = path.split('/').filter(Boolean);
    const rootSegment = segments[0] || '';
    const isDashboardRoute = DASHBOARD_MODULES.includes(rootSegment);

    if (!isDashboardRoute) {
        return {
            section: 'Public',
            title: humanizeSegment(rootSegment || 'Home'),
            breadcrumbs: [],
            isDashboardRoute,
        };
    }

    if (rootSegment === 'users' || USER_AREA_SEGMENTS.includes(rootSegment)) {
        return buildUsersOrientation(segments);
    }

    const labels = segments.map(humanizeSegment);
    const actionSegment = segments.find((segment) => ACTION_SEGMENTS.includes(segment));
    const title = actionSegment
        ? `${humanizeSegment(actionSegment)} ${singularize(humanizeSegment(rootSegment))}`
        : labels[labels.length - 1] || 'Overview';
    const section = ROOT_SECTIONS[rootSegment] || labels[0] || 'Dashboard';
    const pathBreadcrumbs: RouteBreadcrumb[] = segments.map((segment, index) => {
        const hrefSegments = segments.slice(0, index + 1);
        const isLast = index === segments.length - 1;
        const label = humanizeSegment(segment);

        return {
            label,
            href: isLast || isLikelyRecordId(segment) || isNonRoutableBreadcrumbSegment(segment, segments, index)
                ? undefined
                : `/${hrefSegments.join('/')}`,
        };
    });
    const contextLabel = rootSegment === 'admin' ? 'Platform' : 'Organization';
    const shouldIncludeSection = section !== contextLabel && section !== labels[0];
    const breadcrumbs: RouteBreadcrumb[] = [
        { label: contextLabel },
        ...(shouldIncludeSection ? [{ label: section }] : []),
        ...pathBreadcrumbs,
    ];

    return {
        section,
        title,
        breadcrumbs,
        isDashboardRoute,
    };
}
