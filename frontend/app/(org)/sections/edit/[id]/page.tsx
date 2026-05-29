'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { BookOpen, Calendar, Layers, MapPin, Network, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { AcademicCycle, Cohort, Course, PaginatedResponse, Role, Section, Student, UpdateSectionRequest } from '@/types';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import {
    FORM_INPUT_CLASS,
    FormActions,
    FormField,
    FormGrid,
    FormPageHeader,
    FormPageShell,
    FormSection,
} from '@/components/ui/FormLayout';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';

interface SectionEditFormData {
    name: string;
    room: string;
    courseId: string;
    academicCycleId: string;
    cohortId: string;
}

interface SectionEditErrors {
    name?: string;
    courseId?: string;
    academicCycleId?: string;
    general?: string;
}

function getStudentSectionIds(student: Student) {
    return student.enrollments
        ?.map((enrollment) => enrollment.section?.id)
        .filter((id): id is string => Boolean(id)) || [];
}

export default function EditSectionPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const sectionId = params.id;
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER;

    const returnTo = useMemo(() => {
        const requestedReturnTo = searchParams.get('returnTo');
        if (requestedReturnTo?.startsWith('/sections')) return requestedReturnTo;
        return `/sections/${sectionId}`;
    }, [searchParams, sectionId]);

    const [formData, setFormData] = useState<SectionEditFormData>({
        name: '',
        room: '',
        courseId: '',
        academicCycleId: '',
        cohortId: '',
    });
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [formErrors, setFormErrors] = useState<SectionEditErrors>({});
    const [hydratedSectionId, setHydratedSectionId] = useState('');

    const sectionKey = token && sectionId ? ['section-detail', sectionId] as const : null;
    const { data: section, error: sectionError, isLoading: isSectionLoading, mutate: mutateSection } = useSWR<Section>(sectionKey);

    const coursesKey = token && canManage ? ['courses', { limit: 1000 }] as const : null;
    const { data: coursesData } = useSWR<PaginatedResponse<Course>>(coursesKey);
    const courses = coursesData?.data || [];

    const cyclesKey = token && canManage ? ['academicCycles', { limit: 100 }] as const : null;
    const { data: cyclesData } = useSWR<{ data: AcademicCycle[] }>(cyclesKey);
    const cycles = cyclesData?.data || [];

    const cohortsKey = token && canManage ? ['cohorts', { limit: 1000 }] as const : null;
    const { data: cohortsData } = useSWR<{ data: Cohort[] }>(cohortsKey);
    const cohorts = cohortsData?.data || [];

    const studentsKey = token && canManage ? ['students', { limit: 1000 }] as const : null;
    const { data: studentsData, isLoading: isStudentsLoading } = useSWR<PaginatedResponse<Student>>(studentsKey);
    const students = studentsData?.data || [];

    useEffect(() => {
        if (!user) return;
        if (!canManage) router.replace(`/sections/${sectionId}`);
    }, [canManage, router, sectionId, user]);

    useEffect(() => {
        if (!section || hydratedSectionId === section.id) return;

        setFormData({
            name: section.name || '',
            room: section.room || '',
            courseId: section.courseId || '',
            academicCycleId: section.academicCycleId || '',
            cohortId: section.cohortId || '',
        });
        setSelectedStudentIds(section.students?.map((student) => student.id) || []);
        setHydratedSectionId(section.id);
    }, [hydratedSectionId, section]);

    const filteredCohorts = useMemo(() => (
        cohorts.filter((cohort) => !formData.academicCycleId || cohort.academicCycleId === formData.academicCycleId)
    ), [cohorts, formData.academicCycleId]);

    const validateForm = () => {
        const nextErrors: SectionEditErrors = {};
        if (!formData.name.trim()) nextErrors.name = 'Section name is required';
        if (!formData.courseId) nextErrors.courseId = 'Course is required';
        if (!formData.academicCycleId) nextErrors.academicCycleId = 'Academic cycle is required';
        setFormErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!token || !section || !canManage || !validateForm()) return;

        dispatch({ type: 'UI_START_PROCESSING', payload: 'section-edit' });
        setFormErrors({});

        try {
            const payload: UpdateSectionRequest = {
                name: formData.name.trim(),
                room: formData.room,
                courseId: formData.courseId,
                academicCycleId: formData.academicCycleId,
                cohortId: formData.cohortId,
            };

            await api.org.updateSection(section.id, payload, token);

            const currentlyEnrolledIds = section.students?.map((student) => student.id) || [];
            const newlyEnrolledIds = selectedStudentIds.filter((id) => !currentlyEnrolledIds.includes(id));
            const removedIds = currentlyEnrolledIds.filter((id) => !selectedStudentIds.includes(id));

            for (const studentId of newlyEnrolledIds) {
                const student = students.find((candidate) => candidate.id === studentId);
                if (!student) continue;

                const currentSectionIds = getStudentSectionIds(student);
                await api.org.updateStudent(studentId, { sectionIds: [...currentSectionIds, section.id] }, token);
            }

            for (const studentId of removedIds) {
                const student = students.find((candidate) => candidate.id === studentId);
                if (!student) continue;

                const currentSectionIds = getStudentSectionIds(student);
                await api.org.updateStudent(studentId, { sectionIds: currentSectionIds.filter((id) => id !== section.id) }, token);
            }

            dispatch({ type: 'TOAST_ADD', payload: { message: 'Section updated successfully', type: 'success' } });
            mutate(matchesCacheKeyPrefix('sections'));
            mutate(matchesCacheKeyPrefix('students'));
            mutateSection();
            router.push(returnTo);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error updating section';
            setFormErrors({ general: message });
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'section-edit' });
        }
    };

    if (sectionError) {
        return (
            <ErrorState
                error={sectionError}
                onRetry={() => mutateSection()}
                title="Unable to load section"
                description="The section record could not be fetched."
            />
        );
    }

    if (isSectionLoading || !section) {
        return <Loading className="h-full" text="Loading section..." size="lg" icon={Layers} />;
    }

    if (!canManage) return null;

    return (
        <FormPageShell>
            <FormPageHeader
                title={`Edit ${section.name}`}
                description="Update section placement and enrollment on a dedicated page instead of a cramped modal."
                icon={Layers}
            />

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <FormSection
                    title="Section Identity"
                    description="Keep the visible class name and location clear for faculty and students."
                    icon={MapPin}
                >
                    <FormGrid columns={2}>
                        <FormField label="Section Name" required error={formErrors.name}>
                            <Input
                                value={formData.name}
                                onChange={(event) => setFormData((previous) => ({ ...previous, name: event.target.value }))}
                                placeholder="e.g. Morning - A"
                                icon={Layers}
                                className={FORM_INPUT_CLASS}
                                error={!!formErrors.name}
                            />
                        </FormField>
                        <FormField label="Room / Location">
                            <Input
                                value={formData.room}
                                onChange={(event) => setFormData((previous) => ({ ...previous, room: event.target.value }))}
                                placeholder="e.g. Lab 102"
                                icon={MapPin}
                                className={FORM_INPUT_CLASS}
                            />
                        </FormField>
                    </FormGrid>
                </FormSection>

                <FormSection
                    title="Academic Placement"
                    description="Attach the section to its course, cycle, and optional cohort."
                    icon={BookOpen}
                >
                    <FormGrid columns={2}>
                        <FormField label="Course" required error={formErrors.courseId}>
                            <CustomSelect
                                value={formData.courseId}
                                onChange={(value) => setFormData((previous) => ({ ...previous, courseId: value }))}
                                options={courses.map((course) => ({ value: course.id, label: course.name, icon: BookOpen }))}
                                placeholder="Select course"
                                searchable
                                required
                                error={!!formErrors.courseId}
                            />
                        </FormField>
                        <FormField label="Academic Cycle" required error={formErrors.academicCycleId}>
                            <CustomSelect
                                value={formData.academicCycleId}
                                onChange={(value) => setFormData((previous) => ({ ...previous, academicCycleId: value, cohortId: '' }))}
                                options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name, icon: Calendar }))}
                                placeholder="Select academic cycle"
                                required
                                error={!!formErrors.academicCycleId}
                            />
                        </FormField>
                    </FormGrid>
                    <div className="mt-4">
                        <FormField label="Cohort" helper="Optional. Leave empty for individual enrollment.">
                            <CustomSelect
                                value={formData.cohortId}
                                onChange={(value) => setFormData((previous) => ({ ...previous, cohortId: value }))}
                                options={[
                                    { value: '', label: 'No Cohort', icon: Network },
                                    ...filteredCohorts.map((cohort) => ({ value: cohort.id, label: cohort.name, icon: Network })),
                                ]}
                                placeholder="Select cohort"
                            />
                        </FormField>
                    </div>
                </FormSection>

                <FormSection
                    title="Enrollment"
                    description="Add or remove students from this section using the same update flow as the previous modal."
                    icon={Users}
                >
                    <FormField
                        label="Enrolled Students"
                        helper={isStudentsLoading ? 'Loading students...' : 'Changes are saved when you submit the form.'}
                    >
                        <CustomMultiSelect
                            options={students.map((student) => ({
                                value: student.id,
                                label: `${student.user.name} (${student.registrationNumber || 'N/A'})`,
                            }))}
                            values={selectedStudentIds}
                            onChange={setSelectedStudentIds}
                            placeholder="Select students to enroll..."
                        />
                    </FormField>
                </FormSection>

                {formErrors.general && (
                    <ErrorState
                        error={formErrors.general}
                        title="Unable to update section"
                        description="Review the form and try again."
                        className="min-h-0"
                    />
                )}

                <FormActions
                    cancelText="Cancel"
                    submitText="Save Section"
                    loadingId="section-edit"
                    loadingText="Saving..."
                    title="Save section changes"
                    description="This updates the section record and reconciles enrollment changes."
                    onCancel={() => router.push(returnTo)}
                />
            </form>
        </FormPageShell>
    );
}
