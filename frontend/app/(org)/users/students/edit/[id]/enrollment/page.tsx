'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate as mutateGlobal } from 'swr';
import { ArrowLeft, BookOpen, GraduationCap, Layers, Network, Plus, Trash2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { Cohort, PaginatedResponse, Role, Section, Student } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { FormActions, FormField, FormGrid, FormPageHeader, FormPageShell, FormSection } from '@/components/ui/FormLayout';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';

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

    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    useEffect(() => {
        if (!loading && user && !canManage) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Only admins and sub-admins can manage enrollments.', type: 'error' } });
            router.replace('/users/students');
        }
    }, [canManage, dispatch, loading, router, user]);

    const studentKey = token && studentId ? ['student', studentId] as const : null;
    const { data: student, error: studentError, isLoading: studentLoading, mutate: mutateStudent } = useSWR<Student>(studentKey);
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

    const enrollments = student?.enrollments || [];
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
        mutateGlobal(matchesCacheKeyPrefix('students'));
        mutateGlobal(matchesCacheKeyPrefix('sections'));
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
