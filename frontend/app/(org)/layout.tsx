'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout, SidebarLink } from '@/components/ui/DashboardLayout';
import {
    LayoutDashboard, Users, BookOpen, GraduationCap,
    MessageSquare, Settings, LibraryBig, Trophy,
    Clock, ShieldOff, RefreshCw, Mail, CheckCircle, Book,
    Layers,
    CalendarDays, Calendar, Network, FileText, ArrowRightCircle, Wallet,
    ShieldAlert
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { Organization, Role, OrgStatus } from '@/types';
import Link from 'next/link';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { useAuth, JwtPayload } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { useSocket } from '@/hooks/useSocket';
import { Button } from '@/components/ui/Button';
import { VerificationCodeInput } from '@/components/ui/VerificationCodeInput';
import { Badge } from '@/components/ui/Badge';
import { StatusBanner } from '@/components/ui/StatusBanner';

// Status Message Components
const StatusOverlay = ({ orgData, user }: { orgData: Organization | null, user: JwtPayload | null }) => {
    // If we have user status but no orgData yet, we can still show a basic message
    const currentStatus = orgData?.status || user?.status;
    const accessLevel = user?.accessLevel ?? 2;

    if (accessLevel > 0) return null;
    if (!orgData) return null;

    const latestStatusMessage = orgData.statusHistory && orgData.statusHistory.length > 0
        ? orgData.statusHistory[orgData.statusHistory.length - 1].message
        : undefined;
    const panelClassName = "mx-auto my-6 w-full max-w-3xl px-3 sm:px-0";

    if (currentStatus === OrgStatus.PENDING) {
        return (
            <div className={panelClassName}>
                <StatusBanner
                    variant="warning"
                    icon={Clock}
                    title="Awaiting approval"
                    description="Your organization registration is being verified. Full workspace access unlocks after EduVerse confirms your details."
                >
                    <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-black text-warning">
                        Status: Pending Verification
                    </div>
                </StatusBanner>
            </div>
        );
    }

    if (orgData.status === OrgStatus.REJECTED) {
        return (
            <div className={panelClassName}>
                <StatusBanner
                    variant="danger"
                    icon={ShieldOff}
                    title="Application denied"
                    description="Update your organization details using the feedback below, then submit the application again."
                    action={user?.role === Role.ORG_ADMIN ? { label: 'Update application', href: '/settings' } : undefined}
                >
                    <div className="rounded-md border border-danger/20 bg-background/60 p-3 text-left">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-danger">Official rejection reason</p>
                        <MarkdownRenderer
                            content={latestStatusMessage || 'No reason provided.'}
                            className="text-danger! prose prose-red prose-sm max-w-none leading-relaxed"
                        />
                    </div>
                </StatusBanner>
            </div>
        );
    }

    if (orgData.status === OrgStatus.SUSPENDED) {
        return (
            <div className={panelClassName}>
                <StatusBanner
                    variant="warning"
                    icon={ShieldOff}
                    title="Access suspended"
                    description="Institutional access is temporarily restricted by platform administrators."
                    action={{ label: 'Contact support', href: '/contact' }}
                >
                    <div className="rounded-md border border-warning/25 bg-background/60 p-3 text-left">
                        <h3 className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-warning">
                            <ShieldAlert className="w-4 h-4" />
                            Official suspension reason
                        </h3>
                        <MarkdownRenderer
                            content={latestStatusMessage || 'Please contact EduVerse support for further details.'}
                            className="text-warning! prose prose-warning prose-sm max-w-none leading-relaxed"
                        />
                    </div>
                </StatusBanner>
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
            <div className={panelClassName}>
                <StatusBanner
                    variant="info"
                    icon={GraduationCap}
                    title="Account retired"
                    description={`Your account has been marked as ${user.userStatus === 'ALUMNI' ? 'Alumni' : 'Emeritus'} by your organization. Mail and security settings remain available.`}
                >
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Link
                            href="/mail"
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted"
                        >
                            <Mail className="h-4 w-4" />
                            Access Mail
                        </Link>
                        <Link
                            href="/change-password"
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted"
                        >
                            <Settings className="h-4 w-4" />
                            Security Settings
                        </Link>
                    </div>
                </StatusBanner>
            </div>
        );
    }

    return null;
};

const ContactEmailVerificationBanner = ({
    compact = false,
    contactEmail,
    lastVerificationSentAt,
    onVerified,
}: {
    compact?: boolean;
    contactEmail?: string;
    lastVerificationSentAt?: string | null;
    onVerified: () => Promise<void>;
}) => {
    const { token } = useAuth();
    const { state, dispatch } = useGlobal();
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    const verificationCooldownSeconds = 60;

    useEffect(() => {
        const updateCooldown = () => {
            if (!lastVerificationSentAt) {
                setCooldownSeconds(0);
                return;
            }
            const sentAt = new Date(lastVerificationSentAt).getTime();
            const elapsedSeconds = Math.floor((Date.now() - sentAt) / 1000);
            setCooldownSeconds(Math.max(0, verificationCooldownSeconds - elapsedSeconds));
        };

        updateCooldown();
        const interval = window.setInterval(updateCooldown, 1000);
        return () => window.clearInterval(interval);
    }, [lastVerificationSentAt]);

    const resendCode = async () => {
        if (!token || cooldownSeconds > 0 || state.ui.processing['contact-email-resend']) return;
        setError('');
        dispatch({ type: 'UI_START_PROCESSING', payload: 'contact-email-resend' });
        try {
            const response = await api.auth.resendContactEmailVerification(token);
            dispatch({ type: 'TOAST_ADD', payload: { message: response.message, type: 'success' } });
            await onVerified();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to resend verification code.';
            setError(message);
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'contact-email-resend' });
        }
    };

    const verifyCode = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!token || state.ui.processing['contact-email-verify']) return;
        setError('');
        dispatch({ type: 'UI_START_PROCESSING', payload: 'contact-email-verify' });
        try {
            const response = await api.auth.verifyContactEmail(code, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: response.message, type: 'success' } });
            setCode('');
            await onVerified();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to verify contact email.');
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'contact-email-verify' });
        }
    };

    return (
        <div className={`${compact ? 'mx-auto my-6 w-full max-w-3xl p-4 sm:p-5' : 'mx-3 my-3 p-3 sm:mx-6 sm:my-4 sm:p-4'} rounded-lg bg-warning/10 border border-warning/40 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500`}>
            <div className={`${compact ? 'flex flex-col items-center' : 'grid grid-cols-1 xl:grid-cols-[1fr_auto] xl:items-center'} gap-5`}>
                <div className={`${compact ? 'flex flex-col items-center text-center' : 'flex items-start'} gap-4`}>
                    <div className="p-2 bg-warning/10 rounded-md">
                        <Mail className={`${compact ? 'w-6 h-6' : 'w-5 h-5'} text-warning`} />
                    </div>
                    <div>
                        <p className={`${compact ? 'text-lg' : 'text-base'} font-black text-warning leading-tight`}>Verify your contact email</p>
                        <p className="text-sm text-warning mt-1 font-medium">
                            Your contact email is used for password recovery and important organization communication.
                        </p>
                        {contactEmail && (
                            <div className={`mt-2 flex flex-wrap items-center ${compact ? 'justify-center' : ''} gap-2`}>
                                <p className="text-xs text-warning/80 font-bold break-all">{contactEmail}</p>
                                <Badge variant="warning" size="sm" icon={ShieldAlert}>Unverified</Badge>
                            </div>
                        )}
                        <Link href="/settings#contact-email" className="inline-flex mt-2 text-xs font-black text-warning hover:underline">
                            Incorrect contact email? Change now
                        </Link>
                        {error && <p className="text-xs text-danger mt-2 font-bold">{error}</p>}
                    </div>
                </div>

                <form className={`${compact ? 'w-full max-w-sm' : 'w-full xl:w-auto'} flex flex-col items-stretch sm:items-center gap-3`} onSubmit={verifyCode}>
                    <VerificationCodeInput
                        id="contact-code"
                        value={code}
                        onChange={(next) => {
                            setCode(next);
                            if (error) setError('');
                        }}
                        disabled={state.ui.processing['contact-email-verify']}
                        error={!!error}
                    />
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button
                            type="submit"
                            variant="warning"
                            icon={CheckCircle}
                            loadingId="contact-email-verify"
                            loadingText="Verifying..."
                            px="px-4"
                            py="py-2.5"
                            disabled={code.length !== 6}
                            className="whitespace-nowrap"
                        >
                            Verify
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            icon={RefreshCw}
                            onClick={resendCode}
                            loadingId="contact-email-resend"
                            loadingText="Sending..."
                            px="px-4"
                            py="py-2.5"
                            disabled={cooldownSeconds > 0}
                            className="whitespace-nowrap"
                        >
                            {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend Code'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
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

            if (!token) return;

            if (user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER || user?.role === Role.TEACHER || user?.role === Role.STUDENT) {
                // Fetch Org Data
                api.org.getOrgData(token)
                    .then((data: Organization) => {
                        if (mounted) dispatch({ type: 'STATS_SET_ORG_DATA', payload: data });
                    })
                    .catch((err) => console.error('Failed to fetch org data:', err));

                // Fetch Mail Stats
                api.mail.getUnreadCount(token)
                    .then(data => { if (mounted) dispatch({ type: 'STATS_SET_MAIL', payload: data }); })
                    .catch(err => console.error('Failed to fetch mail stats:', err));

                // Fetch Chat Stats
                api.chat.getUnreadCount(token)
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

    const links = useMemo<SidebarLink[]>(() => {
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
            orgLinks.push({ id: 'FINANCE', label: 'Finance', href: '/finance', icon: Wallet });

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
            orgLinks.push({ id: 'TRANSCRIPT', label: 'Transcript', href: '/transcripts', icon: FileText });
            orgLinks.push({ id: 'FEES', label: 'Fees & Payments', href: '/fees', icon: Wallet });
            orgLinks.push({ id: 'PROFILE', label: 'Profile Settings', href: `/students/${user.id}?tab=profile`, icon: Settings });
        }

        return orgLinks;
    }, [chatStats, isApproved, user]);

    const bottomLinks = useMemo<SidebarLink[]>(() => [
        {
            id: 'MAIL',
            label: 'Mail',
            href: '/mail',
            icon: Mail,
            badge: state.stats.mail && state.stats.mail.unread > 0 ? `${state.stats.mail.unread}` : undefined
        }
    ], [state.stats.mail]);

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
    const contactEmailUnverified = user?.role === Role.ORG_ADMIN && orgData && !orgData.contactEmailVerifiedAt;
    const refreshOrgData = async () => {
        if (!token) return;
        const data = await api.org.getOrgData(token);
        dispatch({ type: 'STATS_SET_ORG_DATA', payload: data });
    };

    return (
        <DashboardLayout
            links={links}
            bottomLinks={bottomLinks}
            showPadding={showPadding}
        >
            {user?.userStatus === 'SUSPENDED' && (
                <div className="mx-3 my-3 flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 sm:mx-6 sm:my-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-warning/10 rounded-md">
                            <ShieldOff className="w-5 h-5 text-warning" />
                        </div>
                        <div>
                            <p className="font-bold text-warning leading-none">Read-Only Mode</p>
                            <p className="text-sm text-warning mt-1">Your account is suspended. You can view data but cannot make changes.</p>
                        </div>
                    </div>
                    <Link href="/mail" className="inline-flex min-h-10 items-center justify-center rounded-md bg-warning px-4 py-2 text-xs font-black text-white transition-colors hover:bg-warning/90">
                        Appeal Suspension
                    </Link>
                </div>
            )}
            {contactEmailUnverified && (
                <ContactEmailVerificationBanner
                    contactEmail={orgData?.contactEmail}
                    lastVerificationSentAt={orgData?.lastVerificationSentAt}
                    onVerified={refreshOrgData}
                    compact={!isAllowedRoute}
                />
            )}
            {contactEmailUnverified && !isAllowedRoute ? null : !isApproved && !isAllowedRoute ? (
                <StatusOverlay orgData={orgData} user={user} />
            ) : (
                children
            )}
        </DashboardLayout>
    );
}
