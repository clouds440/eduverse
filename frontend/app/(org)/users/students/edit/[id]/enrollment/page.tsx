'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate as mutateGlobal } from 'swr';
import { ArrowLeft, ArrowRightLeft, BookOpen, CheckCircle2, GraduationCap, Layers, Network, Pause, Play, Plus, Repeat2, SkipForward, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { Cohort, PaginatedResponse, Program, ProgramStatus, Role, Section, Student, StudentProgramCycleStatus, StudentProgramEnrollment, StudentProgramEnrollmentStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { FormActions, FormField, FormGrid, FormPageHeader, FormPageShell, FormSection } from '@/components/ui/FormLayout';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { Input } from '@/components/ui/Input';

const MIN_SEARCH_LENGTH = 2;

function sectionLabel(section?: Section | null) {
    if (!section) return 'Unknown section';
    return `${section.course?.code ? `${section.course.code} - ` : ''}${section.course?.name || 'Course'} / ${section.name}`;
}

function cohortLabel(cohort?: Cohort | null) {
    if (!cohort) return 'No cohort assigned';
    return `${cohort.code ? `${cohort.code} - ` : ''}${cohort.name}`;
}

export default function StudentEnrollmentPage() {
    const params = useParams<{ id: string }>();
    const studentId = params.id;
    const router = useRouter();
    const { token, user, loading } = useAuth();
    const { dispatch } = useGlobal();
    const [selectedCohortId, setSelectedCohortId] = useState('');
    const [selectedSectionId, setSelectedSectionId] = useState('');
    const [cohortSearch, setCohortSearch] = useState('');
    const [sectionSearch, setSectionSearch] = useState('');
    const [selectedCohortOption, setSelectedCohortOption] = useState<{ value: string; label: string; icon: typeof Network } | null>(null);
    const [selectedSectionOption, setSelectedSectionOption] = useState<{ value: string; label: string; icon: typeof Layers } | null>(null);
    const [saving, setSaving] = useState('');
    const [selectedProgramId, setSelectedProgramId] = useState('');
    const [programReason, setProgramReason] = useState('');

    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    useEffect(() => {
        if (!loading && user && !canManage) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Only admins and sub-admins can manage enrollments.', type: 'error' } });
            router.replace('/users/students');
        }
    }, [canManage, dispatch, loading, router, user]);

    const studentKey = token && studentId ? ['student', studentId] as const : null;
    const { data: student, error: studentError, isLoading: studentLoading, mutate: mutateStudent } = useSWR<Student>(studentKey);
    const { data: programHistory = [], mutate: mutateProgramHistory } = useSWR<StudentProgramEnrollment[]>(
        token && studentId ? ['student-program-enrollments', studentId, token] : null,
        () => api.studentPrograms.list(studentId, token!),
    );
    const { data: programsData } = useSWR<{ data: Program[] }>(
        token && canManage ? ['student-major-program-options', token] : null,
        () => api.programs.getPrograms(token!, { limit: 1000, status: ProgramStatus.ACTIVE }),
    );
    const normalizedCohortSearch = cohortSearch.trim();
    const normalizedSectionSearch = sectionSearch.trim();
    const { data: sectionsData, isLoading: sectionsLoading } = useSWR<PaginatedResponse<Section>>(
        token && canManage && normalizedSectionSearch.length >= MIN_SEARCH_LENGTH
            ? ['sections', { limit: 25, search: normalizedSectionSearch, activeAcademicCycleOnly: true }] as const
            : null,
    );
    const { data: cohortsData, isLoading: cohortsLoading } = useSWR<PaginatedResponse<Cohort>>(
        token && canManage && normalizedCohortSearch.length >= MIN_SEARCH_LENGTH
            ? ['cohorts', { limit: 25, search: normalizedCohortSearch }] as const
            : null,
    );

    useEffect(() => {
        if (!student) return;
        setSelectedCohortId(student.cohortId || '');
        setSelectedCohortOption(student.cohort ? { value: student.cohort.id, label: cohortLabel(student.cohort), icon: Network } : null);
    }, [student]);

    const enrollments = useMemo(() => student?.enrollments || [], [student?.enrollments]);
    const currentMajor = useMemo(() => programHistory.find((enrollment) => [
        StudentProgramEnrollmentStatus.ADMITTED,
        StudentProgramEnrollmentStatus.ACTIVE,
        StudentProgramEnrollmentStatus.ON_HOLD,
    ].includes(enrollment.status)) || student?.majorProgramEnrollment || null, [programHistory, student?.majorProgramEnrollment]);
    const programOptions = useMemo(() => [
        { value: '', label: currentMajor ? 'Choose a replacement program' : 'Choose a major program', icon: GraduationCap },
        ...((programsData?.data || [])
            .filter((program) => program.id !== currentMajor?.programId)
            .map((program) => ({ value: program.id, label: `${program.code} - ${program.name}`, icon: GraduationCap }))),
    ], [currentMajor, programsData?.data]);
    const currentSectionIds = useMemo(() => new Set(enrollments.map((enrollment) => enrollment.section?.id).filter(Boolean)), [enrollments]);
    const sectionOptions = useMemo(() => [
        { value: '', label: 'Choose section', icon: Layers },
        ...(selectedSectionOption && !sectionsData?.data?.some((section) => section.id === selectedSectionOption.value) ? [selectedSectionOption] : []),
        ...((sectionsData?.data || []).map((section) => ({
            value: section.id,
            label: sectionLabel(section),
            icon: Layers,
        }))),
    ], [sectionsData?.data, selectedSectionOption]);
    const cohortOptions = useMemo(() => [
        { value: '', label: 'No cohort', icon: Network },
        ...(selectedCohortOption && !cohortsData?.data?.some((cohort) => cohort.id === selectedCohortOption.value) ? [selectedCohortOption] : []),
        ...((cohortsData?.data || []).map((cohort) => ({
            value: cohort.id,
            label: cohortLabel(cohort),
            icon: Network,
        }))),
    ], [cohortsData?.data, selectedCohortOption]);

    const refresh = async () => {
        await mutateStudent();
        await mutateProgramHistory();
        mutateGlobal(matchesCacheKeyPrefix('students'));
        mutateGlobal(matchesCacheKeyPrefix('sections'));
    };

    const runProgramAction = async (action: string, callback: () => Promise<unknown>, successMessage: string) => {
        setSaving(action);
        try {
            await callback();
            setSelectedProgramId('');
            setProgramReason('');
            dispatch({ type: 'TOAST_ADD', payload: { message: successMessage, type: 'success' } });
            await refresh();
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Unable to update program enrollment', type: 'error' } });
        } finally {
            setSaving('');
        }
    };

    const assignOrTransferMajor = () => {
        if (!token || !selectedProgramId) return;
        if (currentMajor && !programReason.trim()) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'A transfer reason is required', type: 'error' } });
            return;
        }
        return runProgramAction(
            'major-save',
            () => currentMajor
                ? api.studentPrograms.transfer(studentId, { programId: selectedProgramId, reason: programReason.trim() }, token)
                : api.studentPrograms.admit(studentId, { programId: selectedProgramId }, token),
            currentMajor ? 'Major transferred with history preserved' : 'Major assigned',
        );
    };

    const showWarnings = (warnings?: { message: string }[]) => {
        warnings?.forEach((warning) => dispatch({ type: 'TOAST_ADD', payload: { message: warning.message, type: 'info' } }));
    };

    const addSection = async () => {
        if (!token || !selectedSectionId || !student) return;
        if (currentSectionIds.has(selectedSectionId)) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Student already enrolled in this section', type: 'error' } });
            return;
        }
        setSaving('section-add');
        try {
            const result = await api.org.enrollStudentInSection(student.id, selectedSectionId, token);
            showWarnings(result.warnings);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Section enrollment added', type: 'success' } });
            setSelectedSectionId('');
            setSelectedSectionOption(null);
            setSectionSearch('');
            await refresh();
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Unable to enroll student', type: 'error' } });
        } finally {
            setSaving('');
        }
    };

    const removeSection = async (sectionId: string) => {
        if (!token || !student) return;
        setSaving(`section-remove:${sectionId}`);
        try {
            const result = await api.org.withdrawStudentFromSection(student.id, sectionId, token);
            showWarnings(result.warnings);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Section enrollment removed', type: 'success' } });
            await refresh();
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Unable to remove enrollment', type: 'error' } });
        } finally {
            setSaving('');
        }
    };

    const applyCohort = async () => {
        if (!token || !student || selectedCohortId === (student.cohortId || '')) return;
        setSaving('cohort');
        try {
            if (student.cohortId) {
                await api.cohorts.removeStudent(student.cohortId, student.id, token);
            }
            if (selectedCohortId) {
                await api.cohorts.addStudents(selectedCohortId, [student.id], token);
            }
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Cohort placement updated', type: 'success' } });
            await refresh();
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Unable to update cohort placement', type: 'error' } });
        } finally {
            setSaving('');
        }
    };

    if (loading || studentLoading) return <Loading className="h-full" text="Loading enrollment..." size="lg" icon={GraduationCap} />;
    if (studentError) return <ErrorState error={studentError} onRetry={() => mutateStudent()} />;
    if (!student || !canManage) return null;

    return (
        <FormPageShell>
            <FormPageHeader
                title={`Manage Enrollment: ${student.user?.name || student.user?.email || 'Student'}`}
                description="Manage cohort placement and section enrollments outside the student profile editor."
                icon={GraduationCap}
            />

            <div className="space-y-5">
                <Link href={`/users/students/edit/${student.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                    <ArrowLeft className="h-4 w-4" />
                    Back to student details
                </Link>

                <FormSection title="Major and Program Progression" description="The current major survives academic-cycle changes. Transfers and withdrawals preserve prior history." icon={GraduationCap}>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="rounded-md border border-border/70 bg-muted/25 p-4">
                            <p className="text-xs font-bold uppercase text-muted-foreground">Current major</p>
                            <p className="mt-1 text-base font-black">{currentMajor ? `${currentMajor.program.code} - ${currentMajor.program.name}` : 'Standalone / no major'}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {currentMajor && <Badge variant={currentMajor.status === StudentProgramEnrollmentStatus.ON_HOLD ? 'warning' : 'success'} size="sm">{currentMajor.status.replaceAll('_', ' ')}</Badge>}
                                {currentMajor?.program.department && <Badge variant="secondary" size="sm">{currentMajor.program.department.name}</Badge>}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <FormField label={currentMajor ? 'Transfer to Program' : 'Assign Program'}>
                                <CustomSelect options={programOptions} value={selectedProgramId} onChange={setSelectedProgramId} searchable icon={GraduationCap} />
                            </FormField>
                            <FormField label="Reason" helper={currentMajor ? 'Required for transfer, hold, withdrawal, skip, repeat, and completion.' : 'Optional for first admission.'}>
                                <Input value={programReason} onChange={(event) => setProgramReason(event.target.value)} placeholder="Record the academic decision" />
                            </FormField>
                            <div className="flex flex-wrap justify-end gap-2">
                                <Button type="button" icon={currentMajor ? ArrowRightLeft : GraduationCap} onClick={assignOrTransferMajor} disabled={!selectedProgramId} isLoading={saving === 'major-save'} loadingText="Saving">
                                    {currentMajor ? 'Transfer Major' : 'Assign Major'}
                                </Button>
                                {currentMajor?.status === StudentProgramEnrollmentStatus.ACTIVE && (
                                    <Button type="button" variant="secondary" icon={Pause} disabled={!programReason.trim()} onClick={() => runProgramAction('major-hold', () => api.studentPrograms.hold(studentId, currentMajor.id, programReason.trim(), token!), 'Major put on hold')} isLoading={saving === 'major-hold'}>Hold</Button>
                                )}
                                {currentMajor?.status === StudentProgramEnrollmentStatus.ON_HOLD && (
                                    <Button type="button" variant="secondary" icon={Play} onClick={() => runProgramAction('major-resume', () => api.studentPrograms.resume(studentId, currentMajor.id, token!), 'Major resumed')} isLoading={saving === 'major-resume'}>Resume</Button>
                                )}
                                {currentMajor && (
                                    <Button type="button" variant="danger" icon={Trash2} disabled={!programReason.trim()} onClick={() => runProgramAction('major-withdraw', () => api.studentPrograms.withdraw(studentId, currentMajor.id, { reason: programReason.trim(), retainPrimaryDepartment: true }, token!), 'Major withdrawn with history preserved')} isLoading={saving === 'major-withdraw'}>Remove Major</Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {currentMajor && (
                        <div className="mt-5 divide-y divide-border/60 rounded-md border border-border/70">
                            {currentMajor.cycles.map((cycle) => (
                                <div key={cycle.id} className="grid gap-3 p-3 lg:grid-cols-[3rem_minmax(0,1fr)_auto] lg:items-center">
                                    <span className="text-sm font-black tabular-nums">{cycle.sequenceSnapshot}</span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black">{cycle.cycleCodeSnapshot} - {cycle.cycleNameSnapshot}</p>
                                        <p className="text-xs font-semibold text-muted-foreground">{cycle.stageCodeSnapshot} - {cycle.stageNameSnapshot}</p>
                                        <Badge className="mt-2" variant={cycle.status === StudentProgramCycleStatus.COMPLETED ? 'success' : cycle.status === StudentProgramCycleStatus.IN_PROGRESS ? 'info' : 'secondary'} size="sm">{cycle.status.replaceAll('_', ' ')}</Badge>
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        {cycle.status === StudentProgramCycleStatus.PLANNED && (
                                            <Button type="button" size="sm" icon={Play} onClick={() => runProgramAction(`cycle-activate:${cycle.id}`, () => api.studentPrograms.activateCycle(studentId, currentMajor.id, { studentProgramEnrollmentCycleId: cycle.id, cohortId: selectedCohortId || undefined, reason: programReason || undefined }, token!), 'Program cycle activated')} isLoading={saving === `cycle-activate:${cycle.id}`}>Activate</Button>
                                        )}
                                        {cycle.status === StudentProgramCycleStatus.IN_PROGRESS && (
                                            <Button type="button" size="sm" icon={CheckCircle2} disabled={!programReason.trim()} onClick={() => runProgramAction(`cycle-complete:${cycle.id}`, () => api.studentPrograms.completeCycle(studentId, currentMajor.id, cycle.id, { reason: programReason.trim() }, token!), 'Program cycle completed')} isLoading={saving === `cycle-complete:${cycle.id}`}>Complete</Button>
                                        )}
                                        {(cycle.status === StudentProgramCycleStatus.PLANNED || cycle.status === StudentProgramCycleStatus.FAILED) && (
                                            <Button type="button" size="sm" variant="secondary" icon={SkipForward} disabled={!programReason.trim()} onClick={() => runProgramAction(`cycle-skip:${cycle.id}`, () => api.studentPrograms.skipCycle(studentId, currentMajor.id, cycle.id, { reason: programReason.trim() }, token!), 'Program cycle skipped')} isLoading={saving === `cycle-skip:${cycle.id}`}>Skip</Button>
                                        )}
                                        {(cycle.status === StudentProgramCycleStatus.FAILED || cycle.status === StudentProgramCycleStatus.COMPLETED) && (
                                            <Button type="button" size="sm" variant="secondary" icon={Repeat2} disabled={!programReason.trim()} onClick={() => runProgramAction(`cycle-repeat:${cycle.id}`, () => api.studentPrograms.repeatCycle(studentId, currentMajor.id, cycle.id, { reason: programReason.trim(), cohortId: selectedCohortId || undefined }, token!), 'Repeat attempt started')} isLoading={saving === `cycle-repeat:${cycle.id}`}>Repeat</Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-end p-3">
                                <Button type="button" icon={CheckCircle2} disabled={!programReason.trim()} onClick={() => runProgramAction('program-complete', () => api.studentPrograms.complete(studentId, currentMajor.id, { reason: programReason.trim() }, token!), 'Program completed')} isLoading={saving === 'program-complete'}>Complete Program</Button>
                            </div>
                        </div>
                    )}

                    {programHistory.length > 1 && (
                        <div className="mt-5">
                            <p className="mb-2 text-sm font-black">Previous program history</p>
                            <div className="flex flex-wrap gap-2">
                                {programHistory.filter((entry) => entry.id !== currentMajor?.id).map((entry) => (
                                    <Badge key={entry.id} variant="secondary">{entry.program.code} - {entry.status.replaceAll('_', ' ')}</Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </FormSection>

                <FormSection title="Cohort Placement" description="Changing cohort placement updates cohort-sourced section enrollments." icon={Network}>
                    <FormGrid columns={2}>
                        <FormField label="Current Cohort">
                            <div className="flex min-h-11 items-center rounded-md border border-border bg-muted/35 px-3.5 py-2.5 text-sm font-semibold">
                                {cohortLabel(student.cohort)}
                            </div>
                        </FormField>
                        <FormField label="Change Cohort">
                            <CustomSelect
                                options={cohortOptions}
                                value={selectedCohortId}
                                onChange={(value) => {
                                    setSelectedCohortId(value);
                                    setSelectedCohortOption(value ? cohortOptions.find((option) => option.value === value) || null : null);
                                }}
                                searchable
                                searchValue={cohortSearch}
                                onSearchChange={setCohortSearch}
                                searchPlaceholder="Type at least 2 characters..."
                                isSearching={cohortsLoading}
                                emptyMessage={normalizedCohortSearch.length < MIN_SEARCH_LENGTH ? 'Type at least 2 characters to search current-cycle cohorts.' : 'No current-cycle cohorts found.'}
                                clearable
                                clearLabel="Clear cohort selection"
                            />
                        </FormField>
                    </FormGrid>
                    <div className="mt-4 flex justify-end">
                        <Button type="button" icon={Network} onClick={applyCohort} disabled={selectedCohortId === (student.cohortId || '')} isLoading={saving === 'cohort'} loadingText="Saving">
                            Apply Cohort
                        </Button>
                    </div>
                </FormSection>

                <FormSection title="Section Enrollments" description="Capacity and schedule conflicts warn but do not block enrollment." icon={BookOpen}>
                    <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                        <FormField label="Add Section">
                            <CustomSelect
                                options={sectionOptions}
                                value={selectedSectionId}
                                onChange={(value) => {
                                    setSelectedSectionId(value);
                                    setSelectedSectionOption(value ? sectionOptions.find((option) => option.value === value) || null : null);
                                }}
                                searchable
                                searchValue={sectionSearch}
                                onSearchChange={setSectionSearch}
                                searchPlaceholder="Type at least 2 characters..."
                                isSearching={sectionsLoading}
                                emptyMessage={normalizedSectionSearch.length < MIN_SEARCH_LENGTH ? 'Type at least 2 characters to search current-cycle sections.' : 'No current-cycle sections found.'}
                                clearable
                                clearLabel="Clear section selection"
                            />
                        </FormField>
                        <Button type="button" icon={Plus} onClick={addSection} disabled={!selectedSectionId} isLoading={saving === 'section-add'} loadingText="Adding">
                            Enroll
                        </Button>
                    </div>

                    <div className="grid gap-3">
                        {enrollments.length === 0 ? (
                            <Card padding="sm" hoverable={false}>
                                <p className="text-sm font-semibold text-muted-foreground">No active section enrollments.</p>
                            </Card>
                        ) : enrollments.map((enrollment) => {
                            const enrollmentSectionId = enrollment.section?.id || enrollment.sectionId || '';
                            return (
                                <Card key={enrollmentSectionId || enrollment.id} padding="sm" hoverable={false}>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            {enrollment.section ? (
                                                <CourseSectionLabel section={enrollment.section} />
                                            ) : (
                                                <p className="text-sm font-black">Unknown section</p>
                                            )}
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Badge variant={enrollment.source === 'COHORT' ? 'info' : 'primary'} size="sm">{enrollment.source || 'MANUAL'}</Badge>
                                                {enrollment.isExcludedFromCohort && <Badge variant="warning" size="sm">Excluded</Badge>}
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="danger"
                                            size="sm"
                                            icon={Trash2}
                                            onClick={() => enrollmentSectionId && removeSection(enrollmentSectionId)}
                                            disabled={!enrollmentSectionId}
                                            isLoading={saving === `section-remove:${enrollmentSectionId}`}
                                            loadingText="Removing"
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </FormSection>

                <FormActions
                    cancelText="Done"
                    showSubmit={false}
                    title="Enrollment changes"
                    description="Enrollment changes are saved immediately."
                    onCancel={() => router.push(`/users/students/edit/${student.id}`)}
                />
            </div>
        </FormPageShell>
    );
}
