import {
    ArrowRightCircle,
    Bell,
    Book,
    BookOpen,
    Calendar,
    CalendarDays,
    CheckCircle,
    Clock,
    FileText,
    GraduationCap,
    Layers,
    LayoutDashboard,
    LibraryBig,
    MessageSquare,
    Network,
    ScrollText,
    Settings,
    Trophy,
    Users,
    Wallet,
    UserCog2,
} from 'lucide-react';
import { Role } from '@/types';
import type { SidebarLink } from '@/components/ui/DashboardLayout';
import { getRoleDashboardPath } from '@/lib/roles';

interface OrgSidebarUser {
    id?: string;
    role?: Role | null;
}

interface BuildOrgSidebarLinksOptions {
    user: OrgSidebarUser | null;
    isApproved: boolean;
    unreadChats?: number;
}

function overviewHrefFor(user: OrgSidebarUser | null) {
    const href = getRoleDashboardPath(user);
    return href === '/' ? '/overview' : href;
}

export function buildOrgSidebarLinks({ user, isApproved, unreadChats }: BuildOrgSidebarLinksOptions): SidebarLink[] {
    const links: SidebarLink[] = [];

    if (!isApproved) {
        if (user?.role === Role.ORG_ADMIN) {
            links.push({ id: 'SETTINGS', label: 'Settings', href: '/settings', icon: Settings });
        }
        return links;
    }

    if (user?.role !== Role.GUARDIAN) {
        links.push({ id: 'DASHBOARD', label: 'Overview', href: overviewHrefFor(user), icon: LayoutDashboard });
    }
    links.push({
        id: 'CHAT',
        label: 'Messages',
        href: '/chat',
        icon: MessageSquare,
        badge: unreadChats && unreadChats > 0 ? `${unreadChats}` : undefined,
    });

    if (user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN) {
        links.push({ id: 'COURSES', label: 'Courses', href: '/courses', icon: LibraryBig });
        links.push({ id: 'ACADEMIC_CYCLES', label: 'Academic Cycles', href: '/academic-cycles', icon: Calendar });
        links.push({ id: 'COHORTS', label: 'Cohorts', href: '/cohorts', icon: Network });
        links.push({ id: 'SECTIONS', label: 'Sections', href: '/sections', icon: Layers });
        links.push({ id: 'USERS', label: 'Users', href: '/users', icon: UserCog2 });
        links.push({ id: 'ATTENDANCE', label: 'Attendance', href: '/attendance', icon: CheckCircle });
        links.push({ id: 'SCHEDULES', label: 'Schedules', href: '/schedules', icon: CalendarDays });
        links.push({ id: 'TRANSCRIPTS', label: 'Transcripts', href: '/transcripts', icon: FileText });
        links.push({ id: 'PROMOTIONS', label: 'Promotions', href: '/promotions', icon: ArrowRightCircle });
        links.push({ id: 'GRADE_FINALIZATION', label: 'Grade Finalization', href: '/grade-finalization', icon: Trophy });
        links.push({ id: 'FINANCE', label: user.role === Role.SUB_ADMIN ? 'Finance Audit' : 'Finance', href: '/finance', icon: Wallet });

        if (user.role === Role.ORG_ADMIN) {
            links.push({ id: 'GPA_POLICIES', label: 'GPA Policies', href: '/settings/gpa-policies', icon: ScrollText });
            links.push({ id: 'SETTINGS', label: 'Settings', href: '/settings', icon: Settings });
        }
    }

    if (user?.role === Role.TEACHER) {
        links.push({ id: 'COURSES', label: 'My Courses', href: '/courses', icon: LibraryBig });
        links.push({ id: 'SECTIONS', label: 'My Sections', href: '/sections', icon: Layers });
        links.push({ id: 'STUDENTS', label: 'My Students', href: '/students', icon: GraduationCap });
        links.push({ id: 'ATTENDANCE', label: 'Attendance', href: '/attendance', icon: CheckCircle });
    }

    if (user?.role === Role.ORG_MANAGER) {
        links.push({ id: 'SECTIONS', label: 'My Sections', href: '/sections', icon: Layers });
        links.push({ id: 'STUDENTS', label: 'My Students', href: '/students', icon: GraduationCap });
        links.push({ id: 'ATTENDANCE', label: 'Attendance', href: '/attendance', icon: CheckCircle });
        links.push({ id: 'TRANSCRIPTS', label: 'Transcripts', href: '/transcripts', icon: FileText });
        links.push({ id: 'GRADE_FINALIZATION', label: 'Grade Finalization', href: '/grade-finalization', icon: Trophy });
    }

    if (user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER) {
        links.push({ id: 'TIMETABLE', label: 'Timetable', href: '/timetable', icon: Clock });
        links.push({ id: 'GRADES', label: 'Grades', href: '/grades', icon: Trophy });
        links.push({ id: 'PROFILE', label: 'Profile Settings', href: `/teachers/${user.id}/profile`, icon: Settings });
    }

    if (user?.role === Role.FINANCE_MANAGER) {
        links.push({ id: 'FINANCE', label: 'Finance', href: '/finance', icon: Wallet });
    }

    if (user?.role === Role.STUDENT) {
        links.push({ id: 'COURSES', label: 'My Courses', href: `/students/${user.id}?tab=courses`, icon: Book });
        links.push({ id: 'ASSESSMENTS', label: 'Assessments', href: `/students/${user.id}?tab=assessments`, icon: BookOpen });
        links.push({ id: 'GRADES', label: 'Grades', href: `/students/${user.id}?tab=grades`, icon: Trophy });
        links.push({ id: 'ATTENDANCE', label: 'Attendance', href: `/students/${user.id}?tab=attendance`, icon: CheckCircle });
        links.push({ id: 'TIMETABLE', label: 'Timetable', href: '/timetable', icon: Clock });
        links.push({ id: 'TRANSCRIPT', label: 'Transcript', href: '/transcripts', icon: FileText });
        links.push({ id: 'FEES', label: 'Fees & Payments', href: '/fees', icon: Wallet });
        links.push({ id: 'PROFILE', label: 'Profile Settings', href: `/students/${user.id}?tab=profile`, icon: Settings });
    }

    if (user?.role === Role.GUARDIAN) {
        links.push({ id: 'GUARDIAN_OVERVIEW', label: 'Overview', href: '/guardian', icon: LayoutDashboard });
        links.push({ id: 'GUARDIAN_STUDENTS', label: 'Linked Students', href: '/guardian?view=students', icon: Users });
        links.push({ id: 'GUARDIAN_ATTENDANCE', label: 'Attendance', href: '/guardian?view=attendance', icon: CheckCircle });
        links.push({ id: 'GUARDIAN_GRADES', label: 'Grades', href: '/guardian?view=grades', icon: Trophy });
        links.push({ id: 'GUARDIAN_TIMETABLE', label: 'Timetable', href: '/guardian?view=timetable', icon: Clock });
        links.push({ id: 'GUARDIAN_TRANSCRIPT', label: 'Transcript', href: '/guardian?view=transcript', icon: FileText });
        links.push({ id: 'GUARDIAN_FEES', label: 'Fees & Payments', href: '/guardian?view=fees', icon: Wallet });
        links.push({ id: 'GUARDIAN_ANNOUNCEMENTS', label: 'Announcements', href: '/guardian?view=announcements', icon: Bell });
        links.push({ id: 'GUARDIAN_PROFILE', label: 'Profile Settings', href: '/guardian?view=profile', icon: Settings });
    }

    return links;
}

export function getOrgOverviewHref(user: OrgSidebarUser | null) {
    if (user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN) return '/overview';
    return overviewHrefFor(user);
}

export const getSidebarItemsForRole = buildOrgSidebarLinks;
