'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, AlertCircle, CheckCircle2, Hash } from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import useSWR, { mutate } from 'swr';
import { useGlobal } from '@/context/GlobalContext';
import Link from 'next/link';
import { ApiError, GpaPolicy, Role } from '@/types';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DocsLink } from '@/components/ui/DocsLink';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageShell';

export default function CreateAcademicCyclePage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        startDate: '',
        endDate: '',
        isActive: false,
        gpaPolicyId: '',
    });

    useEffect(() => {
        if (!user) return;

        if (user.role !== Role.ORG_ADMIN && user.role !== Role.SUB_ADMIN) {
            router.replace('/academic-cycles');
        }
    }, [user, router]);

    const [formErrors, setFormErrors] = useState<{ name?: string; code?: string; startDate?: string; endDate?: string; general?: string }>({});
    const { data: gpaPolicies = [] } = useSWR<GpaPolicy[]>(
        token ? ['gpaPolicies', 'cycle-create', token] : null,
        () => api.org.getGpaPolicies(token!),
    );

    useEffect(() => {
        if (formData.gpaPolicyId || gpaPolicies.length === 0) return;
        const defaultPolicy = gpaPolicies.find((policy) => policy.isDefault) || gpaPolicies[0];
        setFormData((current) => ({ ...current, gpaPolicyId: defaultPolicy.id }));
    }, [formData.gpaPolicyId, gpaPolicies]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormErrors({});

        let hasError = false;
        if (!formData.name) {
            setFormErrors(prev => ({ ...prev, name: 'Cycle Name is required' }));
            hasError = true;
        }
        if (!formData.code) {
            setFormErrors(prev => ({ ...prev, code: 'Cycle Code is required' }));
            hasError = true;
        }
        if (!formData.startDate) {
            setFormErrors(prev => ({ ...prev, startDate: 'Start Date is required' }));
            hasError = true;
        }
        if (!formData.endDate) {
            setFormErrors(prev => ({ ...prev, endDate: 'End Date is required' }));
            hasError = true;
        }
        if (formData.startDate && formData.endDate && new Date(formData.endDate) <= new Date(formData.startDate)) {
            setFormErrors(prev => ({ ...prev, endDate: 'End Date must be after Start Date' }));
            hasError = true;
        }

        if (hasError) return;

        dispatch({ type: 'UI_START_PROCESSING', payload: 'cycle-create' });

        try {
            if (!token) return;

            await api.academicCycles.createCycle(formData, token);
            mutate((key) => Array.isArray(key) && key[0] === 'academicCycles');

            window.dispatchEvent(new Event('stats-updated'));
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Academic Cycle created successfully', type: 'success' } });
            router.push('/academic-cycles');
        } catch (error: unknown) {
            const apiError = error as ApiError;
            const message = apiError.response?.data?.message || apiError.message || 'Failed to create academic cycle';
            const newErrors: typeof formErrors = {};

            if (Array.isArray(message)) {
                message.forEach((m: string) => {
                    const msg = m.toLowerCase();
                    if (msg.includes('name')) newErrors.name = m;
                    else if (msg.includes('code')) newErrors.code = m;
                    else if (msg.includes('start')) newErrors.startDate = m;
                    else if (msg.includes('end')) newErrors.endDate = m;
                    else newErrors.general = m;
                });
            } else {
                const msgStr = message;
                if (msgStr.toLowerCase().includes('name')) newErrors.name = msgStr;
                else if (msgStr.toLowerCase().includes('code')) newErrors.code = msgStr;
                else if (msgStr.toLowerCase().includes('start')) newErrors.startDate = msgStr;
                else if (msgStr.toLowerCase().includes('end')) newErrors.endDate = msgStr;
                else newErrors.general = msgStr;
            }
            setFormErrors(newErrors);
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'cycle-create' });
        }
    };

    return (
        <div className="flex flex-col w-full max-w-6xl py-10 mx-auto animate-in fade-in duration-700">
            <PageHeader
                title="Create New Academic Cycle"
                description={<>Define a new academic period for your institution. <DocsLink href="/docs/academic-cycles#gpa-policy-selection">Read cycle policy docs</DocsLink></>}
                icon={Calendar}
                className="mb-8"
            />

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Left Side: Info Card */}
                <div className="w-full lg:w-1/3 space-y-6">
                    <div className="bg-primary/5 backdrop-blur-xl rounded-2xl border border-primary/10 p-6 md:p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-700" />
                        <h3 className="text-lg font-black tracking-tight mb-4 relative z-10">Academic Period</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed relative z-10 mb-6">
                            Academic cycles represent time-bound periods like semesters, trimesters, or full academic years. <DocsLink href="/docs/academic-cycles#cycle-purpose">Learn more</DocsLink>
                        </p>
                        <div className="space-y-4 relative z-10">
                            <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50">
                                <div className="p-2 bg-warning/10 rounded-lg"><Clock className="w-4 h-4 text-warning" /></div>
                                <span className="text-xs font-bold">Time-bound organization</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50">
                                <div className="p-2 bg-primary/10 rounded-lg"><CheckCircle2 className="w-4 h-4 text-primary" /></div>
                                <span className="text-xs font-bold">Data isolation per cycle</span>
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
                                <span>Unique cycle code for CSV imports</span>
                            </li>
                            <li className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                                <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span>End date must be after start date</span>
                            </li>
                            <li className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                                <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span>Only one cycle can be active at a time</span>
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
                                {/* Cycle Details Section */}
                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Cycle Information</Label>
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Cycle Name <span className="text-primary">*</span></Label>
                                            <Input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                                icon={Calendar}
                                                placeholder="e.g. Fall 2025, Academic Year 2025-2026"
                                                error={!!formErrors.name}
                                                className="h-12 md:h-14 font-medium"
                                            />
                                            {formErrors.name && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.name}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Cycle Code <span className="text-primary">*</span></Label>
                                            <Input
                                                type="text"
                                                name="code"
                                                value={formData.code}
                                                onChange={handleChange}
                                                required
                                                icon={Hash}
                                                placeholder="e.g. 2026-SPRING"
                                                error={!!formErrors.code}
                                                className="h-12 md:h-14 font-medium uppercase"
                                            />
                                            {formErrors.code && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.code}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Date Range Section */}
                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Date Range</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Start Date <span className="text-primary">*</span></Label>
                                            <Input
                                                type="date"
                                                name="startDate"
                                                value={formData.startDate}
                                                onChange={handleChange}
                                                required
                                                icon={Clock}
                                                error={!!formErrors.startDate}
                                                className="h-12 md:h-14 font-medium"
                                            />
                                            {formErrors.startDate && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.startDate}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">End Date <span className="text-primary">*</span></Label>
                                            <Input
                                                type="date"
                                                name="endDate"
                                                value={formData.endDate}
                                                onChange={handleChange}
                                                required
                                                icon={Clock}
                                                error={!!formErrors.endDate}
                                                className="h-12 md:h-14 font-medium"
                                            />
                                            {formErrors.endDate && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.endDate}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Activation Section */}
                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">GPA Policy</Label>
                                    <div className="space-y-3 rounded-xl border border-warning/35 bg-warning/10 p-4">
                                        <StatusBanner
                                            variant="warning"
                                            icon={AlertCircle}
                                            title="Choose carefully"
                                            description={<>The GPA policy locks after finalized grades. <DocsLink href="/docs/gpa-policies#policy-locking">Read before choosing</DocsLink></>}
                                            className="shadow-none"
                                        />
                                        <CustomSelect
                                            value={formData.gpaPolicyId}
                                            onChange={(value) => setFormData({ ...formData, gpaPolicyId: value })}
                                            options={gpaPolicies.map((policy) => ({
                                                value: policy.id,
                                                label: `${policy.name}${policy.isDefault ? ' (Default)' : ''}`,
                                            }))}
                                            placeholder="Select GPA policy"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Activation Section */}
                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Activation</Label>
                                    <div className="p-4 bg-background/50 rounded-xl border border-border/50">
                                        <Toggle
                                            checked={formData.isActive}
                                            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                                            label="Set as Active Cycle"
                                            description={<>This deactivates the current active cycle. <DocsLink href="/docs/academic-cycles#active-cycle">Details</DocsLink></>}
                                            size="md"
                                        />
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
                                <Link href="/academic-cycles" className="w-full sm:w-auto">
                                    <Button type="button" variant="secondary" className="w-full sm:px-10 h-12 font-bold tracking-tight">
                                        Cancel
                                    </Button>
                                </Link>
                                <Button
                                    type="submit"
                                    loadingId="cycle-create"
                                    className="w-full sm:px-12 h-12 font-black tracking-tight shadow-lg shadow-primary/20"
                                >
                                    Create Cycle
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
