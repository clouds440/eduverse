'use client';

import { useEffect } from 'react';
import { DashboardLayout, SidebarLink } from '@/components/ui/DashboardLayout';
import {
    LayoutDashboard, Users, BookOpen, GraduationCap,
    MessageSquare, Settings, LibraryBig, Trophy,
    Clock, ShieldOff, RefreshCw, Mail, CheckCircle, Book,
    Layers,
    CalendarDays, Calendar, Network, FileText, ArrowRightCircle
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { Organization, Role, OrgStatus, Teacher, Student } from '@/types';
import Link from 'next/link';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { useAuth, JwtPayload } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { useSocket } from '@/hooks/useSocket';

// Status Message Components
const StatusOverlay = ({ orgData, user }: { orgData: Organization | null, user: JwtPayload | null }) => {
    // If we have user status but no orgData yet, we can still show a basic message
    const currentStatus = orgData?.status || user?.status;
    const accessLevel = user?.accessLevel ?? 2;

    if (accessLevel > 0) return null;
    if (!orgData) return null;

    if (currentStatus === OrgStatus.PENDING) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-card/50 backdrop-blur-md rounded-lg shadow-xl border border-border text-center max-w-2xl mx-5 lg:mx-auto my-10">
                <div className="p-6 bg-warning/10 rounded-full mb-6 relative">
                    <Clock className="w-20 h-20 text-warning animate-pulse" />
                    <div className="absolute inset-0 bg-warning/80 rounded-full animate-ping opacity-20"></div>
                </div>
                <h2 className="text-4xl font-black text-card-foreground mb-4 tracking-tight">Awaiting Approval</h2>
                <p className="text-muted-foreground text-lg mb-8 font-medium">
                    Your organization registration is currently being verified.
                    You&apos;ll have full access once EduVerse confirms your details.
                </p>
                <div className="bg-warning text-warning/10 px-10 py-5 rounded-lg font-black text-xl border border-warning/40 w-full shadow-2xl flex items-center justify-center gap-3">
                    Status: Pending Verification
                </div>
            </div>
        );
    }

    if (orgData.status === OrgStatus.REJECTED) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-card/70 backdrop-blur-md rounded-lg shadow-xl border border-border text-center max-w-2xl mx-auto my-10">
                <div className="p-6 bg-danger/10 rounded-full mb-6 relative">
                    <ShieldOff className="w-20 h-20 text-danger" />
                    <div className="absolute inset-0 bg-danger/80 rounded-full animate-ping opacity-10"></div>
                </div>
                <h2 className="text-4xl font-black text-card-foreground mb-4 tracking-tight italic">Application Denied</h2>
                <div className="bg-danger/10 border border-danger/20 p-8 rounded-lg mb-8 text-left w-full shadow-inner">
                    <p className="text-[10px] font-black text-danger tracking-[0.3em] mb-4">Official Rejection Reason</p>
                    <MarkdownRenderer
                        content={orgData.statusHistory && orgData.statusHistory.length > 0
                            ? orgData.statusHistory[orgData.statusHistory.length - 1].message
                            : 'No reason provided.'}
                        className="text-danger text-lg font-bold prose prose-red prose-sm max-w-none leading-relaxed"
                    />
                </div>
                <p className="text-muted-foreground text-base mb-10 font-medium max-w-md">
                    To regain access, please update your organization details based on the feedback above and submit your application again.
                </p>
                {user?.role === Role.ORG_ADMIN && (
                    <Link
                        href="/settings"
                        className="inline-flex items-center gap-4 bg-danger hover:bg-danger/90 text-white px-12 py-6 rounded-lg font-black text-xl shadow-[0_20px_50px_rgba(220,38,38,0.3)] transition-all hover:-translate-y-1 active:scale-95 group tracking-tighter"
                    >
                        <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
                        Status: RE-APPLY NOW
                    </Link>
                )}
            </div>
        );
    }

    if (orgData.status === OrgStatus.SUSPENDED) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-card/70 backdrop-blur-md rounded-lg shadow-xl border border-border text-center max-w-2xl mx-auto my-10">
                <div className="p-6 bg-warning/50 rounded-full mb-6 relative">
                    <ShieldOff className="w-20 h-20 text-warning" />
                    <div className="absolute inset-0 bg-warning/40 rounded-full animate-ping opacity-10"></div>
                </div>
                <h2 className="text-4xl font-black text-card-foreground mb-4 tracking-tight italic">Access Suspended</h2>
                <p className="text-muted-foreground text-lg mb-8 font-medium">
                    Your institutional access has been temporarily restricted by the platform administrators.
                </p>
                <div className="bg-warning/10 text-warning p-8 rounded-lg border border-warning w-full mb-10 text-left shadow-inner">
                    <h3 className="font-black mb-4 flex items-center gap-2 text-[10px] tracking-[0.3em] text-warning/60"><ShieldOff className="w-4 h-4" /> Official Suspension Reason</h3>
                    <MarkdownRenderer
                        content={orgData.statusHistory && orgData.statusHistory.length > 0
                            ? orgData.statusHistory[orgData.statusHistory.length - 1].message
                            : 'Please contact platform support for further details.'}
                        className="italic font-bold text-warning prose prose-warning prose-sm max-w-none leading-relaxed"
                    />
                </div>
                <Link
                    href="/contact"
                    className="inline-flex items-center gap-4 bg-card hover:bg-muted text-foreground px-12 py-6 rounded-lg font-black text-xl shadow-2xl transition-all hover:-translate-y-1 group tracking-tighter border border-border"
                >
                    <Mail className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    Contact Platform Support
                </Link>
            </div>
        );
    }

    if (user?.userStatus === 'SUSPENDED') {
        // We don't return a blocking overlay here because Level 1 users (Suspended) 
        // are supposed to have READ access. Instead, we show a banner in the layout.
        return null;
    }

    if (user?.userStatus === 'ALUMNI' || user?.userStatus === 'EMERITUS') {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-card/70 backdrop-blur-md rounded-lg shadow-xl border border-border text-center max-w-2xl mx-auto my-10">
                <div className="p-6 bg-info/10 rounded-full mb-6 relative">
                    <GraduationCap className="w-20 h-20 text-info" />
                </div>
                <h2 className="text-4xl font-black text-card-foreground mb-4 tracking-tight italic">Account Retired</h2>
                <p className="text-muted-foreground text-lg mb-8 font-medium">
                    Your account has been marked as {user.userStatus === 'ALUMNI' ? 'Alumni' : 'Emeritus'} by your organization.
                </p>
                <div className="bg-info/10 text-info p-8 rounded-lg border border-info/10 w-full mb-10 shadow-inner text-center">
                    <p className="font-bold">You no longer have access to system records and write operations.</p>
                    <p className="text-sm opacity-70 mt-2">You can still access your mail and update your security settings.</p>
                </div>
                <div className="flex gap-4">
                    <Link
                        href="/mail"
                        className="inline-flex items-center gap-4 bg-card hover:bg-muted text-foreground px-8 py-4 rounded-lg font-bold shadow-xl transition-all border border-border"
                    >
                        <Mail className="w-5 h-5" />
                        Access Mail
                    </Link>
                    <Link
                        href="/change-password"
                        className="inline-flex items-center gap-4 bg-card hover:bg-muted text-foreground px-8 py-4 rounded-lg font-bold shadow-xl transition-all border border-border"
                    >
                        <Settings className="w-5 h-5" />
                        Security Settings
                    </Link>
                </div>
            </div>
        );
    }

    return null;
};

