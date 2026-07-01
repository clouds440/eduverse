'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AlertTriangle, Building2, CheckCircle2, FileText, GraduationCap, RefreshCw, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { fuzzySearchScore } from '@/lib/fuzzySearch';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import {
    AcademicCycle,
    BadgeVariant,
    Course,
    Department,
    GradeFinalizationFilters,
    GradeFinalizationRow,
    GradeFinalizationStatus,
    PaginatedResponse,
    Role,
    Section,
} from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { Input } from '@/components/ui/Input';
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { DismissiblePanel } from '@/components/ui/DismissiblePanel';
import { DocsLink } from '@/components/ui/DocsLink';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { formatDepartmentLabel } from '@/lib/utils';

const STATUS_OPTIONS: { value: GradeFinalizationStatus | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'All statuses' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'PUBLISHED', label: 'Published' },
    { value: 'READY_FOR_FINALIZATION', label: 'Ready' },
    { value: 'FINALIZED', label: 'Finalized' },
    { value: 'NEEDS_REVIEW', label: 'Needs Review' },
];

const statusLabels: Record<GradeFinalizationStatus, string> = {
    DRAFT: 'Draft',
    PUBLISHED: 'Published',
    READY_FOR_FINALIZATION: 'Ready',
    FINALIZED: 'Finalized',
    NEEDS_REVIEW: 'Needs Review',
};

function statusVariant(status: GradeFinalizationStatus): BadgeVariant {
    if (status === 'FINALIZED') return 'success';
    if (status === 'READY_FOR_FINALIZATION') return 'primary';
    if (status === 'NEEDS_REVIEW') return 'warning';
    if (status === 'PUBLISHED') return 'info';
    return 'neutral';
}

function getTeacherLabel(row: GradeFinalizationRow) {
    if (row.teachers.length === 0) return 'Unassigned';
    if (row.teachers.length === 1) return row.teachers[0].name;
    return `${row.teachers[0].name} +${row.teachers.length - 1}`;
}

