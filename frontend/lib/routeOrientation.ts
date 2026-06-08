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
    overview: 'Overview',
    organizations: 'Organizations',
    'platform-admins': 'Platform Admins',
    logs: 'Audit Logs',
    mail: 'Mail',
    chat: 'Messages',
    settings: 'Settings',
    'gpa-policies': 'GPA Policies',
    'change-password': 'Security',
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
    promotions: 'Promotions',
    finance: 'Finance',
    fees: 'Fees & Payments',
    structures: 'Structures',
    entries: 'Entries',
    transactions: 'Transactions',
    assessments: 'Assessments',
    announcements: 'Announcements',
    tasks: 'Tasks',
    profile: 'Profile',
    add: 'Add',
    create: 'Create',
    edit: 'Edit',
};

const ROOT_SECTIONS: Record<string, string> = {
    admin: 'Platform',
    finance: 'Finance',
    overview: 'Organization',
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
    promotions: 'Academics',
    fees: 'Finance',
    mail: 'Communication',
    chat: 'Communication',
    settings: 'Account',
    'change-password': 'Account',
};

const ACTION_SEGMENTS = ['add', 'create', 'edit'];

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
