'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { AlertTriangle, BookOpen, Calendar, Layers, MapPin, Network, Trash2, UserRound, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { AcademicCycle, Cohort, Course, PaginatedResponse, Role, Room, Section, Student, Teacher, UpdateSectionRequest } from '@/types';
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
import { DEFAULT_SECTION_COLOR, formatRoomLabel, getSectionColor, isSectionPaletteColor } from '@/lib/utils';
import { ColorSelector } from '@/components/ui/ColorSelector';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';

interface SectionEditFormData {
    name: string;
    code: string;
    room: string;
    defaultRoomId: string;
    courseId: string;
    academicCycleId: string;
    cohortId: string;
    color: string;
}

interface SectionEditErrors {
    name?: string;
    code?: string;
    courseId?: string;
    academicCycleId?: string;
    teacherIds?: string;
    color?: string;
    general?: string;
}

export default function EditSectionPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const sectionId = params.id;
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    const returnTo = useMemo(() => {
        const requestedReturnTo = searchParams.get('returnTo');
        if (requestedReturnTo?.startsWith('/sections')) return requestedReturnTo;
        return `/sections/${sectionId}`;
    }, [searchParams, sectionId]);

    const [formData, setFormData] = useState<SectionEditFormData>({
        name: '',
        code: '',
        room: '',
        defaultRoomId: '',
        courseId: '',
        academicCycleId: '',
        cohortId: '',
        color: DEFAULT_SECTION_COLOR,
    });
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
    const [teacherResolutionAction, setTeacherResolutionAction] = useState<'MOVE' | 'DELETE' | ''>('');
    const [teacherResolutionTeacherId, setTeacherResolutionTeacherId] = useState('');
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
    const cohorts = useMemo(() => cohortsData?.data || [], [cohortsData?.data]);

    const studentsKey = token && canManage ? ['students', { limit: 1000 }] as const : null;
    const { data: studentsData, isLoading: isStudentsLoading } = useSWR<PaginatedResponse<Student>>(studentsKey);
    const students = studentsData?.data || [];

    const teachersKey = token && canManage ? ['teachers', { limit: 1000 }] as const : null;
    const { data: teachersData, isLoading: isTeachersLoading } = useSWR<PaginatedResponse<Teacher>>(teachersKey);
    const teachers = useMemo(() => teachersData?.data || [], [teachersData?.data]);

    const roomsKey = token && canManage ? ['rooms', { limit: 1000, isActive: true }] as const : null;
    const { data: roomsData } = useSWR<PaginatedResponse<Room>>(roomsKey);

    useEffect(() => {
        if (!user) return;
        if (!canManage) router.replace(`/sections/${sectionId}`);
    }, [canManage, router, sectionId, user]);

    useEffect(() => {
        if (!section || hydratedSectionId === section.id) return;

        setFormData({
            name: section.name || '',
            code: section.code || '',
            room: section.room || '',
            defaultRoomId: section.defaultRoomId || '',
            courseId: section.courseId || '',
            academicCycleId: section.academicCycleId || '',
            cohortId: section.cohortId || '',
            color: getSectionColor(section.color),
        });
        setSelectedStudentIds(section.students?.map((student) => student.id) || []);
        setSelectedTeacherIds(section.teachers?.map((teacher) => teacher.id) || []);
        setTeacherResolutionAction('');
        setTeacherResolutionTeacherId('');
        setHydratedSectionId(section.id);
    }, [hydratedSectionId, section]);

    const filteredCohorts = useMemo(() => (
        cohorts.filter((cohort) => !formData.academicCycleId || cohort.academicCycleId === formData.academicCycleId)
    ), [cohorts, formData.academicCycleId]);

    const removedTeacherIds = useMemo(() => (
        (section?.teachers || [])
            .map((teacher) => teacher.id)
            .filter((teacherId) => !selectedTeacherIds.includes(teacherId))
    ), [section?.teachers, selectedTeacherIds]);

    const affectedSchedules = useMemo(() => (
        (section?.schedules || []).filter((schedule) => removedTeacherIds.includes(schedule.teacherId))
    ), [removedTeacherIds, section?.schedules]);

    const teacherOptions = useMemo(() => teachers.map((teacher) => ({
        value: teacher.id,
        label: teacher.user?.name || teacher.user?.email || 'Unnamed teacher',
    })), [teachers]);

    const selectedTeacherOptions = useMemo(() => (
        teacherOptions.filter((option) => selectedTeacherIds.includes(option.value))
    ), [selectedTeacherIds, teacherOptions]);

    useEffect(() => {
        if (teacherResolutionTeacherId && !selectedTeacherIds.includes(teacherResolutionTeacherId)) {
            setTeacherResolutionTeacherId('');
        }
        if (affectedSchedules.length === 0) {
            setTeacherResolutionAction('');
            setTeacherResolutionTeacherId('');
        }
    }, [affectedSchedules.length, selectedTeacherIds, teacherResolutionTeacherId]);

    const validateForm = () => {
        const nextErrors: SectionEditErrors = {};
        if (!formData.name.trim()) nextErrors.name = 'Section name is required';
        if (!formData.code.trim()) nextErrors.code = 'Section code is required';
        if (!formData.courseId) nextErrors.courseId = 'Course is required';
        if (!formData.academicCycleId) nextErrors.academicCycleId = 'Academic cycle is required';
        if (!isSectionPaletteColor(formData.color)) nextErrors.color = 'Choose one of the preset section colors';
        if (affectedSchedules.length > 0 && !teacherResolutionAction) {
            nextErrors.teacherIds = 'Choose how to handle schedules owned by removed teachers';
        }
        if (affectedSchedules.length > 0 && teacherResolutionAction === 'MOVE' && !teacherResolutionTeacherId) {
            nextErrors.teacherIds = 'Choose a remaining teacher to receive affected schedules';
        }
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
                code: formData.code,
                defaultRoomId: formData.defaultRoomId || null,
                courseId: formData.courseId,
                academicCycleId: formData.academicCycleId,
                cohortId: formData.cohortId,
                color: formData.color,
                teacherIds: selectedTeacherIds,
                ...(affectedSchedules.length > 0 ? {
                    scheduleTeacherResolution: teacherResolutionAction === 'DELETE'
                        ? { action: 'DELETE' }
                        : { action: 'MOVE', teacherId: teacherResolutionTeacherId },
                } : {}),
            };

            await api.org.updateSection(section.id, payload, token);

            const currentlyEnrolledIds = section.students?.map((student) => student.id) || [];
            const newlyEnrolledIds = selectedStudentIds.filter((id) => !currentlyEnrolledIds.includes(id));
            const removedIds = currentlyEnrolledIds.filter((id) => !selectedStudentIds.includes(id));

            if (newlyEnrolledIds.length > 0) {
                const result = await api.org.bulkEnrollStudentsInSection(section.id, newlyEnrolledIds, token);
                result.results?.flatMap((item) => item.warnings || []).forEach((warning) => {
                    dispatch({ type: 'TOAST_ADD', payload: { message: warning.message, type: 'info' } });
                });
            }

            for (const studentId of removedIds) {
                const result = await api.org.withdrawStudentFromSection(studentId, section.id, token);
                result.warnings?.forEach((warning) => {
                    dispatch({ type: 'TOAST_ADD', payload: { message: warning.message, type: 'info' } });
                });
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
                title={<>Edit <CourseSectionLabel section={section} /></>}
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
                        <FormField label="Section Code" required error={formErrors.code}>
                            <Input
                                value={formData.code}
                                onChange={(event) => setFormData((previous) => ({ ...previous, code: event.target.value }))}
                                placeholder="e.g. GRADE-9-A"
                                icon={Layers}
                                className={FORM_INPUT_CLASS}
                                error={!!formErrors.code}
                            />
                        </FormField>
                        <FormField label="Default Room">
                            <CustomSelect
                                value={formData.defaultRoomId}
                                onChange={(value) => setFormData((previous) => ({ ...previous, defaultRoomId: value }))}
                                options={[
                                    { value: '', label: 'No Default Room', icon: MapPin },
                                    ...(roomsData?.data?.map((room) => ({
                                        value: room.id,
                                        label: formatRoomLabel(room),
                                        icon: MapPin,
                                    })) || []),
                                ]}
                                placeholder={formData.room ? `Legacy: ${formData.room}` : 'Select room'}
                                searchable
                            />
                        </FormField>
                        <FormField label="Section Color" error={formErrors.color}>
                            <ColorSelector
                                value={formData.color}
                                onChange={(color) => setFormData((previous) => ({ ...previous, color }))}
                                ariaLabelPrefix="section color"
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
                                options={courses.map((course) => ({ value: course.id, label: course.code ? `${course.code} - ${course.name}` : course.name, icon: BookOpen }))}
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
                                options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.code ? `${cycle.code} - ${cycle.name}` : cycle.name, icon: Calendar }))}
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
                                    ...filteredCohorts.map((cohort) => ({ value: cohort.id, label: cohort.code ? `${cohort.code} - ${cohort.name}` : cohort.name, icon: Network })),
                                ]}
                                placeholder="Select cohort"
                            />
                        </FormField>
                    </div>
                </FormSection>

                <FormSection
                    title="Teachers"
                    description="Assign the teachers who can own schedules for this section."
                    icon={UserRound}
                >
                    <FormField
                        label="Assigned Teachers"
                        helper={isTeachersLoading ? 'Loading teachers...' : 'Schedules choose exactly one teacher from this list.'}
                        error={formErrors.teacherIds}
                    >
                        <CustomMultiSelect
                            options={teacherOptions}
                            values={selectedTeacherIds}
                            onChange={setSelectedTeacherIds}
                            placeholder="Select teachers..."
                            error={!!formErrors.teacherIds}
                        />
                    </FormField>

                    {affectedSchedules.length > 0 && (
                        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-4">
                            <div className="flex min-w-0 items-start gap-3">
                                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                                <div className="min-w-0 flex-1 space-y-3">
                                    <div>
                                        <p className="text-sm font-black text-foreground">Removed teachers own existing schedules</p>
                                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                            Resolve {affectedSchedules.length} affected schedule{affectedSchedules.length === 1 ? '' : 's'} before saving.
                                        </p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <FormField label="Resolution">
                                            <CustomSelect
                                                value={teacherResolutionAction}
                                                onChange={(value) => setTeacherResolutionAction(value as 'MOVE' | 'DELETE' | '')}
                                                options={[
                                                    { value: '', label: 'Choose resolution' },
                                                    { value: 'MOVE', label: 'Move schedules to another teacher', icon: UserRound },
                                                    { value: 'DELETE', label: 'Delete affected schedules', icon: Trash2 },
                                                ]}
                                            />
                                        </FormField>
                                        {teacherResolutionAction === 'MOVE' && (
                                            <FormField label="Move To">
                                                <CustomSelect
                                                    value={teacherResolutionTeacherId}
                                                    onChange={setTeacherResolutionTeacherId}
                                                    options={selectedTeacherOptions}
                                                    placeholder="Choose remaining teacher"
                                                    searchable
                                                />
                                            </FormField>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
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





