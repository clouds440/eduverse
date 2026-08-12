'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Archive, Calendar, Layers, LibraryBig, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AcademicCycle, PaginatedResponse, PastRecordOptions, PastRecordSectionSummary, PastRecordStudentSummary, ProgramClassificationStatus } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { Label } from '@/components/ui/Label';
import { PageHeader, PageShell, PageTabs, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { SearchBar } from '@/components/ui/SearchBar';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

type SearchMode = 'sections' | 'students' | 'cycles';

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : '-';

function pluralize(count: number | undefined, label: string) {
    return `${count || 0} ${label}${count === 1 ? '' : 's'}`;
}

export default function PastRecordsPage() {
    const { token } = useAuth();
    const router = useRouter();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const mode = (getStringParam('mode', 'sections') as SearchMode);
    const page = getNumberParam('page', 1);
    const search = getStringParam('search');
    const cycleId = getStringParam('cycleId');
    const departmentId = getStringParam('departmentId');
    const programId = getStringParam('programId');
    const programOfferingId = getStringParam('programOfferingId');
    const programStageId = getStringParam('programStageId');
    const programStageOfferingId = getStringParam('programStageOfferingId');
    const cohortId = getStringParam('cohortId');
    const studentId = getStringParam('studentId');
    const classification = getStringParam('classification') as ProgramClassificationStatus | '';
    const [pageSize, setPageSize] = usePersistentPageSize('edu-past-records-limit', 20);
    const filters = { page, limit: pageSize, search: search || undefined, cycleId: cycleId || undefined, departmentId: departmentId || undefined, programId: programId || undefined, programOfferingId: programOfferingId || undefined, programStageId: programStageId || undefined, programStageOfferingId: programStageOfferingId || undefined, cohortId: cohortId || undefined, studentId: studentId || undefined, classification: classification || undefined };

    const { data: cycles } = useSWR<PaginatedResponse<AcademicCycle>>(
        token ? ['past-record-cycles-filter', token] as const : null,
        ([, authToken]) => api.pastRecords.cycles(authToken as string, { page: 1, limit: 100 }),
    );
    const { data: options } = useSWR<PastRecordOptions>(
        token ? ['past-record-options', cycleId, token] as const : null,
        ([, selectedCycle, authToken]) => api.pastRecords.options(authToken as string, { cycleId: selectedCycle ? String(selectedCycle) : undefined }),
    );
    const sectionsRequest = token && mode === 'sections' ? ['past-record-sections', filters, token] as const : null;
    const studentsRequest = token && mode === 'students' ? ['past-record-students', filters, token] as const : null;
    const cyclesRequest = token && mode === 'cycles' ? ['past-record-cycles', filters, token] as const : null;
    const { data: sections, error: sectionsError, isLoading: sectionsLoading, mutate: mutateSections } = useSWR<PaginatedResponse<PastRecordSectionSummary>>(sectionsRequest, ([, requestFilters, authToken]) => api.pastRecords.sections(authToken as string, requestFilters as typeof filters));
    const { data: students, error: studentsError, isLoading: studentsLoading, mutate: mutateStudents } = useSWR<PaginatedResponse<PastRecordStudentSummary>>(studentsRequest, ([, requestFilters, authToken]) => api.pastRecords.students(authToken as string, requestFilters as typeof filters));
    const { data: cycleResults, error: cyclesError, isLoading: cyclesLoading, mutate: mutateCycles } = useSWR<PaginatedResponse<AcademicCycle>>(cyclesRequest, ([, requestFilters, authToken]) => api.pastRecords.cycles(authToken as string, requestFilters as typeof filters));

    const sectionColumns = useMemo<Column<PastRecordSectionSummary>[]>(() => [
        { header: 'Section', accessor: (row) => <div><p className="font-black">{row.sectionLabel}</p><p className="text-xs text-muted-foreground">{row.courseLabel}</p></div> },
        { header: 'Cycle', accessor: (row) => <div><p className="font-bold">{row.cycle.code}</p><p className="text-xs text-muted-foreground">{row.cycle.name}</p></div> },
        { header: 'Program', accessor: (row) => row.programs.length ? row.programs.map((program) => program.programLabel).join(', ') : <Badge variant="neutral" size="sm">Standalone</Badge> },
        { header: 'Cohort', accessor: (row) => row.cohortLabel || 'Independent' },
        { header: 'Students', accessor: (row) => row.studentCount },
        { header: 'Archive', accessor: (row) => <div><p className="font-bold">Rev {row.archiveRevision}</p><p className="text-xs text-muted-foreground">Schema {row.schemaVersion}</p></div>, badge: true },
    ], []);
    const studentColumns = useMemo<Column<PastRecordStudentSummary>[]>(() => [
        { header: 'Student', accessor: (row) => row.studentName },
        { header: 'Registration', accessor: (row) => row.registrationNumber },
        { header: 'Roll Number', accessor: (row) => row.rollNumber },
        { header: 'Status', accessor: (row) => <Badge variant="neutral" size="sm">{row.studentStatus}</Badge> },
    ], []);
    const cycleColumns = useMemo<Column<AcademicCycle>[]>(() => [
        { header: 'Cycle', accessor: (row) => <div><p className="font-black">{row.name}</p><p className="text-xs text-muted-foreground">{row.code}</p></div> },
        { header: 'Start', accessor: (row) => new Date(row.startDate).toLocaleDateString() },
        { header: 'End', accessor: (row) => new Date(row.endDate).toLocaleDateString() },
        { header: 'Completed', accessor: (row) => formatDate(row.currentArchive?.completedAt) },
        { header: 'Contents', accessor: (row) => {
            const counts = row.currentArchive?.recordCounts;
            return counts ? `${pluralize(counts.sections, 'section')}, ${pluralize(counts.students || counts.enrollments, 'student')}` : '-';
        } },
        { header: 'Archive', accessor: (row) => row.currentArchive ? <div><p className="font-bold">Rev {row.currentArchive.revision}</p><p className="text-xs text-muted-foreground">Schema {row.currentArchive.schemaVersion}</p></div> : '-' },
        { header: 'Status', accessor: () => <Badge variant="success" size="sm">Archived</Badge> },
    ], []);

    const modeCounts = {
        sections: sections?.totalRecords,
        students: students?.totalRecords,
        cycles: cycleResults?.totalRecords,
    };
    const modeSummaries = {
        sections: mode === 'sections' ? `${pluralize(sections?.totalRecords, 'section')} found` : 'Browse archived classes and course records',
        students: mode === 'students' ? `${pluralize(students?.totalRecords, 'student')} found` : 'Find a learner across old cycles',
        cycles: mode === 'cycles' ? `${pluralize(cycleResults?.totalRecords, 'cycle')} found` : 'Start from a completed academic cycle',
    };

    const activeFilters: ActiveFilter[] = [
        ...(cycleId ? [{ key: 'cycle', label: 'Cycle', value: cycles?.data.find((cycle) => cycle.id === cycleId)?.code || 'Selected', onRemove: () => updateQueryParams({ cycleId: undefined, page: 1 }) }] : []),
        ...(departmentId ? [{ key: 'department', label: 'Department', value: options?.departments.find((item) => item.id === departmentId)?.label || 'Selected', onRemove: () => updateQueryParams({ departmentId: undefined, page: 1 }) }] : []),
        ...(programId ? [{ key: 'program', label: 'Program', value: options?.programs.find((item) => item.id === programId)?.label || 'Selected', onRemove: () => updateQueryParams({ programId: undefined, page: 1 }) }] : []),
        ...(programOfferingId ? [{ key: 'program-offering', label: 'Offering', value: options?.programOfferings.find((item) => item.id === programOfferingId)?.label || 'Selected', onRemove: () => updateQueryParams({ programOfferingId: undefined, page: 1 }) }] : []),
        ...(programStageId ? [{ key: 'stage', label: 'Stage', value: options?.stages.find((item) => item.id === programStageId)?.label || 'Selected', onRemove: () => updateQueryParams({ programStageId: undefined, programStageOfferingId: undefined, page: 1 }) }] : []),
        ...(programStageOfferingId ? [{ key: 'stage-offering', label: 'Stage Offering', value: options?.stageOfferings.find((item) => item.id === programStageOfferingId)?.label || 'Selected', onRemove: () => updateQueryParams({ programStageOfferingId: undefined, page: 1 }) }] : []),
        ...(cohortId ? [{ key: 'cohort', label: 'Cohort', value: options?.cohorts.find((item) => item.id === cohortId)?.label || 'Selected', onRemove: () => updateQueryParams({ cohortId: undefined, page: 1 }) }] : []),
        ...(studentId ? [{ key: 'student', label: 'Student', value: 'Selected student', onRemove: () => updateQueryParams({ studentId: undefined, page: 1 }) }] : []),
        ...(classification ? [{ key: 'classification', label: 'Delivery', value: classification === ProgramClassificationStatus.STANDALONE ? 'Standalone' : 'Program mapped', onRemove: () => updateQueryParams({ classification: undefined, page: 1 }) }] : []),
    ];

    const filterPanel = (
        <FilterDrawerGrid>
            <div><Label>Academic Cycle</Label><CustomSelect value={cycleId} onChange={(value) => updateQueryParams({ cycleId: value || undefined, page: 1 })} options={[{ value: '', label: 'All archived cycles' }, ...(cycles?.data || []).map((cycle) => ({ value: cycle.id, label: `${cycle.code} - ${cycle.name}` }))]} /></div>
            <div><Label>Department</Label><CustomSelect value={departmentId} onChange={(value) => updateQueryParams({ departmentId: value || undefined, programId: undefined, programOfferingId: undefined, programStageId: undefined, programStageOfferingId: undefined, page: 1 })} options={[{ value: '', label: 'All departments' }, ...(options?.departments || []).map((item) => ({ value: item.id, label: item.label }))]} /></div>
            <div><Label>Program</Label><CustomSelect value={programId} onChange={(value) => updateQueryParams({ programId: value || undefined, programOfferingId: undefined, programStageId: undefined, programStageOfferingId: undefined, classification: value ? ProgramClassificationStatus.PROGRAM_MAPPED : classification || undefined, page: 1 })} options={[{ value: '', label: 'All programs' }, ...(options?.programs || []).filter((item) => !departmentId || item.departmentLabel === options?.departments.find((department) => department.id === departmentId)?.label).map((item) => ({ value: item.id, label: item.label }))]} /></div>
            <div><Label>Program Offering</Label><CustomSelect value={programOfferingId} onChange={(value) => updateQueryParams({ programOfferingId: value || undefined, classification: value ? ProgramClassificationStatus.PROGRAM_MAPPED : classification || undefined, page: 1 })} options={[{ value: '', label: 'All offerings' }, ...(options?.programOfferings || []).map((item) => ({ value: item.id, label: item.label }))]} /></div>
            <div><Label>Program Stage</Label><CustomSelect value={programStageId} onChange={(value) => updateQueryParams({ programStageId: value || undefined, programStageOfferingId: undefined, classification: value ? ProgramClassificationStatus.PROGRAM_MAPPED : classification || undefined, page: 1 })} options={[{ value: '', label: 'All stages' }, ...(options?.stages || []).filter((item) => !programId || item.programId === programId).map((item) => ({ value: item.id, label: item.label }))]} /></div>
            <div><Label>Stage Offering</Label><CustomSelect value={programStageOfferingId} onChange={(value) => updateQueryParams({ programStageOfferingId: value || undefined, classification: value ? ProgramClassificationStatus.PROGRAM_MAPPED : classification || undefined, page: 1 })} options={[{ value: '', label: 'All stage offerings' }, ...(options?.stageOfferings || []).filter((item) => (!programId || item.programId === programId) && (!programStageId || item.programStageId === programStageId)).map((item) => ({ value: item.id, label: item.label }))]} /></div>
            <div><Label>Cohort</Label><CustomSelect value={cohortId} onChange={(value) => updateQueryParams({ cohortId: value || undefined, page: 1 })} options={[{ value: '', label: 'All cohorts / sections' }, ...(options?.cohorts || []).map((item) => ({ value: item.id, label: item.label }))]} /></div>
            <div><Label>Delivery Type</Label><CustomSelect value={classification} onChange={(value) => updateQueryParams({ classification: value || undefined, programId: value === ProgramClassificationStatus.STANDALONE ? undefined : programId || undefined, page: 1 })} options={[{ value: '', label: 'All delivery types' }, { value: ProgramClassificationStatus.STANDALONE, label: 'Standalone / No program' }, { value: ProgramClassificationStatus.PROGRAM_MAPPED, label: 'Program mapped' }]} /></div>
        </FilterDrawerGrid>
    );

    const error = sectionsError || studentsError || cyclesError;
    if (error) return <ErrorState error={error} onRetry={() => mode === 'sections' ? mutateSections() : mode === 'students' ? mutateStudents() : mutateCycles()} />;

    return (
        <PageShell>
            <PageHeader
                title="Past Records"
                description="Browse archived cycles by section, student, or academic-cycle snapshot."
                icon={Archive}
                breadcrumbs={[{ label: 'Academics' }, { label: 'Past Records' }]}
                actions={<PageControls activeFilters={activeFilters} leading={<SearchBar value={search} onChange={(value) => updateQueryParams({ search: value || undefined, page: 1 })} placeholder={`Search archived ${mode}...`} mobileMode="expandable" />} renderFilters={() => filterPanel} />}
            />
            <section className="grid shrink-0 gap-2 md:grid-cols-3" aria-label="Past record categories">
                {[
                    { value: 'sections' as const, label: 'Sections', icon: Layers, count: modeCounts.sections, summary: modeSummaries.sections },
                    { value: 'students' as const, label: 'Students', icon: Users, count: modeCounts.students, summary: modeSummaries.students },
                    { value: 'cycles' as const, label: 'Cycles', icon: LibraryBig, count: modeCounts.cycles, summary: modeSummaries.cycles },
                ].map((item) => {
                    const Icon = item.icon;
                    const active = mode === item.value;
                    return (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => updateQueryParams({ mode: item.value, page: 1, search: undefined, studentId: undefined })}
                            className={`flex min-h-24 items-start gap-3 rounded-lg border p-3 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${active ? 'border-primary/35 bg-primary/10' : 'border-border/70 bg-card hover:bg-primary/5'}`}
                            aria-pressed={active}
                        >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${active ? 'border-primary/25 bg-card text-primary' : 'border-border/60 bg-muted/45 text-muted-foreground'}`}>
                                <Icon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                    <span className="font-black text-foreground">{item.label}</span>
                                    {item.count !== undefined && <Badge variant={active ? 'primary' : 'neutral'} size="sm">{item.count}</Badge>}
                                </span>
                                <span className="mt-1 block text-xs font-semibold leading-5 text-muted-foreground">{item.summary}</span>
                            </span>
                        </button>
                    );
                })}
            </section>
            <PageTabs<SearchMode>
                activeValue={mode}
                onValueChange={(value) => updateQueryParams({ mode: value, page: 1, search: undefined, studentId: undefined })}
                ariaLabel="Past record search mode"
                items={[
                    { value: 'sections', label: 'Sections', icon: Layers },
                    { value: 'students', label: 'Students', icon: Users },
                    { value: 'cycles', label: 'Cycles', icon: Calendar },
                ]}
            />
            <ResourcePanel>
                {mode === 'sections' && <DataTable data={sections?.data || []} columns={sectionColumns} keyExtractor={(row) => row.id} isLoading={sectionsLoading} currentPage={page} totalPages={sections?.totalPages || 1} totalResults={sections?.totalRecords || 0} pageSize={pageSize} onPageChange={(value) => updateQueryParams({ page: value })} onPageSizeChange={setPageSize} onRowClick={(row) => router.push(`/past-records/sections/${row.id}`)} emptyTitle="No archived sections found" emptyDescription="Archive a completed cycle or adjust these filters." />}
                {mode === 'students' && <DataTable data={students?.data || []} columns={studentColumns} keyExtractor={(row) => row.sourceStudentId} isLoading={studentsLoading} currentPage={page} totalPages={students?.totalPages || 1} totalResults={students?.totalRecords || 0} pageSize={pageSize} onPageChange={(value) => updateQueryParams({ page: value })} onPageSizeChange={setPageSize} onRowClick={(row) => updateQueryParams({ mode: 'sections', studentId: row.sourceStudentId, search: undefined, page: 1 })} emptyTitle="No archived students found" />}
                {mode === 'cycles' && <DataTable data={cycleResults?.data || []} columns={cycleColumns} keyExtractor={(row) => row.id} isLoading={cyclesLoading} currentPage={page} totalPages={cycleResults?.totalPages || 1} totalResults={cycleResults?.totalRecords || 0} pageSize={pageSize} onPageChange={(value) => updateQueryParams({ page: value })} onPageSizeChange={setPageSize} onRowClick={(row) => updateQueryParams({ mode: 'sections', cycleId: row.id, search: undefined, page: 1 })} emptyTitle="No archived cycles found" />}
            </ResourcePanel>
        </PageShell>
    );
}
