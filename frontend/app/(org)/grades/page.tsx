'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AlertTriangle, BookOpen, CheckCircle2, ChevronRight, Edit3, GraduationCap, Layers, RefreshCw, Users } from 'lucide-react';
import { Assessment, BadgeVariant, Grade, GradeStatus, Role, Section, UnfinalizedGradeReviewRow } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { SearchBar } from '@/components/ui/SearchBar';
import { DocsLink } from '@/components/ui/DocsLink';
import { fuzzyFilterAndRank, fuzzySearchScore } from '@/lib/fuzzySearch';
import { getSectionColor, getSectionSurfaceStyle, getSectionTintStyle } from '@/lib/utils';
import { BrandIcon } from '@/components/ui/Brand';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import GradingForm from '@/components/forms/GradingForm';

function SectionCardSkeleton() {
    return (
        <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-5 w-2/3 rounded-md" />
                        <Skeleton className="h-3 w-1/2 rounded-md" />
                    </div>
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Skeleton className="h-16 rounded-md" />
                <Skeleton className="h-16 rounded-md" />
            </div>
        </div>
    );
}

function SectionGradeCard({ section }: { section: Section }) {
    const sectionColor = getSectionColor(section);
    const sectionPanelStyle = getSectionSurfaceStyle(section, '0C', '38');
    const sectionBadgeStyle = getSectionTintStyle(section);

    return (
        <article
            className="group overflow-hidden rounded-lg border shadow-sm transition-transform hover:-translate-y-px"
            style={getSectionSurfaceStyle(section, '10', '55')}
        >
            <div className="flex min-w-0 items-start justify-between gap-3 border-b p-4" style={{ borderColor: `${sectionColor}38`, backgroundColor: `${sectionColor}08` }}>
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border" style={sectionBadgeStyle}>
                        <GraduationCap className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <CourseSectionLabel section={section} as="h2" className="truncate text-base font-black md:text-lg" />
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge variant="neutral" size="sm" color={section.color}>{section.course?.name || 'Generic Course'}</Badge>
                            {section.cohort?.name && <Badge variant="neutral" size="sm" color={section.color}>{section.cohort.name}</Badge>}
                            {section.academicCycle?.name && <Badge variant="neutral" size="sm" color={section.color}>{section.academicCycle.name}</Badge>}
                        </div>
                    </div>
                </div>
                <Link
                    href={`/grades/${section.id}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-transform group-hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    style={sectionBadgeStyle}
                    aria-label={`Open grades for ${section.name}`}
                >
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
            </div>

            <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
                <div className="rounded-md border p-3" style={sectionPanelStyle}>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide" style={{ color: sectionColor }}>
                        <Layers className="h-4 w-4" aria-hidden="true" />
                        Section Grades
                    </div>
                    <p className="mt-2 text-sm font-semibold" style={{ color: sectionColor }}>All students and assessment marks</p>
                </div>
                <div className="rounded-md border p-3" style={sectionPanelStyle}>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide" style={{ color: sectionColor }}>
                        <Users className="h-4 w-4" aria-hidden="true" />
                        Section Context
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold" style={{ color: sectionColor }}>
                        {section.cohort ? `${section.cohort.name} cohort` : 'No cohort assigned'}
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-2 border-t p-3 sm:flex-row sm:p-4" style={{ borderColor: `${sectionColor}2E` }}>
                <Link
                    href={`/grades/${section.id}`}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-black shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    style={sectionBadgeStyle}
                >
                    <GraduationCap className="h-4 w-4" aria-hidden="true" />
                    Open Grades List
                </Link>
                <Link
                    href={`/sections/${section.id}`}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-black text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    Open Control Panel
                </Link>
            </div>
        </article>
    );
}
type UnfinalizedStatusFilter = 'ALL' | GradeStatus.DRAFT | GradeStatus.PUBLISHED;

const UNFINALIZED_STATUS_OPTIONS: { value: UnfinalizedStatusFilter; label: string }[] = [
    { value: 'ALL', label: 'Draft and Published' },
    { value: GradeStatus.DRAFT, label: 'Draft only' },
    { value: GradeStatus.PUBLISHED, label: 'Published only' },
];

function getGradeStatusVariant(status: GradeStatus): BadgeVariant {
    if (status === GradeStatus.DRAFT) return 'warning';
    if (status === GradeStatus.PUBLISHED) return 'info';
    if (status === GradeStatus.FINALIZED) return 'success';
    return 'neutral';
}

function buildUnfinalizedGradeRows(assessments: Assessment[], gradeLists: Grade[][]): UnfinalizedGradeReviewRow[] {
    return assessments.flatMap((assessment, index) => {
        const grades = gradeLists[index] || [];
        return grades
            .filter((grade) => grade.status !== GradeStatus.FINALIZED && grade.student)
            .map((grade) => ({
                id: `${assessment.id}:${grade.studentId}`,
                assessmentId: assessment.id,
                assessmentTitle: assessment.title,
                assessmentType: assessment.type,
                totalMarks: assessment.totalMarks,
                weightage: assessment.weightage,
                sectionId: assessment.sectionId,
                sectionName: assessment.section?.name || 'Unknown Section',
                sectionColor: assessment.section?.color,
                courseName: assessment.section?.course?.name || 'Generic Course',
                grade,
                student: grade.student!,
            }));
    });
}

function UnfinalizedGradesPanel({ token, canReview }: { token: string | null; canReview: boolean }) {
    const { dispatch } = useGlobal();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<UnfinalizedStatusFilter>('ALL');
    const [sectionFilter, setSectionFilter] = useState('');
    const [editingRow, setEditingRow] = useState<UnfinalizedGradeReviewRow | null>(null);

    const reviewKey = token && canReview ? ['unfinalized-grade-review', token] as const : null;
    const { data: reviewRows = [], isLoading, error, mutate } = useSWR<UnfinalizedGradeReviewRow[]>(reviewKey, async () => {
        const assessments = await api.org.getAssessments(token!);
        const gradeLists = await Promise.all(assessments.map((assessment) => api.org.getGrades(assessment.id, token!)));
        return buildUnfinalizedGradeRows(assessments, gradeLists);
    });

    const sectionOptions = useMemo(() => {
        const byId = new Map<string, string>();
        reviewRows.forEach((row) => {
            byId.set(row.sectionId, `${row.courseName} - ${row.sectionName}`);
        });
        return [
            { value: '', label: 'All sections' },
            ...Array.from(byId.entries()).map(([value, label]) => ({ value, label })),
        ];
    }, [reviewRows]);

    const filteredRows = useMemo(() => {
        const term = searchTerm.trim();
        return reviewRows.filter((row) => {
            const matchesStatus = statusFilter === 'ALL' || row.grade.status === statusFilter;
            const matchesSection = !sectionFilter || row.sectionId === sectionFilter;
            const matchesSearch = !term || fuzzySearchScore(term, [
                row.student.user?.name,
                row.student.user?.email,
                row.student.registrationNumber,
                row.student.rollNumber,
                row.assessmentTitle,
                row.assessmentType,
                row.courseName,
                row.sectionName,
            ]) > 0;

            return matchesStatus && matchesSection && matchesSearch;
        });
    }, [reviewRows, searchTerm, sectionFilter, statusFilter]);

    const finalizeGrade = useCallback(async (row: UnfinalizedGradeReviewRow) => {
        if (!token) return;
        const loadingId = `finalize-grade-${row.id}`;
        dispatch({ type: 'UI_START_PROCESSING', payload: loadingId });
        try {
            await api.org.updateGrade(row.assessmentId, row.student.id, {
                marksObtained: row.grade.marksObtained,
                feedback: row.grade.feedback,
                status: GradeStatus.FINALIZED,
            }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: `Finalized ${row.student.user.name}'s grade.`, type: 'success' } });
            mutate();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to finalize grade';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: loadingId });
        }
    }, [dispatch, mutate, token]);

    if (!canReview) {
        return (
            <EmptyState
                icon={GraduationCap}
                title="Review workspace unavailable"
                description="Only academic staff can review unfinalized grades."
                className="min-h-72"
            />
        );
    }

    return (
        <ResourcePanel className="overflow-y-auto">
            <div className="shrink-0 space-y-3 border-b border-border/60 bg-card/80 p-3 sm:p-4">
                <StatusBanner
                    variant="warning"
                    icon={AlertTriangle}
                    title="Unfinalized grades stay out of transcripts"
                    description={<>Review Draft and Published grades before transcripts use them. <DocsLink href="/docs/gradebook#grades-page">Read gradebook rules</DocsLink></>}
                    dismissible={true}
                />
                <PageControls
                    drawerLabel="Grade review filters"
                    leading={<SearchBar placeholder="Search student, assessment, course, or section..." value={searchTerm} onChange={setSearchTerm} mobileMode="expandable" />}
                    actions={(
                        <Button type="button" variant="secondary" icon={RefreshCw} onClick={() => mutate()}>
                            Refresh
                        </Button>
                    )}
                    renderFilters={() => (
                        <FilterDrawerGrid>
                            <CustomSelect<UnfinalizedStatusFilter>
                                value={statusFilter}
                                onChange={setStatusFilter}
                                options={UNFINALIZED_STATUS_OPTIONS}
                            />
                            <CustomSelect
                                value={sectionFilter}
                                onChange={setSectionFilter}
                                options={sectionOptions}
                                searchable
                            />
                        </FilterDrawerGrid>
                    )}
                />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                {error ? (
                    <ErrorState error={error} onRetry={() => mutate()} />
                ) : (
                    <DataTable
                        data={filteredRows}
                        columns={[
                            {
                                header: 'Student',
                                accessor: (row) => (
                                    <div className="flex min-w-0 items-center gap-3">
                                        <BrandIcon variant="user" size="sm" user={row.student.user} className="h-8 w-8 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="truncate font-bold text-foreground">{row.student.user.name}</p>
                                            <p className="truncate text-xs text-muted-foreground">{row.student.registrationNumber || row.student.rollNumber || 'No registration'}</p>
                                        </div>
                                    </div>
                                ),
                                width: 250,
                            },
                            {
                                header: 'Course Section',
                                accessor: (row) => (
                                    <div className="min-w-0">
                                        <p className="truncate font-bold text-foreground">{row.courseName}</p>
                                        <p className="truncate text-xs text-muted-foreground">{row.sectionName}</p>
                                    </div>
                                ),
                                width: 220,
                            },
                            {
                                header: 'Assessment',
                                accessor: (row) => (
                                    <div className="min-w-0">
                                        <p className="truncate font-bold text-foreground">{row.assessmentTitle}</p>
                                        <p className="truncate text-xs text-muted-foreground">{row.assessmentType}</p>
                                    </div>
                                ),
                                width: 240,
                            },
                            {
                                header: 'Status',
                                accessor: (row) => (
                                    <Badge variant={getGradeStatusVariant(row.grade.status)} size="sm">
                                        {row.grade.status === GradeStatus.DRAFT ? 'Draft' : 'Published'}
                                    </Badge>
                                ),
                                badge: true,
                                width: 120,
                            },
                            {
                                header: 'Marks',
                                accessor: (row) => (
                                    <span className="font-black text-primary">{row.grade.marksObtained}<span className="text-xs text-muted-foreground"> / {row.totalMarks}</span></span>
                                ),
                                width: 120,
                            },
                            {
                                header: 'Weight',
                                accessor: (row) => `${row.weightage}%`,
                                width: 100,
                            },
                            {
                                header: 'Actions',
                                accessor: (row) => (
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            icon={Edit3}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setEditingRow(row);
                                            }}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            icon={CheckCircle2}
                                            loadingId={`finalize-grade-${row.id}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                finalizeGrade(row);
                                            }}
                                        >
                                            Finalize
                                        </Button>
                                    </div>
                                ),
                                width: 220,
                            },
                        ]}
                        keyExtractor={(row) => row.id}
                        currentPage={1}
                        totalPages={1}
                        totalResults={filteredRows.length}
                        pageSize={Math.max(filteredRows.length, 10)}
                        onPageChange={() => { }}
                        showSerialNumber
                        isLoading={isLoading}
                        emptyTitle="No unfinalized grades"
                        emptyDescription={reviewRows.length === 0 ? 'All entered grades are finalized, or no grades have been entered yet.' : 'No grades match the current filters.'}
                    />
                )}
            </div>

            <Modal
                isOpen={!!editingRow}
                onClose={() => setEditingRow(null)}
                title="Review Grade"
                subtitle={editingRow ? `${editingRow.student.user.name} - ${editingRow.assessmentTitle}` : ''}
                maxWidth="max-w-xl"
            >
                {editingRow && (
                    <GradingForm
                        assessmentId={editingRow.assessmentId}
                        student={editingRow.student}
                        totalMarks={editingRow.totalMarks}
                        initialData={editingRow.grade}
                        onSuccess={() => {
                            mutate();
                            setEditingRow(null);
                        }}
                        onCancel={() => setEditingRow(null)}
                    />
                )}
            </Modal>
        </ResourcePanel>
    );
}

export default function GradesPage() {
    const { token, user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const canReviewUnfinalized = false;

    const sectionsKey = token && user
        ? ['sections-for-grades', { my: user.role === Role.TEACHER }] as const
        : null;
    const { data: sectionsData, isLoading } = useSWR<{ data: Section[] }>(sectionsKey);
    const sections = useMemo(() => sectionsData?.data || [], [sectionsData?.data]);

    const filteredSections = useMemo(() => {
        return fuzzyFilterAndRank(sections, searchTerm, (section) => [
            section.name,
            section.code,
            section.course?.name,
            section.course?.code,
        ]);
    }, [searchTerm, sections]);

    const headerActions = (
        <PageControls
            showDrawer={false}
            renderFilters={() => null}
            leading={<SearchBar placeholder="Search sections or courses..." value={searchTerm} onChange={setSearchTerm} mobileMode="expandable" />}
            actions={(
                <div className="flex min-h-10 items-center gap-2 rounded-md border border-border/70 bg-background/70 px-3 text-xs font-black text-muted-foreground">
                    <GraduationCap className="h-4 w-4" />
                    <span>Total Sections: {sections.length}</span>
                </div>
            )}
        />
    );

    return (
        <PageShell>
            <PageHeader
                title="Grades"
                description={<>Choose a section to review every student grade or open its control panel. <DocsLink href="/docs/gradebook#grades-page">Read grade docs</DocsLink></>}
                icon={GraduationCap}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Grades' },
                ]}
                meta={<Badge variant="neutral" size="sm">{sections.length} sections</Badge>}
                actions={headerActions}
            />

            {canReviewUnfinalized ? (
                <UnfinalizedGradesPanel token={token} canReview={Boolean(canReviewUnfinalized)} />
            ) : isLoading ? (
                <>
                    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/80 p-3 shadow-sm sm:flex-row sm:items-center sm:p-4">
                        <Skeleton className="h-10 w-full max-w-md rounded-md" />
                        <div className="hidden items-center gap-2 sm:flex">
                            <Skeleton className="h-4 w-4 rounded-full" />
                            <Skeleton className="h-3 w-24 rounded-md" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {[...Array(6)].map((_, index) => (
                            <SectionCardSkeleton key={index} />
                        ))}
                    </div>
                </>
            ) : (
                <ResourcePanel className="overflow-y-auto">
                    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                        {filteredSections.length === 0 ? (
                            <EmptyState
                                icon={BookOpen}
                                title="No sections found"
                                description={searchTerm ? 'Try a different section or course search.' : 'Sections will appear here when they are available for grading.'}
                                className="min-h-72"
                            />
                        ) : (
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                {filteredSections.map((section) => (
                                    <SectionGradeCard key={section.id} section={section} />
                                ))}
                            </div>
                        )}
                    </div>
                </ResourcePanel>
            )}
        </PageShell>
    );
}