export default function OrgLayout({ children }: { children: React.ReactNode }) {
    const { user, token } = useAuth();
    const { state, dispatch } = useGlobal();
    const pathname = usePathname();

    const orgData = state.stats.orgData;
    const chatStats = state.stats.chat;
    const accessLevel = user?.accessLevel ?? 2;
    const isApproved = accessLevel >= 1;

    const { subscribe } = useSocket({
        token: token,
        userId: user?.id,
        userRole: user?.role
    });

    useEffect(() => {
        let mounted = true;

        const fetchAllData = () => {
            // Prevent fetching if component has unmounted
            if (!mounted) return;

            // Check if token is still valid (not cleared from localStorage)
            const currentToken = localStorage.getItem('token');
            if (!currentToken) return;

            if (currentToken && (user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER || user?.role === Role.TEACHER || user?.role === Role.STUDENT)) {
                // Fetch Org Data
                api.org.getOrgData(currentToken)
                    .then((data: Organization) => {
                        if (mounted) dispatch({ type: 'STATS_SET_ORG_DATA', payload: data });
                    })
                    .catch((err) => console.error('Failed to fetch org data:', err));

                // Fetch Mail Stats
                api.mail.getUnreadCount(currentToken)
                    .then(data => { if (mounted) dispatch({ type: 'STATS_SET_MAIL', payload: data }); })
                    .catch(err => console.error('Failed to fetch mail stats:', err));

                // Fetch Chat Stats
                api.chat.getUnreadCount(currentToken)
                    .then(data => { if (mounted) dispatch({ type: 'STATS_SET_CHAT', payload: data }); })
                    .catch(err => console.error('Failed to fetch chat stats:', err));
            }
        };

        fetchAllData();

        // Debounce global refreshes to avoid storms when socket events flood
        const timerRef: { current: number | null } = { current: null };
        const scheduleFetch = () => {
            if (!mounted) return;
            if (timerRef.current) window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => {
                if (mounted) fetchAllData();
                timerRef.current = null;
            }, 1000);
        };

        const unsubs = [
            subscribe('unread:update', scheduleFetch),
            subscribe('mail:new', scheduleFetch),
            subscribe('chat:message', scheduleFetch),
            subscribe('chat:read', scheduleFetch)
        ];

        const refreshOnEvent = () => scheduleFetch();
        window.addEventListener('stats-updated', refreshOnEvent);

        return () => {
            mounted = false;
            unsubs.forEach(u => u());
            window.removeEventListener('stats-updated', refreshOnEvent);
            if (timerRef.current) window.clearTimeout(timerRef.current);
        };
    }, [token, user?.role, user?.id, dispatch, subscribe]);

    const links = (): SidebarLink[] => {
        const orgLinks: SidebarLink[] = [];

        if (!isApproved) {
            // Simplified links for non-approved orgs - Allow Settings/Mail
            if (user?.role === Role.ORG_ADMIN) {
                orgLinks.push({ id: 'SETTINGS', label: 'Settings', href: '/settings', icon: Settings });
            }
            return orgLinks;
        }

        // Landing page link based on role
        let overviewHref = '/overview';
        if (user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER) {
            overviewHref = `/teachers/${user.id}`;
        } else if (user?.role === Role.STUDENT) {
            overviewHref = `/students/${user.id}`;
        }

        // Common links for everyone
        orgLinks.push({ id: 'DASHBOARD', label: 'Overview', href: overviewHref, icon: LayoutDashboard });
        orgLinks.push({
            id: 'CHAT',
            label: 'Messages',
            icon: MessageSquare,
            href: '/chat',
            badge: chatStats && chatStats.unread > 0 ? `${chatStats.unread}` : undefined
        });

        const isManagement = user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER;
        const isAcademic = user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER;

        // Management View (Admins & Managers)
        if (isManagement) {
            orgLinks.push({ id: 'COURSES', label: 'Courses', href: '/courses', icon: LibraryBig });
            orgLinks.push({ id: 'ACADEMIC_CYCLES', label: 'Academic Cycles', href: '/academic-cycles', icon: Calendar });
            orgLinks.push({ id: 'COHORTS', label: 'Cohorts', href: '/cohorts', icon: Network });
            orgLinks.push({ id: 'SECTIONS', label: 'Sections', href: '/sections', icon: Layers });
            orgLinks.push({ id: 'TEACHERS', label: 'Teachers', href: '/teachers', icon: Users });
            orgLinks.push({ id: 'STUDENTS', label: 'Students', href: '/students', icon: GraduationCap });
            orgLinks.push({ id: 'ATTENDANCE', label: 'Attendance', href: '/attendance', icon: CheckCircle });
            orgLinks.push({ id: 'SCHEDULES', label: 'Schedules', href: '/schedules', icon: CalendarDays });
            orgLinks.push({ id: 'TRANSCRIPTS', label: 'Transcripts', href: '/transcripts', icon: FileText });
            orgLinks.push({ id: 'PROMOTIONS', label: 'Promotions', href: '/promotions', icon: ArrowRightCircle });

            if (user?.role === Role.ORG_ADMIN) {
                orgLinks.push({ id: 'SETTINGS', label: 'Settings', href: '/settings', icon: Settings });
            }
        }

        // Academic/Teaching View (Teachers & Managers)
        if (user?.role === Role.TEACHER) {
            orgLinks.push({ id: 'COURSES', label: 'My Courses', href: '/courses', icon: LibraryBig });
            orgLinks.push({ id: 'SECTIONS', label: 'My Sections', href: '/sections', icon: Layers });
            orgLinks.push({ id: 'STUDENTS', label: 'My Students', href: '/students', icon: GraduationCap });
            orgLinks.push({ id: 'ATTENDANCE', label: 'Attendance', href: '/attendance', icon: CheckCircle });
        }

        // Shared Academic Features (Teachers and Managers, but not pure Admins unless explicitly handling classes)
        if (isAcademic && user?.role !== Role.ORG_ADMIN) {
            orgLinks.push({ id: 'TIMETABLE', label: 'Timetable', href: '/timetable', icon: Clock });
            orgLinks.push({ id: 'GRADES', label: 'Grades', href: '/grades', icon: Trophy });
            orgLinks.push({ id: 'PROFILE', label: 'Profile Settings', href: `/teachers/${user.id}/profile`, icon: Settings });
        }

        // Student View
        if (user?.role === Role.STUDENT) {
            orgLinks.push({ id: 'COURSES', label: 'My Courses', href: `/students/${user.id}?tab=courses`, icon: Book });
            orgLinks.push({ id: 'ASSESSMENTS', label: 'Assessments', href: `/students/${user.id}?tab=assessments`, icon: BookOpen });
            orgLinks.push({ id: 'GRADES', label: 'Grades', href: `/students/${user.id}?tab=grades`, icon: Trophy });
            orgLinks.push({ id: 'ATTENDANCE', label: 'Attendance', href: `/students/${user.id}?tab=attendance`, icon: CheckCircle });
            orgLinks.push({ id: 'TIMETABLE', label: 'Timetable', href: '/timetable', icon: Clock });
            orgLinks.push({ id: 'PROFILE', label: 'Profile Settings', href: `/students/${user.id}?tab=profile`, icon: Settings });
        }

        return orgLinks;
    };

    const bottomLinks: SidebarLink[] = [
        {
            id: 'MAIL',
            label: 'Mail',
            href: '/mail',
            icon: Mail,
            badge: state.stats.mail && state.stats.mail.unread > 0 ? `${state.stats.mail.unread}` : undefined
        }
    ];

    // Determine high-level dashboard pages for padding
    const isOrgAdmin = pathname === '/overview';
    const isGrades = pathname === '/grades' || pathname.includes('tab=grades');

    let overviewHref = '/settings';
    if (user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER) {
        overviewHref = `/teachers/${user.id}`;
    } else if (user?.role === Role.STUDENT) {
        overviewHref = `/students/${user.id}`;
    }
    const isOverview = pathname === overviewHref;

    const showPadding = isOrgAdmin || isGrades || isOverview;

    // Check if the current route is allowed for non-approved organizations
    const allowedSubPaths = ['settings', 'change-password', 'mail', 'contact'];
    const isAllowedRoute = allowedSubPaths.some(sub => pathname.startsWith(`/${sub}`));

    return (
        <DashboardLayout
            links={links()}
            bottomLinks={bottomLinks}
            showPadding={showPadding}
        >
            {user?.userStatus === 'SUSPENDED' && (
                <div className="mx-6 my-6 p-4 bg-warning/10 border border-warning rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-warning/10 rounded-lg">
                            <ShieldOff className="w-5 h-5 text-warning" />
                        </div>
                        <div>
                            <p className="font-bold text-warning leading-none">Read-Only Mode</p>
                            <p className="text-sm text-warning mt-1">Your account is suspended. You can view data but cannot make changes.</p>
                        </div>
                    </div>
                    <Link href="/mail" className="text-xs font-black bg-warning hover:bg-warning/90 text-white px-4 py-2 rounded-lg transition-colors">
                        Appeal Suspension
                    </Link>
                </div>
            )}
            {!isApproved && !isAllowedRoute ? (
                <StatusOverlay orgData={orgData} user={user} />
            ) : (
                children
            )}
        </DashboardLayout>
    );
}
