'use client';

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { BookOpen, Building2, GraduationCap, Hash, Layers, Save, Settings2, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api, ApiRequestError } from '@/lib/api';
import { programSchema } from '@/lib/schemas';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import {
    Course,
    CreateProgramRequest,
    Department,
    EligibleProgramCycle,
    PaginatedResponse,
    Program,
    ProgramCompletionMode,
    ProgramCycleInput,
    ProgramProgressionMode,
    ProgramStructureType,
    Role,
} from '@/types';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { Textarea } from '@/components/ui/Textarea';
import { Toggle } from '@/components/ui/Toggle';
import { ProgramCycleArrayEditor } from './ProgramCycleArrayEditor';

interface ProgramFormProps {
    program?: Program;
}

interface SectionIntroductionProps {
    title: string;
    description: ReactNode;
    icon: LucideIcon;
}

function SectionIntroduction({ title, description, icon: Icon }: SectionIntroductionProps) {
    return (
        <div className="mb-3 flex items-start gap-3 px-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-primary shadow-sm">
                <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 pt-0.5">
                <h2 className="text-base font-black text-foreground">{title}</h2>
                <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">{description}</p>
            </div>
        </div>
    );
}

function initialCycles(program?: Program): ProgramCycleInput[] {
    if (!program) return [];
    const currentCurriculum = program.curriculumVersions?.find((curriculum) =>
        curriculum.programConfigurationRevisionId === program.configurationRevisions?.[0]?.id,
    ) || program.curriculumVersions?.[0];
    return program.academicCycles
        .filter((association) => association.status === 'ACTIVE')
        .map((association, index) => {
            const stage = currentCurriculum?.stages.find((item) => item.programAcademicCycleId === association.id);
            return {
                kind: 'EXISTING' as const,
                academicCycleId: association.academicCycleId,
                stage: {
                    name: stage?.name || `Stage ${index + 1}`,
                    code: stage?.code || `STAGE-${index + 1}`,
                    courseRequirements: stage?.courseRequirements.map((requirement) => ({
                        courseId: requirement.courseId,
                        requirementType: requirement.requirementType,
                    })) || [],
                },
            };
        });
}

