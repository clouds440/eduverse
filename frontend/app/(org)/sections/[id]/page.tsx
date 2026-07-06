'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
    ArrowRight,
    BookOpen,
    Calendar,
    CalendarCheck,
    ClipboardList,
    FileText,
    GraduationCap,
    LayoutDashboard,
    MapPin,
    Pencil,
    School,
    Trophy,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { Section, Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import AssessmentList from '@/components/sections/AssessmentList';
import SectionSchedules from '@/components/sections/SectionSchedules';
import CourseMaterials from '@/components/sections/CourseMaterials';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { Badge } from '@/components/ui/Badge';
import { NotFound } from '@/components/NotFound';
import { PageHeader, PageShell, PageTabs, ResourcePanel } from '@/components/ui/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatCourseSectionLabel, formatRoomLabel, getSectionColor, getSectionSurfaceStyle, getSectionTextStyle } from '@/lib/utils';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

interface SummaryTileProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    helper?: string;
    tone?: 'primary' | 'neutral' | 'success' | 'warning';
}

const SECTION_DETAIL_TABS = [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    { value: 'evaluations', label: 'Evaluations', icon: Trophy },
    { value: 'schedule', label: 'Schedule', icon: Calendar },
    { value: 'materials', label: 'Materials', icon: FileText },
] as const;

type SectionDetailTab = typeof SECTION_DETAIL_TABS[number]['value'];

function SummaryTile({ icon: Icon, label, value, helper, tone = 'neutral' }: SummaryTileProps) {
    const toneClass = {
        primary: 'border-primary/20 bg-primary/10 text-primary',
        neutral: 'border-border/70 bg-card text-foreground',
        success: 'border-success/20 bg-success/10 text-success',
        warning: 'border-warning/25 bg-warning/10 text-warning',
    }[tone];

    return (
        <div className={cn('min-w-0 overflow-hidden rounded-lg border p-3 shadow-sm', toneClass)}>
            <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
                    <p className="mt-1 truncate text-lg font-black leading-none">{value}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-current/15 bg-background/40">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            {helper && <p className="mt-2 truncate text-xs font-semibold opacity-70">{helper}</p>}
        </div>
    );
}

function ActionTile({ href, onClick, icon: Icon, title, description }: { href?: string; onClick?: () => void; icon: LucideIcon; title: string; description: string }) {
    const className = "group flex min-w-0 items-start gap-3 rounded-lg border border-border/70 bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25";
    const content = (
        <>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-foreground">{title}</p>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-muted-foreground">{description}</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </>
    );

    if (href) {
        return <Link href={href} className={className}>{content}</Link>;
    }

    return <button type="button" onClick={onClick} className={className}>{content}</button>;
}

function SectionPanel({
    id,
    icon: Icon,
    title,
    description,
    children,
}: {
    id: string;
    icon: LucideIcon;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <ResourcePanel id={id} className="scroll-mt-24 flex-none overflow-hidden">
            <header className="min-w-0 border-b border-border/60 bg-background/45 px-3 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-black leading-tight text-foreground">{title}</h2>
                            <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-muted-foreground">
                                {description}
                            </p>
                        </div>
                    </div>

                </div>
            </header>
            <div className="min-w-0 overflow-hidden p-3 sm:p-5">{children}</div>
        </ResourcePanel>
    );
}

function SectionDetailSkeleton() {
    return (
        <>
            <ResourcePanel className="flex-none overflow-hidden">
                <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] sm:p-5">
                    <div className="space-y-3">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-full max-w-2xl" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                        <Skeleton className="h-20 rounded-lg" />
                        <Skeleton className="h-20 rounded-lg" />
                    </div>
                </div>
            </ResourcePanel>

            <section className="grid min-w-0 shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-lg" />
                ))}
            </section>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-lg" />
                ))}
            </div>

            <div className="flex min-w-0 flex-col gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                    <ResourcePanel key={index} className="flex-none overflow-hidden">
                        <header className="border-b border-border/60 bg-background/45 px-3 py-4 sm:px-5">
                            <div className="flex items-start gap-3">
                                <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <Skeleton className="h-5 w-40" />
                                    <Skeleton className="h-4 w-full max-w-2xl" />
                                </div>
                            </div>
                        </header>
                        <div className="grid min-w-0 gap-3 p-3 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
                            <Skeleton className="h-40 rounded-lg" />
                            <Skeleton className="h-40 rounded-lg" />
                            <Skeleton className="h-40 rounded-lg" />
                        </div>
                    </ResourcePanel>
                ))}
            </div>
        </>
    );
}

