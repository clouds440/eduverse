'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { ArrowLeft, GitBranch, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { formatComponentTypeLabel, formatSectionWithComponentType, sectionComponentTypeOptions } from '@/lib/sectionRelationships';
import { AcademicCycle, Course, CourseResultComponentType, CourseResultScheme, CourseResultSchemePreview, PaginatedResponse, Role, Section } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SectionExpansionPreviewSummary } from '@/components/sections/SectionExpansionPreviewSummary';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';

interface RelationshipComponentForm {
    componentType: CourseResultComponentType;
    label: string;
    weight: string;
    sectionIds: string[];
}

interface SectionRelationshipManagerProps {
    initialCourseId?: string;
    initialAcademicCycleId?: string;
    initialSectionId?: string;
}

function defaultComponents(): RelationshipComponentForm[] {
    return [
        { componentType: 'THEORY', label: 'Theory', weight: '75', sectionIds: [] },
        { componentType: 'LAB', label: 'Lab', weight: '25', sectionIds: [] },
    ];
}

export function SectionRelationshipManager({ initialCourseId, initialAcademicCycleId, initialSectionId }: SectionRelationshipManagerProps) {
    const { token, user } = useAuth();
    const { state, dispatch } = useGlobal();
    const [courseId, setCourseId] = useState(initialCourseId || '');
    const [academicCycleId, setAcademicCycleId] = useState(initialAcademicCycleId || '');
    const [form, setForm] = useState<{ components: RelationshipComponentForm[] }>({ components: defaultComponents() });
    const [preview, setPreview] = useState<CourseResultSchemePreview | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    const { data: initialSection } = useSWR<Section>(
        token && initialSectionId ? ['section-detail', initialSectionId] as const : null,
        () => api.org.getSection(initialSectionId!, token!),
    );
    const { data: coursesData } = useSWR<PaginatedResponse<Course>>(token ? ['courses', { limit: 1000 }] as const : null);
    const { data: cyclesData } = useSWR<PaginatedResponse<AcademicCycle>>(token ? ['academicCycles', { limit: 100 }] as const : null);
    const { data: sectionsData } = useSWR<PaginatedResponse<Section>>(
        token && academicCycleId ? ['sections', { academicCycleId, limit: 1000 }] as const : null,
    );
    const { data: schemeData, error: schemeError, mutate: mutateScheme } = useSWR<CourseResultScheme>(
        token && courseId && academicCycleId ? ['course-result-scheme', courseId, academicCycleId] as const : null,
        () => api.org.getCourseResultScheme(courseId, academicCycleId, token!),
    );

    useEffect(() => {
        if (!initialSection) return;
        setCourseId(initialSection.courseId || '');
        setAcademicCycleId(initialSection.academicCycleId || '');
    }, [initialSection]);

    useEffect(() => {
        if (!academicCycleId && initialAcademicCycleId) setAcademicCycleId(initialAcademicCycleId);
    }, [academicCycleId, initialAcademicCycleId]);

    useEffect(() => {
        if (!courseId && initialCourseId) setCourseId(initialCourseId);
    }, [courseId, initialCourseId]);

    useEffect(() => {
        if (!academicCycleId && cyclesData?.data?.length) {
            const activeCycle = cyclesData.data.find((cycle) => cycle.status === 'ACTIVE') || cyclesData.data[0];
            setAcademicCycleId(activeCycle.id);
        }
    }, [academicCycleId, cyclesData?.data]);

    useEffect(() => {
        if (!schemeData?.components?.length) {
            setForm({ components: defaultComponents() });
            return;
        }
        setForm({
            components: schemeData.components.map((component) => ({
                componentType: component.componentType,
                label: component.label,
                weight: String(component.weight),
                sectionIds: component.sectionIds || [],
            })),
        });
    }, [schemeData]);

    useEffect(() => {
        setPreview(null);
        setConfirmOpen(false);
    }, [courseId, academicCycleId]);

    const selectedCourse = coursesData?.data?.find((course) => course.id === courseId) || initialSection?.course;
    const availableSections = useMemo(
        () => (sectionsData?.data || []).filter((section) => section.courseId === courseId),
        [courseId, sectionsData?.data],
    );
    const selectedSectionIds = form.components.flatMap((component) => component.sectionIds);
    const weightTotal = form.components.reduce((sum, component) => sum + Number(component.weight || 0), 0);

    const updateComponent = (index: number, updates: Partial<RelationshipComponentForm>) => {
        setForm((current) => ({
            components: current.components.map((component, componentIndex) => componentIndex === index ? { ...component, ...updates } : component),
        }));
    };

    const addComponent = () => {
        const used = new Set(form.components.map((component) => component.componentType));
        const nextType = sectionComponentTypeOptions.find((option) => !used.has(option.value))?.value || 'OTHER';
        setForm((current) => ({
            components: [...current.components, { componentType: nextType, label: formatComponentTypeLabel(nextType), weight: '0', sectionIds: [] }],
        }));
    };

    const removeComponent = (index: number) => {
        setForm((current) => ({ components: current.components.filter((_component, componentIndex) => componentIndex !== index) }));
    };

    const buildPayload = (syncEnrollments = false) => ({
        syncEnrollments,
        components: form.components.map((component, index) => ({
            componentType: component.componentType,
            label: component.label || formatComponentTypeLabel(component.componentType),
            weight: Number(component.weight),
            sortOrder: index,
            sectionIds: component.sectionIds,
        })),
    });

    const showError = (fallback: string, err: unknown) => {
        const raw = err instanceof Error ? err.message : fallback;
        dispatch({ type: 'TOAST_ADD', payload: { message: raw, type: 'error' } });
    };

    const previewSave = async (event: FormEvent) => {
        event.preventDefault();
        if (!token || !courseId || !academicCycleId) return;
        if (Math.abs(weightTotal - 100) > 0.000001) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Relationship weights must total 100', type: 'error' } });
            return;
        }
        if (form.components.some((component) => component.sectionIds.length === 0)) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Each relationship component needs at least one section', type: 'error' } });
            return;
        }
        dispatch({ type: 'UI_START_PROCESSING', payload: 'course-result-scheme' });
        try {
            const result = await api.org.previewCourseResultScheme(courseId, academicCycleId, buildPayload(false), token);
            setPreview(result);
            setConfirmOpen(true);
        } catch (err) {
            showError('Error previewing section relationship', err);
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'course-result-scheme' });
        }
    };

    const confirmSave = async () => {
        if (!token || !courseId || !academicCycleId) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'course-result-scheme' });
        try {
            await api.org.upsertCourseResultScheme(courseId, academicCycleId, buildPayload(true), token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Section relationship saved and enrollments synchronized', type: 'success' } });
            setConfirmOpen(false);
            await mutateScheme();
            mutate(matchesCacheKeyPrefix('sections'));
        } catch (err) {
            showError('Error saving section relationship', err);
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'course-result-scheme' });
        }
    };

    const deleteRelationship = async () => {
        if (!token || !schemeData?.id) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'course-result-scheme' });
        try {
            await api.org.deleteCourseResultScheme(schemeData.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Section relationship removed', type: 'success' } });
            await mutateScheme();
        } catch (err) {
            showError('Error removing section relationship', err);
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'course-result-scheme' });
        }
    };

    if (schemeError) return <ErrorState error={schemeError} onRetry={() => mutateScheme()} />;

    return (
        <PageShell className="overflow-y-auto">
            <PageHeader
                title="Section Relationships"
                description="Connect any two or more sections of the same course and cycle, then preview enrollment synchronization before saving."
                icon={GitBranch}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Section Relationships' },
                ]}
                actions={<Link href={initialSectionId ? `/sections/${initialSectionId}` : '/sections'}><Button variant="secondary" icon={ArrowLeft}>Back</Button></Link>}
            />
            <ResourcePanel className="flex-none">
                <form onSubmit={previewSave} className="space-y-5 p-4 sm:p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Course</Label>
                            <CustomSelect
                                value={courseId}
                                onChange={setCourseId}
                                searchable
                                options={(coursesData?.data || []).map((course) => ({ value: course.id, label: `${course.code} - ${course.name}` }))}
                                placeholder="Select course"
                                disabled={Boolean(initialSectionId)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Academic cycle</Label>
                            <CustomSelect
                                value={academicCycleId}
                                onChange={setAcademicCycleId}
                                searchable
                                options={(cyclesData?.data || []).map((cycle) => ({ value: cycle.id, label: `${cycle.code} - ${cycle.name}` }))}
                                placeholder="Select academic cycle"
                                disabled={Boolean(initialSectionId)}
                            />
                        </div>
                    </div>

                    {selectedCourse && (
                        <div className="rounded-md border border-border/70 bg-muted/20 px-4 py-3">
                            <p className="text-sm font-black">{selectedCourse.code} - {selectedCourse.name}</p>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">Relationship components share one transcript result and auto-sync enrollment across selected sections.</p>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                        <Badge variant={Math.abs(weightTotal - 100) < 0.000001 ? 'success' : 'warning'} size="sm">
                            Total weight: {weightTotal}%
                        </Badge>
                        <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={addComponent} disabled={!canManage}>
                            Add component
                        </Button>
                    </div>

                    {form.components.map((component, index) => (
                        <div key={index} className="space-y-4 rounded-md border border-border/70 p-4">
                            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem_auto]">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <CustomSelect
                                        value={component.componentType}
                                        onChange={(value) => updateComponent(index, { componentType: value as CourseResultComponentType, label: component.label || formatComponentTypeLabel(value as CourseResultComponentType) })}
                                        options={sectionComponentTypeOptions}
                                        disabled={!canManage}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Label</Label>
                                    <Input value={component.label} onChange={(event) => updateComponent(index, { label: event.target.value })} disabled={!canManage} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Weight</Label>
                                    <Input type="number" min={0} max={100} step="0.01" value={component.weight} onChange={(event) => updateComponent(index, { weight: event.target.value })} disabled={!canManage} />
                                </div>
                                <div className="flex items-end">
                                    <Button type="button" variant="ghost" size="icon" icon={Trash2} title="Remove component" onClick={() => removeComponent(index)} disabled={!canManage || form.components.length <= 2} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Sections</Label>
                                <CustomMultiSelect
                                    values={component.sectionIds}
                                    onChange={(sectionIds) => updateComponent(index, { sectionIds })}
                                    searchable
                                    disabled={!canManage || !courseId || !academicCycleId}
                                    options={availableSections
                                        .filter((section) => !selectedSectionIds.includes(section.id) || component.sectionIds.includes(section.id))
                                        .map((section) => ({ value: section.id, label: formatSectionWithComponentType(section) }))}
                                    placeholder="Select sections"
                                />
                            </div>
                        </div>
                    ))}

                    <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-4">
                        {schemeData?.id && <Button type="button" variant="danger" onClick={deleteRelationship} loadingId="course-result-scheme" disabled={!canManage}>Remove Relationship</Button>}
                        <Button type="submit" icon={GitBranch} loadingId="course-result-scheme" disabled={!canManage || !courseId || !academicCycleId}>Preview Changes</Button>
                    </div>
                </form>
            </ResourcePanel>

            <ConfirmDialog
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={confirmSave}
                title="Confirm Section Relationship"
                description={(
                    <span className="block space-y-3 text-sm">
                        <span className="block">This will save the relationship and synchronize enrollment across the related sections.</span>
                        <SectionExpansionPreviewSummary preview={preview} mode="relationship" />
                    </span>
                )}
                confirmText="Save and Sync Enrollments"
                loadingId="course-result-scheme"
            />
        </PageShell>
    );
}
