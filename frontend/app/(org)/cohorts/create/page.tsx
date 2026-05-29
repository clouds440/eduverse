'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Users, Calendar, GraduationCap, AlertCircle, BookOpen } from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { useGlobal } from '@/context/GlobalContext';
import Link from 'next/link';
import { ApiError, Role, AcademicCycle, Student, Section } from '@/types';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageShell';

export default function CreateCohortPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: '',
        academicCycleId: '',
        studentIds: [] as string[],
        sectionIds: [] as string[]
    });

    const cyclesKey = token ? ['academicCycles', { limit: 100 }] as const : null;
    const { data: cyclesData } = useSWR<{ data: AcademicCycle[] }>(cyclesKey);

    const studentsKey = token ? ['students', { limit: 1000 }] as const : null;
    const { data: studentsData } = useSWR<{ data: Student[] }>(studentsKey);

    const sectionsKey = token ? ['sections', { limit: 1000 }] as const : null;
    const { data: sectionsData } = useSWR<{ data: Section[] }>(sectionsKey);

    useEffect(() => {
        if (!user) return;

        // Teachers should not be able to create cohorts
        if (user.role === Role.TEACHER) {
            router.replace('/cohorts');
        }
    }, [user, router]);

    const [formErrors, setFormErrors] = useState<{ name?: string; academicCycleId?: string; general?: string }>({});

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormErrors({});

        let hasError = false;
        if (!formData.academicCycleId) {
            setFormErrors(prev => ({ ...prev, academicCycleId: 'Academic Cycle is required' }));
            hasError = true;
        }
        if (!formData.name) {
            setFormErrors(prev => ({ ...prev, name: 'Cohort Name is required' }));
            hasError = true;
        }

        if (hasError) return;

        dispatch({ type: 'UI_START_PROCESSING', payload: 'cohort-create' });

        try {
            if (!token) return;

            await api.cohorts.createCohort(formData, token);
            mutate((key) => Array.isArray(key) && key[0] === 'cohorts');

            window.dispatchEvent(new Event('stats-updated'));
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Cohort created successfully', type: 'success' } });
            router.push('/cohorts');
        } catch (error: unknown) {
            const apiError = error as ApiError;
            const message = apiError.response?.data?.message || apiError.message || 'Failed to create cohort';
            const newErrors: typeof formErrors = {};

            if (Array.isArray(message)) {
                message.forEach((m: string) => {
                    const msg = m.toLowerCase();
                    if (msg.includes('name')) newErrors.name = m;
                    else if (msg.includes('cycle')) newErrors.academicCycleId = m;
                    else newErrors.general = m;
                });
            } else {
                const msgStr = message;
                if (msgStr.toLowerCase().includes('name')) newErrors.name = msgStr;
                else if (msgStr.toLowerCase().includes('cycle')) newErrors.academicCycleId = msgStr;
                else newErrors.general = msgStr;
            }
            setFormErrors(newErrors);
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'cohort-create' });
        }
    };

    const students = studentsData?.data || [];
    const sections = sectionsData?.data || [];
    const filteredSections = formData.academicCycleId
        ? sections.filter((s: Section) => s.academicCycleId === formData.academicCycleId)
        : sections;

    return (
        <div className="flex flex-col w-full max-w-6xl py-10 mx-auto animate-in fade-in duration-700">
            <PageHeader
                title="Create New Cohort"
                description="Group students for streamlined management."
                icon={Users}
                className="mb-8"
            />

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Left Side: Info Card */}
                <div className="w-full lg:w-1/3 space-y-6">
                    <div className="bg-primary/5 backdrop-blur-xl rounded-2xl border border-primary/10 p-6 md:p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-700" />
                        <h3 className="text-lg font-black tracking-tight mb-4 relative z-10">Cohort Organization</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed relative z-10 mb-6">
                            Cohorts are student groups within an academic cycle. They enable bulk enrollment, promotions, and simplified section assignments.
                        </p>
                        <div className="space-y-4 relative z-10">
                            <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50">
                                <div className="p-2 bg-warning/10 rounded-lg"><Calendar className="w-4 h-4 text-warning" /></div>
                                <span className="text-xs font-bold">Cycle-specific grouping</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50">
                                <div className="p-2 bg-primary/10 rounded-lg"><GraduationCap className="w-4 h-4 text-primary" /></div>
                                <span className="text-xs font-bold">Bulk enrollment support</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border/50 rounded-2xl p-6 relative overflow-hidden shadow-xl shadow-primary/5">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertCircle className="w-5 h-5 text-primary opacity-50" />
                            <h4 className="text-sm font-black tracking-tight uppercase">Requirements</h4>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                                <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span>Must belong to an Academic Cycle</span>
                            </li>
                            <li className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                                <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span>Unique cohort name within cycle</span>
                            </li>
                            <li className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                                <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span>Students can be added later</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Right Side: Form Card */}
                <div className="flex-1 w-full">
                    <div className="bg-card/40 backdrop-blur-2xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden relative">
                        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />

                        <form onSubmit={handleSubmit} className="relative p-6 md:p-10 space-y-8" noValidate>
                            <div className="space-y-8">
                                {/* Academic Context Section */}
                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Academic Context</Label>
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Academic Cycle <span className="text-primary">*</span></Label>
                                            <CustomSelect
                                                value={formData.academicCycleId}
                                                onChange={(value) => setFormData({ ...formData, academicCycleId: value, studentIds: [], sectionIds: [] })}
                                                icon={Calendar}
                                                options={cyclesData?.data?.map((c: AcademicCycle) => ({ value: c.id, label: c.name })) || []}
                                                placeholder="Select academic cycle..."
                                                required
                                                error={!!formErrors.academicCycleId}
                                            />
                                            {formErrors.academicCycleId && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.academicCycleId}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Cohort Details Section */}
                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Cohort Identity</Label>
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Cohort Name <span className="text-primary">*</span></Label>
                                            <Input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                                icon={Users}
                                                placeholder="e.g. Grade 10 - Science Stream"
                                                error={!!formErrors.name}
                                                className="h-12 md:h-14 font-medium"
                                            />
                                            {formErrors.name && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.name}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Assignments Section */}
                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Initial Assignments (Optional)</Label>
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Add Students</Label>
                                            <CustomMultiSelect
                                                values={formData.studentIds}
                                                onChange={(values) => setFormData({ ...formData, studentIds: values })}
                                                icon={GraduationCap}
                                                options={students.map((s: Student) => ({ value: s.id, label: `${s.registrationNumber} - ${s.user?.name || 'Unknown'}` }))}
                                                placeholder="Select students to add..."
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Assign Sections</Label>
                                            <CustomMultiSelect
                                                values={formData.sectionIds}
                                                onChange={(values) => setFormData({ ...formData, sectionIds: values })}
                                                icon={BookOpen}
                                                options={filteredSections.map((s: Section) => ({ value: s.id, label: `${s.name} - ${s.course?.name || 'Unknown'}` }))}
                                                placeholder="Select sections to assign..."
                                                disabled={!formData.academicCycleId}
                                            />
                                            {!formData.academicCycleId && (
                                                <p className="mt-1 text-xs text-muted-foreground font-semibold ml-1">Select an academic cycle first</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {formErrors.general && (
                                <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl flex items-center text-sm font-bold animate-in slide-in-from-top-2">
                                    <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                                    {formErrors.general}
                                </div>
                            )}

                            <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-end gap-4">
                                <Link href="/cohorts" className="w-full sm:w-auto">
                                    <Button type="button" variant="secondary" className="w-full sm:px-10 h-12 font-bold tracking-tight">
                                        Cancel
                                    </Button>
                                </Link>
                                <Button
                                    type="submit"
                                    loadingId="cohort-create"
                                    className="w-full sm:px-12 h-12 font-black tracking-tight shadow-lg shadow-primary/20"
                                >
                                    Create Cohort
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
