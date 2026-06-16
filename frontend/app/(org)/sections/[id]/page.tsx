'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
    BookOpen,
    Calendar,
    FileText,
    GraduationCap,
    Layers,
    MapPin,
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
import { Loading } from '@/components/ui/Loading';
import { NotFound } from '@/components/NotFound';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { formatCourseSectionLabel, formatRoomLabel, getSectionSurfaceStyle, getSectionTextStyle, getSectionTintStyle } from '@/lib/utils';

interface SummaryTileProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    helper?: string;
}

function SummaryTile({ icon: Icon, label, value, helper }: SummaryTileProps) {
    return (
        <div className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-card p-3 shadow-sm">
            <div className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                {label}
            </div>
            <p className="mt-2 truncate text-sm font-black text-foreground">{value}</p>
            {helper && <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">{helper}</p>}
        </div>
    );
}

function SectionPanel({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <ResourcePanel className="flex-none overflow-hidden">
            <header className="min-w-0 border-b border-border/60 bg-background/45 px-3 py-4 sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-black leading-tight text-foreground">{title}</h2>
                        <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-muted-foreground">
                            {description}
                        </p>
                    </div>
                </div>
            </header>
            <div className="min-w-0 overflow-hidden p-3 sm:p-5">{children}</div>
        </ResourcePanel>
    );
}

export default function SectionDetailPage() {
    const { token, user } = useAuth();
    const params = useParams();
    const sectionId = params.id as string;

    const sectionKey = token && sectionId ? ['section-detail', sectionId] as const : null;
    const { data: section, isLoading } = useSWR<Section>(sectionKey);

    if (isLoading) {
        return <Loading className="h-full" text="Loading section..." size="lg" icon={BookOpen} />;
    }

    if (!section) return <NotFound page="Section" />;

    const isTeacherAssigned = section.teachers?.some((teacher) => teacher.userId === user?.id);
    const studentCount = section.studentsCount || section.students?.length || 0;
    const teacherCount = section.teachers?.length || 0;
    const courseName = section.course?.name || 'Course not assigned';
    const sectionLabel = formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name });
    const cycleName = section.academicCycle?.name || 'Academic cycle unavailable';
    const cohortName = section.cohort?.name || 'No cohort assigned';
    const roomLabel = section.defaultRoom ? formatRoomLabel(section.defaultRoom) : section.room || 'Room TBD';

    return (
        <PageShell className="overflow-x-hidden overflow-y-auto custom-scrollbar">
            <PageHeader
                title={<CourseSectionLabel section={section} />}
                description="A section workspace for evaluations, schedule slots, materials, and class context."
                icon={BookOpen}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Sections', href: '/sections' },
                    { label: sectionLabel },
                ]}
                meta={(
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge
                            variant="neutral"
                            size="sm"
                            icon={BookOpen}
                            style={getSectionTintStyle(section)}
                        >
                            {courseName}
                        </Badge>
                        <Badge variant="neutral" size="sm">{section.id.substring(0, 8)}</Badge>
                    </div>
                )}
            />

            <section className="grid min-w-0 shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryTile icon={Users} label="Students" value={studentCount} helper="enrolled" />
                <SummaryTile icon={School} label="Teachers" value={teacherCount} helper="assigned" />
                <SummaryTile icon={GraduationCap} label="Cycle" value={cycleName} helper="academic placement" />
                <SummaryTile icon={MapPin} label="Room" value={roomLabel} helper="primary venue" />
            </section>

            <ResourcePanel className="flex-none shrink-0 overflow-hidden" style={getSectionSurfaceStyle(section, '08', '38')}>
                <div className="grid min-w-0 gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,340px)] sm:p-5">
                    <div className="min-w-0">
                        <h2 className="mt-3 text-lg font-black tracking-tight sm:text-xl" style={getSectionTextStyle(section)}>
                            Section Profile
                        </h2>
                        <p className="mt-2 max-w-3xl wrap-break-word text-sm font-semibold leading-6 text-muted-foreground">
                            {sectionLabel} belongs to {cycleName}{section.cohort ? ` in ${cohortName}` : ''}.
                        </p>
                    </div>

                    <div className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-background/60 p-3">
                        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-black text-foreground">Teaching Team</p>
                                <p className="text-xs font-semibold text-muted-foreground">{teacherCount} assigned</p>
                            </div>
                            <Users className="h-5 w-5 shrink-0 text-primary" />
                        </div>
                        <div className="grid min-w-0 gap-2">
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

            <div className="flex min-w-0 flex-col gap-4">
                <SectionPanel
                    icon={Trophy}
                    title="Evaluations"
                    description="Create, review, and grade assessments attached to this section."
                >
                    <AssessmentList section={section} role={user?.role as Role} />
                </SectionPanel>

                <SectionPanel
                    icon={Calendar}
                    title="Schedule"
                    description="Maintain the recurring class slots and room overrides students and teachers rely on."
                >
                    <SectionSchedules section={section} role={user?.role as Role} />
                </SectionPanel>

                <SectionPanel
                    icon={FileText}
                    title="Materials"
                    description="Share files, links, and video resources for this section."
                >
                    <CourseMaterials sectionId={sectionId} role={user?.role as Role} isTeacherAssigned={isTeacherAssigned} />
                </SectionPanel>
            </div>
        </PageShell>
    );
}