export function ProgramForm({ program }: ProgramFormProps) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const isEdit = Boolean(program);
    const currentCurriculum = program?.curriculumVersions?.find((curriculum) =>
        curriculum.programConfigurationRevisionId === program.configurationRevisions?.[0]?.id,
    ) || program?.curriculumVersions?.[0];
    const [form, setForm] = useState({
        name: program?.name || '',
        code: program?.code || '',
        departmentId: program?.departmentId || '',
        description: program?.description || '',
        structureType: program?.structureType || ProgramStructureType.TERM_BASED,
        progressionMode: program?.progressionMode || ProgramProgressionMode.SEQUENTIAL,
        completionMode: program?.completionMode || ProgramCompletionMode.REQUIREMENTS,
        curriculumName: isEdit ? `${currentCurriculum?.name || program?.name || 'Program'} revision ${Number(program?.configurationVersion || 1) + 1}` : '',
        curriculumCode: isEdit ? `${program?.code || 'PROGRAM'}-R${Number(program?.configurationVersion || 1) + 1}` : '',
        isVisibleForAdmissions: program?.isVisibleForAdmissions || false,
        admissionsLabel: program?.admissionsLabel || '',
        admissionsDescription: program?.admissionsDescription || '',
    });
    const [cycles, setCycles] = useState<ProgramCycleInput[]>(() => initialCycles(program));
    const [changeReason, setChangeReason] = useState('');
    const [formError, setFormError] = useState('');
    const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

    useEffect(() => {
        if (user && user.role !== Role.ORG_ADMIN && user.role !== Role.SUB_ADMIN) router.replace('/programs');
    }, [router, user]);

    const { data: departmentsData } = useSWR<PaginatedResponse<Department>>(
        token ? ['departments', { limit: 1000, isActive: true }] as const : null,
    );
    const { data: coursesData } = useSWR<PaginatedResponse<Course>>(
        token && form.departmentId ? ['courses', { limit: 1000, departmentId: form.departmentId }] as const : null,
    );
    const { data: eligibleCyclesResponse } = useSWR<PaginatedResponse<EligibleProgramCycle>>(
        token ? ['program-eligible-cycles', program?.id || 'new'] : null,
        () => api.programs.getEligibleCycles(token!, { programId: program?.id, limit: 100 }),
    );
    const availableCycles = useMemo(() => {
        const persisted = program?.academicCycles.map((association) => ({
            ...association.academicCycle,
            programUseCount: 1,
        })) || [];
        return [...persisted, ...(eligibleCyclesResponse?.data || [])].filter((cycle, index, all) => all.findIndex((item) => item.id === cycle.id) === index);
    }, [eligibleCyclesResponse, program]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;
        setFormError('');
        setRowErrors({});
        const payload: CreateProgramRequest = {
            name: form.name,
            code: form.code,
            departmentId: form.departmentId,
            description: form.description || undefined,
            structureType: form.structureType,
            progressionMode: form.progressionMode,
            completionMode: form.completionMode,
            isVisibleForAdmissions: form.isVisibleForAdmissions,
            admissionsLabel: form.admissionsLabel || undefined,
            admissionsDescription: form.admissionsDescription || undefined,
            curriculumName: form.curriculumName,
            curriculumCode: form.curriculumCode,
            cycles,
        };
        const validation = programSchema.safeParse(payload);
        if (!validation.success) {
            setFormError(validation.error.issues[0]?.message || 'Review the program structure');
            return;
        }
        if (isEdit && !changeReason.trim()) {
            setFormError('Configuration change reason is required');
            return;
        }

        dispatch({ type: 'UI_START_PROCESSING', payload: 'program-save' });
        try {
            let saved: Program;
            if (program) {
                saved = await api.programs.replaceCycles(program.id, {
                    configurationVersion: program.configurationVersion,
                    changeReason,
                    curriculumName: form.curriculumName,
                    curriculumCode: form.curriculumCode,
                    cycles,
                    metadata: {
                        name: form.name,
                        code: form.code,
                        departmentId: form.departmentId,
                        description: form.description,
                        structureType: form.structureType,
                        progressionMode: form.progressionMode,
                        completionMode: form.completionMode,
                        isVisibleForAdmissions: form.isVisibleForAdmissions,
                        admissionsLabel: form.admissionsLabel,
                        admissionsDescription: form.admissionsDescription,
                    },
                }, token);
            } else {
                saved = await api.programs.createProgram(payload, token);
            }
            mutate(matchesCacheKeyPrefix('programs'));
            dispatch({ type: 'TOAST_ADD', payload: { message: isEdit ? 'Program configuration updated' : 'Program created', type: 'success' } });
            router.push(`/programs/${saved.id}`);
        } catch (error) {
            const apiError = error as ApiRequestError;
            if (apiError.rowIndex !== undefined) setRowErrors({ [apiError.rowIndex]: apiError.message });
            setFormError(apiError.message || 'Unable to save program');
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'program-save' });
        }
    };

    return (
        <PageShell className="overflow-y-auto custom-scrollbar">
            <div className="mx-auto w-full max-w-7xl pb-10">
                <PageHeader
                    title={isEdit ? `Edit ${program?.name}` : 'Create Program'}
                    description={isEdit ? `Configuration revision ${program!.configurationVersion + 1}` : 'Create a durable course offering and define how students progress through it.'}
                    icon={GraduationCap}
                    breadcrumbs={[{ label: 'Programs', href: '/programs' }, { label: isEdit ? 'Edit' : 'Create' }]}
                    className="mb-6"
                />

                <form onSubmit={submit} className="space-y-8" noValidate>
                    {formError && (
                        <div role="alert" className="rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">
                            {formError}
                        </div>
                    )}

                    <section>
                        <SectionIntroduction
                            title="Program identity"
                            description="The department owns this program and becomes the main department for students admitted into it. Department-scoped admins can manage programs only in their assigned departments."
                            icon={BookOpen}
                        />
                        <div className="rounded-lg border border-border/70 bg-card/75 p-4 shadow-sm sm:p-6">
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Program name <span className="text-danger">*</span></Label>
                                    <Input icon={GraduationCap} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Bachelor of Computer Science" required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Program code <span className="text-danger">*</span></Label>
                                    <Input icon={Hash} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="e.g. BSCS" required />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-sm font-bold">Department <span className="text-danger">*</span></Label>
                                    <CustomSelect
                                        icon={Building2}
                                        searchable
                                        value={form.departmentId}
                                        onChange={(departmentId) => { setForm({ ...form, departmentId }); setCycles([]); }}
                                        options={(departmentsData?.data || []).map((department) => ({ value: department.id, label: `${department.code} - ${department.name}` }))}
                                        placeholder="Select the owning department"
                                    />
                                    <p className="text-xs font-medium leading-relaxed text-muted-foreground">Changing the department clears the cycle plan because course requirements are department-specific.</p>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-sm font-bold">Description</Label>
                                    <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} placeholder="Summarize the program focus, qualification, and intended outcomes." />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <SectionIntroduction
                            title="Progression rules"
                            description="These rules describe the program itself. Academic cycles remain institute-wide records and are attached separately in the curriculum plan below."
                            icon={Settings2}
                        />
                        <div className="rounded-lg border border-border/70 bg-card/75 p-4 shadow-sm sm:p-6">
                            <div className="grid gap-5 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Structure <span className="text-danger">*</span></Label>
                                    <CustomSelect value={form.structureType} onChange={(structureType) => setForm({ ...form, structureType })} options={Object.values(ProgramStructureType).map((value) => ({ value, label: value.replaceAll('_', ' ') }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Progression <span className="text-danger">*</span></Label>
                                    <CustomSelect value={form.progressionMode} onChange={(progressionMode) => setForm({ ...form, progressionMode })} options={Object.values(ProgramProgressionMode).map((value) => ({ value, label: value.replaceAll('_', ' ') }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Completion <span className="text-danger">*</span></Label>
                                    <CustomSelect value={form.completionMode} onChange={(completionMode) => setForm({ ...form, completionMode })} options={Object.values(ProgramCompletionMode).map((value) => ({ value, label: value.replaceAll('_', ' ') }))} />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <SectionIntroduction
                            title="Curriculum and cycle plan"
                            description="Build the ordered stages students must complete. Reuse institute cycles wherever possible; only organization admins can create a new institute-wide cycle."
                            icon={Layers}
                        />
                        <div className="mb-4 rounded-lg border border-border/70 bg-card/75 p-4 shadow-sm sm:p-6">
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Curriculum name <span className="text-danger">*</span></Label>
                                    <Input value={form.curriculumName} onChange={(event) => setForm({ ...form, curriculumName: event.target.value })} placeholder="e.g. BSCS Core Curriculum" required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Curriculum code <span className="text-danger">*</span></Label>
                                    <Input value={form.curriculumCode} onChange={(event) => setForm({ ...form, curriculumCode: event.target.value })} placeholder="e.g. BSCS-CORE-01" required />
                                </div>
                                {isEdit && (
                                    <div className="space-y-2 md:col-span-2">
                                        <Label className="text-sm font-bold">Change reason <span className="text-danger">*</span></Label>
                                        <Input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Summarize why this configuration revision is needed." required />
                                    </div>
                                )}
                            </div>
                        </div>
                        <ProgramCycleArrayEditor
                            value={cycles}
                            onChange={setCycles}
                            eligibleCycles={availableCycles}
                            courses={coursesData?.data || []}
                            canCreateCycles={user?.role === Role.ORG_ADMIN}
                            rowErrors={rowErrors}
                        />
                    </section>

                    <section>
                        <SectionIntroduction
                            title="Online admissions"
                            description="Publish this program as an application option when it is ready. The admissions label and summary can be written for prospective students without changing the internal program name."
                            icon={GraduationCap}
                        />
                        <div className="rounded-lg border border-border/70 bg-card/75 p-4 shadow-sm sm:p-6">
                            <Toggle checked={form.isVisibleForAdmissions} onCheckedChange={(isVisibleForAdmissions) => setForm({ ...form, isVisibleForAdmissions })} label="Visible for admissions" />
                            <div className="mt-5 grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Admissions label</Label>
                                    <Input value={form.admissionsLabel} onChange={(event) => setForm({ ...form, admissionsLabel: event.target.value })} placeholder="Public-facing program name" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Admissions description</Label>
                                    <Textarea value={form.admissionsDescription} onChange={(event) => setForm({ ...form, admissionsDescription: event.target.value })} rows={3} placeholder="Short summary shown with the application option." />
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="sticky bottom-3 z-20 flex flex-col-reverse gap-2 rounded-lg border border-border/70 bg-card/95 p-3 shadow-xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                        <p className="hidden px-2 text-xs font-semibold text-muted-foreground sm:block">{isEdit ? 'Saving creates a new configuration revision.' : 'The program can be reviewed before it is opened for admissions.'}</p>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <Button type="button" variant="secondary" onClick={() => router.push(program ? `/programs/${program.id}` : '/programs')}>Cancel</Button>
                            <Button type="submit" loadingId="program-save" icon={Save}>{isEdit ? 'Save configuration' : 'Create program'}</Button>
                        </div>
                    </div>
                </form>
            </div>
        </PageShell>
    );
}
