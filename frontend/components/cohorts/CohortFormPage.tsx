'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { AlertCircle, BookOpen, Calendar, GraduationCap, Hash, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { formatCourseSectionLabel } from '@/lib/utils';
import { AcademicCycle, ApiError, Cohort, CreateCohortDto, Role, Section, Student, UpdateCohortDto } from '@/types';
import { Button } from '@/components/ui/Button';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DocsLink } from '@/components/ui/DocsLink';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { PageHeader } from '@/components/ui/PageShell';

type CohortFormMode = 'create' | 'edit';

interface CohortFormData {
    name: string;
    code: string;
    academicCycleId: string;
    studentIds: string[];
    sectionIds: string[];
}

interface CohortFormErrors {
    name?: string;
    code?: string;
    academicCycleId?: string;
    general?: string;
}

interface CohortFormPageProps {
    mode: CohortFormMode;
    cohort?: Cohort;
    returnTo?: string;
}

function getInitialFormData(cohort?: Cohort): CohortFormData {
    return {
        name: cohort?.name || '',
        code: cohort?.code || '',
        academicCycleId: cohort?.academicCycleId || '',
        studentIds: cohort?.students?.map((student) => student.id) || [],
        sectionIds: cohort?.sections?.map((section) => section.id) || [],
    };
}

function parseFormErrors(error: unknown, fallback: string): CohortFormErrors {
    const apiError = error as ApiError;
    const message = apiError.response?.data?.message || apiError.message || fallback;
    const messages = Array.isArray(message) ? message : [message];
    const nextErrors: CohortFormErrors = {};

    messages.forEach((item) => {
        const text = String(item);
        const normalized = text.toLowerCase();
        if (normalized.includes('name')) nextErrors.name = text;
        else if (normalized.includes('code')) nextErrors.code = text;
        else if (normalized.includes('cycle')) nextErrors.academicCycleId = text;
        else nextErrors.general = text;
    });

    return nextErrors;
}

