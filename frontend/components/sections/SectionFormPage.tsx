'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { AlertTriangle, BookOpen, CalendarRange, Hash, Layers, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { DEFAULT_SECTION_COLOR, formatRoomLabel } from '@/lib/utils';
import { AcademicCycle, Cohort, Course, CourseResultComponentType, PaginatedResponse, ProgramDeliveryOption, Role, Room, Section, Student, Teacher } from '@/types';
import { Button } from '@/components/ui/Button';
import { ColorSelector } from '@/components/ui/ColorSelector';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Loading } from '@/components/ui/Loading';
import { PageHeader } from '@/components/ui/PageShell';

export function SectionFormPage({ sectionId }: { sectionId?: string }) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isEdit = Boolean(sectionId);
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const { data: section, error: loadError, isLoading } = useSWR<Section>(token && sectionId ? ['section-detail', sectionId] : null, () => api.org.getSection(sectionId!, token!));
    const [form, setForm] = useState({ name: '', code: '', courseId: '', academicCycleId: '', componentType: 'OTHER' as CourseResultComponentType, defaultRoomId: '', color: DEFAULT_SECTION_COLOR, programStageOfferingId: '', requirementIds: [] as string[], cohortOfferingId: '', teacherIds: [] as string[], studentIds: [] as string[] });
    const [hydrated, setHydrated] = useState('');
    const [error, setError] = useState('');
    const [scheduleResolution, setScheduleResolution] = useState<'MOVE' | 'DELETE' | ''>('');
    const [scheduleTeacherId, setScheduleTeacherId] = useState('');
    const { data: courses } = useSWR<PaginatedResponse<Course>>(token && canManage ? ['courses', { limit: 1000 }] : null);
    const { data: cycles } = useSWR<PaginatedResponse<AcademicCycle>>(token && canManage ? ['academicCycles', { limit: 100 }] : null);
    const { data: cohorts } = useSWR<PaginatedResponse<Cohort>>(token && canManage ? ['cohorts', { limit: 1000 }] : null);
    const { data: teachers } = useSWR<PaginatedResponse<Teacher>>(token && canManage ? ['teachers', { limit: 1000 }] : null);
    const { data: students } = useSWR<PaginatedResponse<Student>>(token && canManage && isEdit ? ['students', { limit: 1000 }] : null);
    const { data: rooms } = useSWR<PaginatedResponse<Room>>(token && canManage ? ['rooms', { limit: 1000, isActive: true }] : null);
    const { data: deliveryOptions = [] } = useSWR<ProgramDeliveryOption[]>(token && form.academicCycleId ? ['program-delivery-options', form.academicCycleId] : null, () => api.programs.getDeliveryOptions(token!, form.academicCycleId));
    const selectedDelivery = deliveryOptions.find((option) => option.id === form.programStageOfferingId);
    const requirements = (selectedDelivery?.programStage.courseRequirements || []).filter((item) => item.courseId === form.courseId);
    const cohortOfferings = useMemo(() => (cohorts?.data || []).flatMap((cohort) => (cohort.offerings || []).filter((offering) => offering.academicCycleId === form.academicCycleId).map((offering) => ({ offering, cohort }))), [cohorts?.data, form.academicCycleId]);
    const removedTeacherIds = useMemo(() => (section?.teachers || []).map((teacher) => teacher.id).filter((id) => !form.teacherIds.includes(id)), [form.teacherIds, section?.teachers]);
    const affectedSchedules = useMemo(() => (section?.schedules || []).filter((schedule) => removedTeacherIds.includes(schedule.teacherId)), [removedTeacherIds, section?.schedules]);
    const remainingTeacherOptions = useMemo(() => (teachers?.data || []).filter((teacher) => form.teacherIds.includes(teacher.id)).map((teacher) => ({ value: teacher.id, label: teacher.user?.name || teacher.user?.email || 'Teacher' })), [form.teacherIds, teachers?.data]);

    useEffect(() => { if (user && !canManage) router.replace(sectionId ? `/sections/${sectionId}` : '/sections'); }, [canManage, router, sectionId, user]);
    useEffect(() => {
        if (!section || hydrated === section.id) return;
        const mapping = section.programMappings?.[0];
        setForm({ name: section.name, code: section.code, courseId: section.courseId || '', academicCycleId: section.academicCycleId || '', componentType: section.componentType || 'OTHER', defaultRoomId: section.defaultRoomId || '', color: section.color || DEFAULT_SECTION_COLOR, programStageOfferingId: mapping?.programStageOfferingId || '', requirementIds: section.programMappings?.map((item) => item.stageCourseRequirementId) || [], cohortOfferingId: section.cohortOfferingSections?.[0]?.cohortOffering?.id || '', teacherIds: section.teachers?.map((item) => item.id) || [], studentIds: section.students?.map((item) => item.id) || [] });
        setHydrated(section.id);
    }, [hydrated, section]);
    useEffect(() => {
        if (!affectedSchedules.length) { setScheduleResolution(''); setScheduleTeacherId(''); }
        else if (scheduleTeacherId && !form.teacherIds.includes(scheduleTeacherId)) setScheduleTeacherId('');
    }, [affectedSchedules.length, form.teacherIds, scheduleTeacherId]);

    const changeCycle = (academicCycleId: string) => setForm((current) => ({ ...current, academicCycleId, programStageOfferingId: '', requirementIds: [], cohortOfferingId: '' }));
    const changeCourse = (courseId: string) => setForm((current) => ({ ...current, courseId, requirementIds: [] }));
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;
        if (!form.name.trim() || !form.code.trim() || !form.courseId || !form.academicCycleId) { setError('Name, code, course, and academic cycle are required.'); return; }
        if (form.programStageOfferingId && !form.requirementIds.length) { setError('Select at least one matching course requirement for the program stage.'); return; }
        if (affectedSchedules.length && (!scheduleResolution || (scheduleResolution === 'MOVE' && !scheduleTeacherId))) { setError('Resolve schedules assigned to removed teachers before saving.'); return; }
        const processingId = isEdit ? 'section-edit' : 'section-create';
        dispatch({ type: 'UI_START_PROCESSING', payload: processingId });
        setError('');
        try {
            const payload = { name: form.name, code: form.code, courseId: form.courseId, academicCycleId: form.academicCycleId, componentType: form.componentType, defaultRoomId: form.defaultRoomId || undefined, color: form.color, teacherIds: form.teacherIds, programMappings: form.programStageOfferingId ? form.requirementIds.map((stageCourseRequirementId) => ({ programStageOfferingId: form.programStageOfferingId, stageCourseRequirementId })) : [], ...(affectedSchedules.length ? { scheduleTeacherResolution: scheduleResolution === 'DELETE' ? { action: 'DELETE' as const } : { action: 'MOVE' as const, teacherId: scheduleTeacherId } } : {}) };
            const saved = section ? await api.org.updateSection(section.id, payload, token) : await api.org.createSection(payload, token);
            const oldOfferingId = section?.cohortOfferingSections?.[0]?.cohortOffering?.id || '';
            if (oldOfferingId && oldOfferingId !== form.cohortOfferingId) await api.cohorts.removeSection(oldOfferingId, saved.id, token);
            if (form.cohortOfferingId && oldOfferingId !== form.cohortOfferingId) await api.cohorts.assignSection(form.cohortOfferingId, saved.id, token);
            if (section) {
                const existing = section.students?.map((item) => item.id) || [];
                const added = form.studentIds.filter((id) => !existing.includes(id));
                const removed = existing.filter((id) => !form.studentIds.includes(id));
                if (added.length) await api.org.bulkEnrollStudentsInSection(saved.id, added, token);
                await Promise.all(removed.map((studentId) => api.org.withdrawStudentFromSection(studentId, saved.id, token)));
            }
            mutate(matchesCacheKeyPrefix('sections'));
            dispatch({ type: 'TOAST_ADD', payload: { message: isEdit ? 'Section updated' : 'Section created', type: 'success' } });
            const requested = searchParams.get('returnTo');
            router.push(requested?.startsWith('/sections') ? requested : (isEdit ? `/sections/${saved.id}` : '/sections'));
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save section'); }
        finally { dispatch({ type: 'UI_STOP_PROCESSING', payload: processingId }); }
    };

    if (loadError) return <ErrorState error={loadError} />;
    if (isEdit && isLoading) return <Loading className="h-full" text="Loading section..." />;
    return <div className="mx-auto w-full max-w-5xl overflow-y-auto px-4 py-8"><PageHeader title={isEdit ? 'Edit Section' : 'Create Section'} description="Configure one course delivery in an institute academic cycle." icon={Layers} breadcrumbs={[{ label: 'Sections', href: '/sections' }, { label: isEdit ? 'Edit' : 'Create' }]} className="mb-7" /><form onSubmit={submit} className="space-y-7">
        {error && <div role="alert" className="rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{error}</div>}
        <section><Intro title="Section identity" text="A section delivers one course during one academic cycle. Its program and cohort relationships are optional delivery mappings." /><div className="grid gap-5 rounded-lg border border-border/70 bg-card/75 p-5 md:grid-cols-2"><Field label="Name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="Code"><Input icon={Hash} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field><Field label="Course"><CustomSelect icon={BookOpen} searchable value={form.courseId} onChange={changeCourse} options={(courses?.data || []).map((item) => ({ value: item.id, label: `${item.code} - ${item.name}` }))} /></Field><Field label="Academic cycle"><CustomSelect icon={CalendarRange} searchable value={form.academicCycleId} onChange={changeCycle} options={(cycles?.data || []).map((item) => ({ value: item.id, label: `${item.code} - ${item.name}` }))} /></Field><Field label="Section type"><CustomSelect value={form.componentType} onChange={(componentType) => setForm({ ...form, componentType: componentType as CourseResultComponentType })} options={SECTION_COMPONENT_TYPE_OPTIONS} /></Field><Field label="Default room"><CustomSelect searchable value={form.defaultRoomId} onChange={(defaultRoomId) => setForm({ ...form, defaultRoomId })} options={[{ value: '', label: 'No default room' }, ...(rooms?.data || []).map((item) => ({ value: item.id, label: formatRoomLabel(item) }))]} /></Field><Field label="Color"><ColorSelector value={form.color} onChange={(color) => setForm({ ...form, color })} /></Field></div></section>
        <section><Intro title="Program mapping" text="Optional. Map this section to a stage offering only when its selected course satisfies requirements in that stage." /><div className="space-y-5 rounded-lg border border-border/70 bg-card/75 p-5"><Field label="Program stage offering"><CustomSelect searchable value={form.programStageOfferingId} onChange={(programStageOfferingId) => setForm({ ...form, programStageOfferingId, requirementIds: [] })} options={[{ value: '', label: 'Standalone / no program' }, ...deliveryOptions.map((item) => ({ value: item.id, label: `${item.programOffering.program.code} - ${item.programStage.name}` }))]} disabled={!form.academicCycleId} /></Field>{form.programStageOfferingId && <Field label="Matching requirements"><CustomMultiSelect values={form.requirementIds} onChange={(requirementIds) => setForm({ ...form, requirementIds })} options={requirements.map((item) => ({ value: item.id, label: `${item.requirementType} - ${item.course.code} ${item.course.name}` }))} /></Field>}<Field label="Cohort offering"><CustomSelect searchable value={form.cohortOfferingId} onChange={(cohortOfferingId) => setForm({ ...form, cohortOfferingId })} options={[{ value: '', label: 'No cohort' }, ...cohortOfferings.map(({ offering, cohort }) => ({ value: offering.id, label: `${cohort.code} - ${cohort.name}${offering.programStageOffering ? ` · ${offering.programStageOffering.programStage.name}` : ''}` }))]} disabled={!form.academicCycleId} /></Field></div></section>
        <section><Intro title="People" text="Assign teachers now. When editing, direct section enrollment can also be managed here; cohort-driven enrollment remains owned by its cohort offering." /><div className="space-y-5 rounded-lg border border-border/70 bg-card/75 p-5"><Field label="Teachers"><CustomMultiSelect values={form.teacherIds} onChange={(teacherIds) => setForm({ ...form, teacherIds })} options={(teachers?.data || []).map((item) => ({ value: item.id, label: item.user?.name || item.user?.email || 'Teacher' }))} /></Field>{affectedSchedules.length > 0 && <div className="space-y-4 rounded-md border border-warning/35 bg-warning/10 p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" /><div><p className="text-sm font-black">Removed teachers own existing schedules</p><p className="text-xs text-muted-foreground">Resolve {affectedSchedules.length} affected schedule{affectedSchedules.length === 1 ? '' : 's'} before saving.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Resolution"><CustomSelect value={scheduleResolution} onChange={setScheduleResolution} options={[{ value: '', label: 'Choose resolution' }, { value: 'MOVE', label: 'Move schedules' }, { value: 'DELETE', label: 'Delete schedules' }]} /></Field>{scheduleResolution === 'MOVE' && <Field label="Move to teacher"><CustomSelect searchable value={scheduleTeacherId} onChange={setScheduleTeacherId} options={remainingTeacherOptions} placeholder="Choose remaining teacher" /></Field>}</div></div>}{isEdit && <Field label="Directly enrolled students"><CustomMultiSelect values={form.studentIds} onChange={(studentIds) => setForm({ ...form, studentIds })} options={(students?.data || []).map((item) => ({ value: item.id, label: item.user?.name || item.user?.email || 'Student' }))} /></Field>}</div></section>
        <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button><Button type="submit" icon={Save} loadingId={isEdit ? 'section-edit' : 'section-create'}>{isEdit ? 'Save section' : 'Create section'}</Button></div>
    </form></div>;
}

function Intro({ title, text }: { title: string; text: string }) { return <div className="mb-3 px-1"><h2 className="text-base font-black">{title}</h2><p className="mt-1 max-w-3xl text-sm font-medium text-muted-foreground">{text}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }

const SECTION_COMPONENT_TYPE_OPTIONS = [
    { value: 'OTHER', label: 'Other' },
    { value: 'THEORY', label: 'Theory' },
    { value: 'LAB', label: 'Lab' },
    { value: 'PRACTICAL', label: 'Practical' },
    { value: 'TUTORIAL', label: 'Tutorial' },
    { value: 'RECITATION', label: 'Recitation' },
    { value: 'CLINIC', label: 'Clinic' },
    { value: 'STUDIO', label: 'Studio' },
    { value: 'FIELDWORK', label: 'Fieldwork' },
];