export default function GradeFinalizationPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const [pageSize, setPageSize] = usePersistentPageSize('edu-grade-finalization-limit', 10);
    const [finalizingRow, setFinalizingRow] = useState<GradeFinalizationRow | null>(null);

    const page = getNumberParam('page', 1);
    const search = getStringParam('search', '');
    const academicCycleId = getStringParam('academicCycleId', '');
    const courseId = getStringParam('courseId', '');
    const departmentId = getStringParam('departmentId', '');
    const sectionId = getStringParam('sectionId', '');
    const teacherId = getStringParam('teacherId', '');
    const status = (getStringParam('status', 'ALL') as GradeFinalizationStatus | 'ALL');

    const canAccess = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN || user?.role === Role.ORG_MANAGER;
    const filters = useMemo<GradeFinalizationFilters>(() => ({
        academicCycleId: academicCycleId || undefined,
        courseId: courseId || undefined,
        departmentId: departmentId || undefined,
        sectionId: sectionId || undefined,
        status: status === 'ALL' ? undefined : status,
    }), [academicCycleId, courseId, departmentId, sectionId, status]);

    const dashboardKey = token && canAccess ? ['grade-finalization', filters] as const : null;
    const { data: rows = [], error, isLoading, mutate } = useSWR<GradeFinalizationRow[]>(
        dashboardKey,
        () => api.org.getGradeFinalization(token!, filters)
    );

    const { data: cyclesData } = useSWR<{ data: AcademicCycle[] }>(
        token && canAccess ? ['academicCycles', { limit: 100 }] as const : null
    );
    const { data: coursesData } = useSWR<PaginatedResponse<Course>>(
        token && canAccess ? ['courses', { limit: 1000 }] as const : null
    );
    const { data: departmentsData } = useSWR<PaginatedResponse<Department>>(
        token && canAccess ? ['departments', { limit: 1000, isActive: true }] as const : null
    );
    const { data: sectionsData } = useSWR<PaginatedResponse<Section>>(
        token && canAccess ? ['sections', { limit: 1000 }] as const : null
    );

    const teacherOptions = useMemo(() => {
        const teachers = new Map<string, string>();
        rows.forEach((row) => {
            row.teachers.forEach((teacher) => teachers.set(teacher.id, teacher.name));
        });
        return [
            { value: '', label: 'All teachers' },
            ...Array.from(teachers.entries()).map(([value, label]) => ({ value, label })),
        ];
    }, [rows]);

    const filteredRows = useMemo(() => {
        const term = search.trim();
        return rows.filter((row) => {
            const matchesTeacher = !teacherId || row.teachers.some((teacher) => teacher.id === teacherId);
            const matchesSearch = !term || fuzzySearchScore(term, [
                row.assessmentTitle,
                row.assessmentType,
                row.course.name,
                row.course.department?.name,
                row.course.department?.code,
                row.section.name,
                row.academicCycle?.name,
                row.academicCycle?.gpaPolicyName,
                getTeacherLabel(row),
            ]) > 0;

            return matchesTeacher && matchesSearch;
        });
    }, [rows, search, teacherId]);

    const paginatedRows = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredRows.slice(start, start + pageSize);
    }, [filteredRows, page, pageSize]);

    const statusCounts = useMemo(() => ({
        ready: rows.filter((row) => row.status === 'READY_FOR_FINALIZATION').length,
        finalized: rows.filter((row) => row.status === 'FINALIZED').length,
        review: rows.filter((row) => row.status === 'NEEDS_REVIEW').length,
    }), [rows]);

    const activeFilters: ActiveFilter[] = [
        ...(search ? [{ key: 'search', label: 'Search', value: search, onRemove: () => updateQueryParams({ search: undefined, page: 1 }) }] : []),
        ...(academicCycleId ? [{ key: 'academicCycleId', label: 'Cycle', value: cyclesData?.data?.find((cycle) => cycle.id === academicCycleId)?.name || 'Selected cycle', onRemove: () => updateQueryParams({ academicCycleId: undefined, page: 1 }) }] : []),
        ...(courseId ? [{ key: 'courseId', label: 'Course', value: coursesData?.data?.find((course) => course.id === courseId)?.name || 'Selected course', onRemove: () => updateQueryParams({ courseId: undefined, page: 1 }) }] : []),
        ...(departmentId ? [{ key: 'departmentId', label: 'Department', value: departmentsData?.data?.find((department) => department.id === departmentId)?.name || 'Selected department', onRemove: () => updateQueryParams({ departmentId: undefined, page: 1 }) }] : []),
        ...(sectionId ? [{ key: 'sectionId', label: 'Section', value: sectionsData?.data?.find((section) => section.id === sectionId)?.name || 'Selected section', onRemove: () => updateQueryParams({ sectionId: undefined, page: 1 }) }] : []),
        ...(teacherId ? [{ key: 'teacherId', label: 'Teacher', value: teacherOptions.find((teacher) => teacher.value === teacherId)?.label || 'Selected teacher', onRemove: () => updateQueryParams({ teacherId: undefined, page: 1 }) }] : []),
        ...(status !== 'ALL' ? [{ key: 'status', label: 'Status', value: statusLabels[status], onRemove: () => updateQueryParams({ status: undefined, page: 1 }) }] : []),
    ];
    const renderFilters = () => (
        <FilterDrawerGrid>
            <Input
                icon={Search}
                value={search}
                onChange={(event) => updateQueryParams({ search: event.target.value || undefined, page: 1 })}
                placeholder="Search assessment, course, section, teacher..."
            />
            <CustomSelect
                value={academicCycleId}
                onChange={(value) => updateQueryParams({ academicCycleId: value || undefined, page: 1 })}
                options={[{ value: '', label: 'All cycles' }, ...(cyclesData?.data?.map((cycle) => ({ value: cycle.id, label: cycle.name })) || [])]}
                searchable
            />
            <CustomSelect
                value={courseId}
                onChange={(value) => updateQueryParams({ courseId: value || undefined, page: 1 })}
                options={[{ value: '', label: 'All courses' }, ...(coursesData?.data?.map((course) => ({ value: course.id, label: course.name })) || [])]}
                searchable
            />
            <CustomSelect
                value={departmentId}
                onChange={(value) => updateQueryParams({ departmentId: value || undefined, page: 1 })}
                options={[
                    { value: '', label: 'All departments', icon: Building2 },
                    ...(departmentsData?.data?.map((department) => ({
                        value: department.id,
                        label: formatDepartmentLabel(department),
                    })) || []),
                ]}
                searchable
            />
            <CustomSelect
                value={sectionId}
                onChange={(value) => updateQueryParams({ sectionId: value || undefined, page: 1 })}
                options={[{ value: '', label: 'All sections' }, ...(sectionsData?.data?.map((section) => ({ value: section.id, label: section.name })) || [])]}
                searchable
            />
            <CustomSelect
                value={teacherId}
                onChange={(value) => updateQueryParams({ teacherId: value || undefined, page: 1 })}
                options={teacherOptions}
                searchable
            />
            <CustomSelect<GradeFinalizationStatus | 'ALL'>
                value={status}
                onChange={(value) => updateQueryParams({ status: value === 'ALL' ? undefined : value, page: 1 })}
                options={STATUS_OPTIONS}
            />
        </FilterDrawerGrid>
    );

    const finalizeAssessment = async () => {
        if (!token || !finalizingRow) return;
        const loadingId = `finalize-assessment-${finalizingRow.assessmentId}`;
        dispatch({ type: 'UI_START_PROCESSING', payload: loadingId });
        try {
            await api.org.finalizeGrades(finalizingRow.assessmentId, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Grades finalized successfully.', type: 'success' } });
            setFinalizingRow(null);
            mutate();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to finalize grades';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: loadingId });
        }
    };

    const columns = useMemo<Column<GradeFinalizationRow>[]>(() => [
        {
            header: 'Assessment',
            accessor: (row) => (
                <div className="min-w-0">
                    <p className="truncate font-black text-foreground">{row.assessmentTitle}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">{row.assessmentType} - {row.weightage}%</p>
                </div>
            ),
            width: 260,
        },
        {
            header: 'Course / Section',
            accessor: (row) => (
                <div className="min-w-0">
                    <p className="truncate font-bold text-foreground">{row.course.name}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">{row.section.name}</p>
                    {row.course.department && (
                        <Badge
                            variant="neutral"
                            size="sm"
                            className="mt-1"
                            title={formatDepartmentLabel(row.course.department)}
                            style={row.course.department.color ? { borderColor: `${row.course.department.color}55`, backgroundColor: `${row.course.department.color}18`, color: row.course.department.color } : undefined}
                        >
                            {row.course.department.code || row.course.department.name || 'Dept'}
                        </Badge>
                    )}
                </div>
            ),
            width: 240,
        },
        {
            header: 'Teacher',
            accessor: (row) => <span className="font-semibold text-foreground">{getTeacherLabel(row)}</span>,
            width: 180,
        },
        {
            header: 'Students',
            accessor: (row) => (
                <div className="grid gap-1 text-xs font-bold">
                    <span>{row.gradedStudents}/{row.totalStudents} graded</span>
                    <span className={row.missingGrades > 0 ? 'text-warning' : 'text-muted-foreground'}>{row.missingGrades} missing</span>
                </div>
            ),
            width: 140,
        },
        {
            header: 'Status',
            badge: true,
            accessor: (row) => <Badge variant={statusVariant(row.status)} size="sm">{statusLabels[row.status]}</Badge>,
            width: 140,
        },
        {
            header: 'GPA Policy',
            accessor: (row) => row.academicCycle?.gpaPolicyName || <span className="text-muted-foreground/50 italic">No policy</span>,
            width: 160,
        },
        {
            header: 'Audit',
            accessor: (row) => (
                <div className="min-w-0 space-y-1 text-xs font-semibold text-muted-foreground">
                    <p className="truncate">Updated: {row.lastUpdatedBy || 'No grade updates'}</p>
                    <p>{row.lastUpdatedAt ? new Date(row.lastUpdatedAt).toLocaleString() : '-'}</p>
                    {row.finalizedAt && (
                        <p className="truncate text-success">
                            Finalized: {row.finalizedBy || 'Unknown'} - {new Date(row.finalizedAt).toLocaleDateString()}
                        </p>
                    )}
                    {row.lastCorrectedAt && (
                        <p className="truncate text-warning" title={row.correctionReason || undefined}>
                            Corrected: {row.lastCorrectedBy || 'Unknown'} - {new Date(row.lastCorrectedAt).toLocaleDateString()}
                        </p>
                    )}
                </div>
            ),
            width: 230,
        },
        {
            header: 'Actions',
            accessor: (row) => (
                <div className="flex flex-wrap gap-2">
                    <Link href={`/sections/${row.section.id}/assessments/${row.assessmentId}`}>
                        <Button type="button" size="sm" variant="secondary" icon={FileText}>Audit</Button>
                    </Link>
                    <Button
                        type="button"
                        size="sm"
                        icon={CheckCircle2}
                        disabled={row.status !== 'READY_FOR_FINALIZATION'}
                        loadingId={`finalize-assessment-${row.assessmentId}`}
                        onClick={(event) => {
                            event.stopPropagation();
                            setFinalizingRow(row);
                        }}
                    >
                        Finalize
                    </Button>
                </div>
            ),
            width: 220,
        },
    ], []);

    if (!canAccess) {
        return (
            <PageShell>
                <EmptyState icon={GraduationCap} title="Access restricted" description="Grade finalization is available to Admins, Sub Admins, and Managers." />
            </PageShell>
        );
    }

    return (
        <PageShell>
            <PageHeader
                title="Grade Finalization"
                description={<>Review published grades and finalize official transcript-ready results. <DocsLink href="/docs/gradebook#grades-page">Read grade rules</DocsLink></>}
                icon={GraduationCap}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Grade Finalization' },
                ]}
                meta={<Badge variant="primary" size="sm">{statusCounts.ready} ready</Badge>}
                actions={(
                    <PageControls
                        drawerLabel="Grade filters"
                        renderFilters={renderFilters}
                        actions={(
                            <Button type="button" variant="secondary" icon={RefreshCw} onClick={() => mutate()}>
                                Refresh
                            </Button>
                        )}
                        activeFilters={activeFilters}
                    />
                )}
            />

            <DismissiblePanel title="Summary" defaultCollapsedOnMobile>
                <div className="grid gap-3 md:grid-cols-3">
                    <StatusBanner variant="info" title="Ready" description={`${statusCounts.ready} assessments can be finalized.`} icon={CheckCircle2} />
                    <StatusBanner variant="success" title="Finalized" description={`${statusCounts.finalized} assessments are transcript-ready.`} icon={GraduationCap} />
                    <StatusBanner variant="warning" title="Needs Review" description={`${statusCounts.review} assessments have missing or draft grades.`} icon={AlertTriangle} />
                </div>
            </DismissiblePanel>

            <ResourcePanel>
                <div className="relative min-h-0 flex-1 overflow-x-hidden">
                    {error ? (
                        <ErrorState error={error} onRetry={() => mutate()} />
                    ) : (
                        <DataTable
                            data={paginatedRows}
                            columns={columns}
                            keyExtractor={(row) => row.assessmentId}
                            isLoading={isLoading}
                            currentPage={page}
                            totalPages={Math.ceil(filteredRows.length / pageSize) || 1}
                            totalResults={filteredRows.length}
                            pageSize={pageSize}
                            onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
                            onPageSizeChange={(nextSize) => {
                                setPageSize(nextSize);
                                updateQueryParams({ page: 1 });
                            }}
                            maxHeight="100%"
                            showSerialNumber
                            emptyTitle="No grade batches found"
                            emptyDescription="Adjust the filters or wait for teachers to publish grades for review."
                            mobileDetailLimit={3}
                        />
                    )}
                </div>
            </ResourcePanel>

            <ConfirmDialog
                isOpen={!!finalizingRow}
                onClose={() => setFinalizingRow(null)}
                onConfirm={finalizeAssessment}
                title={<>Finalize <strong>{finalizingRow?.assessmentTitle}</strong></>}
                description="Finalized grades become official transcript inputs. Further corrections require elevated correction access."
                confirmText="Finalize Grades"
                loadingId={finalizingRow ? `finalize-assessment-${finalizingRow.assessmentId}` : undefined}
            />
        </PageShell>
    );
}
