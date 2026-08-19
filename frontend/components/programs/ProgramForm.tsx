'use client';

import { FormEvent, type ReactNode, useEffect, useState } from 'react';
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
    PaginatedResponse,
    Program,
    ProgramCompletionMode,
    ProgramDurationUnit,
    ProgramStageInput,
    ProgramProgressionMode,
    ProgramStructureType,
    ProgramType,
    Role,
} from '@/types';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { Textarea } from '@/components/ui/Textarea';
import { ProgramStageArrayEditor } from './ProgramStageArrayEditor';

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

function initialStages(program?: Program): ProgramStageInput[] {
    if (!program) return [];
    const currentCurriculum = program.curriculumVersions?.find((curriculum) =>
        curriculum.programConfigurationRevisionId === program.configurationRevisions?.[0]?.id,
    ) || program.curriculumVersions?.[0];
    return (currentCurriculum?.stages || []).map((stage) => ({
        name: stage.name,
        code: stage.code,
        stageType: stage.stageType || undefined,
        isOptional: stage.isOptional,
        minCredits: stage.minCredits ?? undefined,
        expectedCredits: stage.expectedCredits ?? undefined,
        courseRequirements: stage.courseRequirements.map((requirement) => ({
            courseId: requirement.courseId,
            requirementType: requirement.requirementType,
            groupKey: requirement.groupKey || undefined,
            minCourses: requirement.minCourses ?? undefined,
            minCredits: requirement.minCredits ?? undefined,
            notes: requirement.notes || undefined,
        })),
    }));
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
        programType: program?.programType || ProgramType.DEGREE,
        subjectArea: program?.subjectArea || '',
        educationLevel: program?.educationLevel || '',
        summary: program?.summary || '',
        description: program?.description || '',
        languageCodes: program?.languageCodes?.join(', ') || '',
        credentialType: program?.credentialType || '',
        credentialAwarded: program?.credentialAwarded || '',
        targetAudience: program?.targetAudience || '',
        learningOutcomes: program?.learningOutcomes?.join('\n') || '',
        entryOverview: program?.entryOverview || '',
        awardingBody: program?.awardingBody || '',
        accreditationSummary: program?.accreditationSummary || '',
        durationValue: program?.durationValue == null ? '' : String(program.durationValue),
        durationUnit: program?.durationUnit || ProgramDurationUnit.MONTHS,
        departmentId: program?.campusConfiguration?.departmentId || '',
        structureType: program?.campusConfiguration?.structureType || ProgramStructureType.TERM_BASED,
        progressionMode: program?.campusConfiguration?.progressionMode || ProgramProgressionMode.SEQUENTIAL,
        completionMode: program?.campusConfiguration?.completionMode || ProgramCompletionMode.REQUIREMENTS,
        minimumPassingPercentage: program?.campusConfiguration?.minimumPassingPercentage ?? 50,
        minimumAttendancePercentage: program?.campusConfiguration?.minimumAttendancePercentage == null ? '' : String(program.campusConfiguration.minimumAttendancePercentage),
        curriculumName: isEdit ? `${currentCurriculum?.name || program?.name || 'Program'} revision ${Number(program?.campusConfiguration?.configurationVersion || 1) + 1}` : '',
        curriculumCode: isEdit ? `${program?.code || 'PROGRAM'}-R${Number(program?.campusConfiguration?.configurationVersion || 1) + 1}` : '',
    });
    const [stages, setStages] = useState<ProgramStageInput[]>(() => initialStages(program));
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
        token ? ['courses', { limit: 1000 }] as const : null,
    );

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;
        setFormError('');
        setRowErrors({});
        const payload: CreateProgramRequest = {
            name: form.name,
            code: form.code,
            programType: form.programType,
            subjectArea: form.subjectArea || undefined,
            educationLevel: form.educationLevel || undefined,
            summary: form.summary || undefined,
            description: form.description || undefined,
            languageCodes: form.languageCodes.split(',').map((code) => code.trim()).filter(Boolean),
            credentialType: form.credentialType || undefined,
            credentialAwarded: form.credentialAwarded || undefined,
            targetAudience: form.targetAudience || undefined,
            learningOutcomes: form.learningOutcomes.split('\n').map((outcome) => outcome.trim()).filter(Boolean),
            entryOverview: form.entryOverview || undefined,
            awardingBody: form.awardingBody || undefined,
            accreditationSummary: form.accreditationSummary || undefined,
            durationValue: form.durationValue === '' ? undefined : Number(form.durationValue),
            durationUnit: form.durationValue === '' ? undefined : form.durationUnit,
            campusConfiguration: {
                departmentId: form.departmentId,
                structureType: form.structureType,
                progressionMode: form.progressionMode,
                completionMode: form.completionMode,
                minimumPassingPercentage: form.minimumPassingPercentage,
                minimumAttendancePercentage: form.minimumAttendancePercentage === '' ? undefined : Number(form.minimumAttendancePercentage),
            },
            curriculumName: form.curriculumName,
            curriculumCode: form.curriculumCode,
            stages,
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
                saved = await api.programs.replaceStructure(program.id, {
                    configurationVersion: program.campusConfiguration!.configurationVersion,
                    changeReason,
                    curriculumName: form.curriculumName,
                    curriculumCode: form.curriculumCode,
                    stages,
                    metadata: {
                        name: form.name,
                        code: form.code,
                        programType: form.programType,
                        subjectArea: form.subjectArea,
                        educationLevel: form.educationLevel,
                        summary: form.summary,
                        description: form.description,
                        languageCodes: form.languageCodes.split(',').map((code) => code.trim()).filter(Boolean),
                        credentialType: form.credentialType,
                        credentialAwarded: form.credentialAwarded,
                        targetAudience: form.targetAudience,
                        learningOutcomes: form.learningOutcomes.split('\n').map((outcome) => outcome.trim()).filter(Boolean),
                        entryOverview: form.entryOverview,
                        awardingBody: form.awardingBody,
                        accreditationSummary: form.accreditationSummary,
                        durationValue: form.durationValue === '' ? undefined : Number(form.durationValue),
                        durationUnit: form.durationValue === '' ? undefined : form.durationUnit,
                        campusConfiguration: {
                            departmentId: form.departmentId,
                            structureType: form.structureType,
                            progressionMode: form.progressionMode,
                            completionMode: form.completionMode,
                            minimumPassingPercentage: form.minimumPassingPercentage,
                            minimumAttendancePercentage: form.minimumAttendancePercentage === '' ? undefined : Number(form.minimumAttendancePercentage),
                        },
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
                    description={isEdit ? `Configuration revision ${program!.campusConfiguration!.configurationVersion + 1}` : 'Create the catalog record and its Campus academic configuration.'}
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
                            description="Define the provider-owned catalog record. Admissions presentation and application rules are configured separately."
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
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Program type <span className="text-danger">*</span></Label>
                                    <CustomSelect value={form.programType} onChange={(programType) => setForm({ ...form, programType: programType as ProgramType })} options={Object.values(ProgramType).map((value) => ({ value, label: value.replaceAll('_', ' ') }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Subject area</Label>
                                    <Input value={form.subjectArea} onChange={(event) => setForm({ ...form, subjectArea: event.target.value })} placeholder="e.g. Computer science" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Education level</Label>
                                    <Input value={form.educationLevel} onChange={(event) => setForm({ ...form, educationLevel: event.target.value })} placeholder="e.g. Undergraduate" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Languages</Label>
                                    <Input value={form.languageCodes} onChange={(event) => setForm({ ...form, languageCodes: event.target.value })} placeholder="en, ur" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-sm font-bold">Summary</Label>
                                    <Input value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="A concise catalog summary" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-sm font-bold">Description</Label>
                                    <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} placeholder="Summarize the program focus, qualification, and intended outcomes." />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Credential type</Label>
                                    <Input value={form.credentialType} onChange={(event) => setForm({ ...form, credentialType: event.target.value })} placeholder="e.g. Degree" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Credential awarded</Label>
                                    <Input value={form.credentialAwarded} onChange={(event) => setForm({ ...form, credentialAwarded: event.target.value })} placeholder="e.g. Bachelor of Science" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Duration</Label>
                                    <Input type="number" min={1} value={form.durationValue} onChange={(event) => setForm({ ...form, durationValue: event.target.value })} placeholder="e.g. 4" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Duration unit</Label>
                                    <CustomSelect value={form.durationUnit} onChange={(durationUnit) => setForm({ ...form, durationUnit: durationUnit as ProgramDurationUnit })} options={Object.values(ProgramDurationUnit).map((value) => ({ value, label: value }))} />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-sm font-bold">Target audience</Label>
                                    <Textarea value={form.targetAudience} onChange={(event) => setForm({ ...form, targetAudience: event.target.value })} rows={2} />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-sm font-bold">Learning outcomes</Label>
                                    <Textarea value={form.learningOutcomes} onChange={(event) => setForm({ ...form, learningOutcomes: event.target.value })} rows={4} placeholder="One outcome per line" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-sm font-bold">Entry overview</Label>
                                    <Textarea value={form.entryOverview} onChange={(event) => setForm({ ...form, entryOverview: event.target.value })} rows={3} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Awarding body</Label>
                                    <Input value={form.awardingBody} onChange={(event) => setForm({ ...form, awardingBody: event.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Accreditation</Label>
                                    <Input value={form.accreditationSummary} onChange={(event) => setForm({ ...form, accreditationSummary: event.target.value })} />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <SectionIntroduction
                            title="Progression rules"
                            description="Bind this catalog program to the Campus department and define its operational academic rules."
                            icon={Settings2}
                        />
                        <div className="rounded-lg border border-border/70 bg-card/75 p-4 shadow-sm sm:p-6">
                            <div className="grid gap-5 md:grid-cols-3">
                                <div className="space-y-2 md:col-span-3">
                                    <Label className="text-sm font-bold">Department <span className="text-danger">*</span></Label>
                                    <CustomSelect icon={Building2} searchable value={form.departmentId} onChange={(departmentId) => setForm({ ...form, departmentId })} options={(departmentsData?.data || []).map((department) => ({ value: department.id, label: `${department.code} - ${department.name}` }))} placeholder="Select the Campus department" />
                                </div>
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
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Passing percentage</Label>
                                    <Input type="number" min={0} max={100} value={form.minimumPassingPercentage} onChange={(event) => setForm({ ...form, minimumPassingPercentage: Number(event.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Minimum attendance</Label>
                                    <Input type="number" min={0} max={100} value={form.minimumAttendancePercentage} onChange={(event) => setForm({ ...form, minimumAttendancePercentage: event.target.value })} placeholder="Not enforced" />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <SectionIntroduction
                            title="Curriculum and stage plan"
                            description="Build the ordered, reusable stages students complete. This structure remains independent of calendar cycles and can be offered repeatedly over time."
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
                        <ProgramStageArrayEditor
                            value={stages}
                            onChange={setStages}
                            courses={coursesData?.data || []}
                            rowErrors={rowErrors}
                        />
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