export function CohortFormPage({ mode, cohort, returnTo }: CohortFormPageProps) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const isEdit = mode === 'edit';
    const processingId = isEdit ? 'cohort-update' : 'cohort-create';
    const destination = returnTo || (cohort ? `/cohorts/${cohort.id}` : '/cohorts');

    const [formData, setFormData] = useState<CohortFormData>(() => getInitialFormData(cohort));
    const [formErrors, setFormErrors] = useState<CohortFormErrors>({});

    const cyclesKey = token ? ['academicCycles', { limit: 100 }] as const : null;
    const { data: cyclesData } = useSWR<{ data: AcademicCycle[] }>(cyclesKey);
    const studentsKey = token ? ['students', { limit: 1000 }] as const : null;
    const { data: studentsData } = useSWR<{ data: Student[] }>(studentsKey);
    const sectionsKey = token ? ['sections', { limit: 1000 }] as const : null;
    const { data: sectionsData } = useSWR<{ data: Section[] }>(sectionsKey);

    useEffect(() => {
        if (!user) return;
        if (user.role !== Role.ORG_ADMIN && user.role !== Role.SUB_ADMIN) {
            router.replace('/cohorts');
        }
    }, [router, user]);

    useEffect(() => {
        setFormData(getInitialFormData(cohort));
    }, [cohort]);

    const students = useMemo(() => studentsData?.data || [], [studentsData?.data]);
    const sections = useMemo(() => sectionsData?.data || [], [sectionsData?.data]);
    const filteredSections = useMemo(() => {
        if (!formData.academicCycleId) return sections;
        return sections.filter((section) => section.academicCycleId === formData.academicCycleId);
    }, [formData.academicCycleId, sections]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData((current) => ({ ...current, [name]: value }));
    };

    const handleCycleChange = (academicCycleId: string) => {
        setFormData((current) => ({
            ...current,
            academicCycleId,
            sectionIds: current.sectionIds.filter((sectionId) => {
                const section = sections.find((item) => item.id === sectionId);
                return section?.academicCycleId === academicCycleId;
            }),
        }));
    };

    const validate = () => {
        const nextErrors: CohortFormErrors = {};
        if (!formData.academicCycleId) nextErrors.academicCycleId = 'Academic Cycle is required';
        if (!formData.name.trim()) nextErrors.name = 'Cohort Name is required';
        if (!formData.code.trim()) nextErrors.code = 'Cohort Code is required';
        setFormErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setFormErrors({});
        if (!validate() || !token) return;

        const payload: CreateCohortDto = {
            name: formData.name,
            code: formData.code,
            academicCycleId: formData.academicCycleId,
            studentIds: formData.studentIds,
            sectionIds: formData.sectionIds,
        };

        dispatch({ type: 'UI_START_PROCESSING', payload: processingId });

        try {
            if (isEdit && cohort) {
                await api.cohorts.updateCohort(cohort.id, payload satisfies UpdateCohortDto, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Cohort updated successfully', type: 'success' } });
                mutate(['cohort', cohort.id]);
            } else {
                await api.cohorts.createCohort(payload, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Cohort created successfully', type: 'success' } });
                window.dispatchEvent(new Event('stats-updated'));
            }

            mutate(matchesCacheKeyPrefix('cohorts'));
            router.push(destination);
        } catch (error: unknown) {
            setFormErrors(parseFormErrors(error, isEdit ? 'Failed to update cohort' : 'Failed to create cohort'));
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: processingId });
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col py-10 animate-in fade-in duration-700">
            <PageHeader
                title={isEdit ? 'Edit Cohort' : 'Create New Cohort'}
                description={<>Group students for enrollment and promotions. <DocsLink href="/docs/cohorts-promotions#cohorts">Read cohort docs</DocsLink></>}
                icon={Users}
                className="mb-8"
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics', href: '/cohorts' },
                    { label: isEdit ? 'Edit Cohort' : 'Create Cohort' },
                ]}
            />

            <div className="flex flex-col items-start gap-8 lg:flex-row">
                <div className="w-full space-y-6 lg:w-1/3">
                    <div className="group relative overflow-hidden rounded-2xl border border-primary/10 bg-primary/5 p-6 backdrop-blur-xl md:p-8">
                        <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl transition-all duration-700 group-hover:bg-primary/20" />
                        <h3 className="relative z-10 mb-4 text-lg font-black tracking-tight">Cohort Organization</h3>
                        <p className="relative z-10 mb-6 text-sm leading-relaxed text-muted-foreground">
                            Cohorts are student groups inside an academic cycle. They help with bulk enrollment and promotions. <DocsLink href="/docs/cohorts-promotions#cohorts">Learn more</DocsLink>
                        </p>
                        <div className="relative z-10 space-y-4">
                            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-3">
                                <div className="rounded-lg bg-warning/10 p-2"><Calendar className="h-4 w-4 text-warning" /></div>
                                <span className="text-xs font-bold">Cycle-specific grouping</span>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-3">
                                <div className="rounded-lg bg-primary/10 p-2"><GraduationCap className="h-4 w-4 text-primary" /></div>
                                <span className="text-xs font-bold">Bulk enrollment support</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-xl shadow-primary/5">
                        <div className="mb-4 flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-primary opacity-50" />
                            <h4 className="text-sm font-black uppercase tracking-tight">Fast Setup</h4>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                                <span>Choose a cycle, then sections from that cycle.</span>
                            </li>
                            <li className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                                <span>Selected students are enrolled into all assigned sections.</span>
                            </li>
                            <li className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                                <span>Assigned sections are pre-selected when editing.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="w-full flex-1">
                    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-2xl shadow-primary/5 backdrop-blur-2xl">
                        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />

                        <form onSubmit={handleSubmit} className="relative space-y-8 p-6 md:p-10" noValidate>
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <Label className="ml-1 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Academic Context</Label>
                                    <div className="space-y-2">
                                        <Label className="ml-1 text-sm font-bold">Academic Cycle <span className="text-primary">*</span></Label>
                                        <CustomSelect
                                            value={formData.academicCycleId}
                                            onChange={handleCycleChange}
                                            icon={Calendar}
                                            options={cyclesData?.data?.map((cycle) => ({ value: cycle.id, label: cycle.code ? `${cycle.code} - ${cycle.name}` : cycle.name })) || []}
                                            placeholder="Select academic cycle..."
                                            required
                                            error={!!formErrors.academicCycleId}
                                        />
                                        {formErrors.academicCycleId && <p className="ml-1 mt-1 text-xs font-semibold text-danger">{formErrors.academicCycleId}</p>}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="ml-1 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Cohort Identity</Label>
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="ml-1 text-sm font-bold">Cohort Name <span className="text-primary">*</span></Label>
                                            <Input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                                icon={Users}
                                                placeholder="e.g. Grade 10 - Science Stream"
                                                error={!!formErrors.name}
                                                className="h-12 font-medium md:h-14"
                                            />
                                            {formErrors.name && <p className="ml-1 mt-1 text-xs font-semibold text-danger">{formErrors.name}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="ml-1 text-sm font-bold">Cohort Code <span className="text-primary">*</span></Label>
                                            <Input
                                                type="text"
                                                name="code"
                                                value={formData.code}
                                                onChange={handleChange}
                                                required
                                                icon={Hash}
                                                placeholder="e.g. GRADE-9"
                                                error={!!formErrors.code}
                                                className="h-12 font-medium uppercase md:h-14"
                                            />
                                            {formErrors.code && <p className="ml-1 mt-1 text-xs font-semibold text-danger">{formErrors.code}</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="ml-1 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Assignments</Label>
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="ml-1 text-sm font-bold">Students</Label>
                                            <CustomMultiSelect
                                                values={formData.studentIds}
                                                onChange={(values) => setFormData((current) => ({ ...current, studentIds: values }))}
                                                icon={GraduationCap}
                                                options={students.map((student) => ({ value: student.id, label: `${student.registrationNumber || 'No registration'} - ${student.user?.name || 'Unknown'}` }))}
                                                placeholder="Select students to add..."
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="ml-1 text-sm font-bold">Sections</Label>
                                            <CustomMultiSelect
                                                values={formData.sectionIds}
                                                onChange={(values) => setFormData((current) => ({ ...current, sectionIds: values }))}
                                                icon={BookOpen}
                                                options={filteredSections.map((section) => ({
                                                    value: section.id,
                                                    label: formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name }),
                                                }))}
                                                placeholder="Select sections to assign..."
                                                disabled={!formData.academicCycleId}
                                            />
                                            {!formData.academicCycleId && (
                                                <p className="ml-1 mt-1 text-xs font-semibold text-muted-foreground">Select an academic cycle first</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {formErrors.general && (
                                <div className="flex animate-in items-center rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold text-danger slide-in-from-top-2">
                                    <AlertCircle className="mr-3 h-5 w-5 shrink-0" />
                                    {formErrors.general}
                                </div>
                            )}

                            <div className="flex flex-col items-center justify-end gap-4 border-t border-border/50 pt-8 sm:flex-row">
                                <Link href={destination} className="w-full sm:w-auto">
                                    <Button type="button" variant="secondary" className="h-12 w-full font-bold tracking-tight sm:px-10">
                                        Cancel
                                    </Button>
                                </Link>
                                <Button
                                    type="submit"
                                    loadingId={processingId}
                                    className="h-12 w-full font-black tracking-tight shadow-lg shadow-primary/20 sm:px-12"
                                >
                                    {isEdit ? 'Save Changes' : 'Create Cohort'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
