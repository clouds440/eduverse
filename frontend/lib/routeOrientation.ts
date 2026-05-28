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
    mail: 'Communication',
    chat: 'Communication',
    settings: 'Account',
    'change-password': 'Account',
};

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
    const title = labels[labels.length - 1] || 'Overview';
    const section = ROOT_SECTIONS[rootSegment] || labels[0] || 'Dashboard';
    const breadcrumbs: RouteBreadcrumb[] = segments.map((segment, index) => {
        const hrefSegments = segments.slice(0, index + 1);
        const isLast = index === segments.length - 1;
        const label = humanizeSegment(segment);

        return {
            label,
            href: isLast || isLikelyRecordId(segment) ? undefined : `/${hrefSegments.join('/')}`,
        };
    });

    return {
        section,
        title,
        breadcrumbs,
        isDashboardRoute,
    };
}