export default function SectionDetailPage() {
    const { token, user } = useAuth();
    const params = useParams();
    const sectionId = params.id as string;
    const { getStringParam, updateQueryParams } = useUrlQueryState();
    const tabParam = getStringParam('tab', 'overview') as SectionDetailTab;
    const activeTab = SECTION_DETAIL_TABS.some((tab) => tab.value === tabParam) ? tabParam : 'overview';

    const sectionKey = token && sectionId ? ['section-detail', sectionId] as const : null;
    const { data: section, isLoading } = useSWR<Section>(sectionKey);

    if (isLoading) {
        return (
            <PageShell className="gap-0 overflow-x-hidden overflow-y-auto custom-scrollbar">
                <PageHeader
                    title="Section"
                    description="Loading section workspace, evaluations, schedule slots, materials, and class context."
                    icon={BookOpen}
                    breadcrumbs={[
                        { label: 'Organization' },
                        { label: 'Academics' },
                        { label: 'Sections', href: '/sections' },
                        { label: 'Section' },
                    ]}
                />
                <SectionDetailSkeleton />
            </PageShell>
        );
    }

    if (!section) return <NotFound page="Section" />;

    const isTeacherAssigned = section.teachers?.some((teacher) => teacher.userId === user?.id);
    const canEditSection = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const studentCount = section.studentsCount || section.students?.length || 0;
    const teacherCount = section.teachers?.length || 0;
    const courseName = section.course?.name || 'Course not assigned';
    const sectionLabel = formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name });
    const cycleName = section.academicCycle?.name || 'Academic cycle unavailable';
    const cohortName = section.cohort?.name || 'No cohort assigned';
    const roomLabel = section.defaultRoom ? formatRoomLabel(section.defaultRoom) : section.room || 'Room TBD';
    const sectionColor = getSectionColor(section.color);
    const handleTabChange = (tab: SectionDetailTab) => {
        updateQueryParams({ tab: tab === 'overview' ? undefined : tab });
    };

    return (
        <PageShell className="gap-1 overflow-x-hidden overflow-y-auto custom-scrollbar">
            <PageHeader
                title={<CourseSectionLabel section={section} />}
                description="A clearer control panel for class operations, grades, attendance, schedules, and materials."
                icon={BookOpen}
                actions={canEditSection ? (
                    <Link href={`/sections/edit/${section.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70">
                        <Pencil className="h-4 w-4" />
                        Edit Section
                    </Link>
                ) : undefined}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Sections', href: '/sections' },
                    { label: sectionLabel },
                ]}
                meta={(
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge variant="neutral" size="sm" icon={BookOpen} color={section.color}>
                            {courseName}
                        </Badge>
                        <Badge variant="neutral" size="sm">{section.id.substring(0, 8)}</Badge>
                    </div>
                )}
            />

            <PageTabs
                ariaLabel="Section workspace navigation"
                items={SECTION_DETAIL_TABS}
                activeValue={activeTab}
                onValueChange={handleTabChange}
                hideOnScroll
            />

            {activeTab === 'overview' && (
                <>
                    <ResourcePanel id="section-overview" className="flex-none overflow-hidden" style={getSectionSurfaceStyle(section, '08', '38')}>
                        <div className="grid min-w-0 gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] sm:p-5">
                            <div className="min-w-0">
                                <div className="flex min-w-0 items-start gap-4">
                                    <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-lg border text-primary sm:flex" style={{ borderColor: `${sectionColor}55`, backgroundColor: `${sectionColor}14`, color: sectionColor }}>
                                        <LayoutDashboard className="h-8 w-8" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Section Control Panel</p>
                                        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl" style={getSectionTextStyle(section)}>
                                            {sectionLabel}
                                        </h2>
                                        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
                                            {courseName} is placed in {cycleName}{section.cohort ? ` with ${cohortName}` : ''}. Use the shortcuts below for daily classroom work.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-background/65 p-3 shadow-sm">
                                <div className="flex min-w-0 items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-foreground">Teaching Team</p>
                                        <p className="text-xs font-semibold text-muted-foreground">{teacherCount} assigned</p>
                                    </div>
                                    <Users className="h-5 w-5 shrink-0 text-primary" />
                                </div>
                                <div className="mt-3 grid min-w-0 gap-2">
                                    {teacherCount === 0 ? (
                                        <p className="rounded-md border border-dashed border-border/70 bg-card p-3 text-xs font-semibold text-muted-foreground">
                                            No teachers assigned yet.
                                        </p>
                                    ) : (
                                        section.teachers?.slice(0, 3).map((teacher) => (
                                            <div key={teacher.id} className="min-w-0 rounded-md border border-border/70 bg-card px-3 py-2">
                                                <p className="truncate text-sm font-black text-foreground">{teacher.user?.name || 'Unnamed teacher'}</p>
                                                <p className="truncate text-xs font-semibold text-muted-foreground">{teacher.subject || teacher.designation || 'Faculty'}</p>
                                            </div>
                                        ))
                                    )}
                                    {teacherCount > 3 && (
                                        <p className="text-xs font-bold text-muted-foreground">+{teacherCount - 3} more assigned</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </ResourcePanel>

                    <section className="grid min-w-0 shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryTile icon={Users} label="Students" value={studentCount} helper="enrolled learners" tone="primary" />
                        <SummaryTile icon={School} label="Teachers" value={teacherCount} helper="assigned faculty" tone="success" />
                        <SummaryTile icon={GraduationCap} label="Cycle" value={cycleName} helper="academic placement" />
                        <SummaryTile icon={MapPin} label="Room" value={roomLabel} helper="primary venue" tone="neutral" />
                    </section>

                    <section className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-4" aria-label="Section quick actions">
                        <ActionTile onClick={() => handleTabChange('evaluations')} icon={ClipboardList} title="Evaluations" description="Create, review, and grade assessments for this section." />
                        <ActionTile href={`/attendance/${section.id}`} icon={CalendarCheck} title="Attendance" description="Open the attendance sheet for today and class sessions." />
                        <ActionTile href={`/grades/${section.id}`} icon={Trophy} title="Grades List" description="View all students, assessments, grades, and section totals." />
                        <ActionTile onClick={() => handleTabChange('materials')} icon={FileText} title="Materials" description="Manage files, links, videos, and class resources." />
                    </section>
                </>
            )}

            {activeTab === 'evaluations' && (
                <SectionPanel
                    id="evaluations"
                    icon={Trophy}
                    title="Evaluations"
                    description="Create, review, and grade assessments attached to this section."
                >
                    <AssessmentList section={section} role={user?.role as Role} />
                </SectionPanel>
            )}

            {activeTab === 'schedule' && (
                <SectionPanel
                    id="schedule"
                    icon={Calendar}
                    title="Schedule"
                    description="Maintain recurring class slots and room overrides students and teachers rely on."
                >
                    <SectionSchedules section={section} role={user?.role as Role} />
                </SectionPanel>
            )}

            {activeTab === 'materials' && (
                <SectionPanel
                    id="materials"
                    icon={FileText}
                    title="Materials"
                    description="Share files, links, and video resources for this section."
                >
                    <CourseMaterials sectionId={sectionId} role={user?.role as Role} isTeacherAssigned={isTeacherAssigned} />
                </SectionPanel>
            )}
        </PageShell>
    );
}
