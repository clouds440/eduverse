'use client';

import { useState, type Dispatch } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { AcademicCycle, Cohort, Role, ApiError } from '@/types';
import useSWR from 'swr';
import { Loading } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/ErrorState';
import { ArrowRight, Copy, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useGlobal, type GlobalAction } from '@/context/GlobalContext';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Toggle } from '@/components/ui/Toggle';

export default function PromotionsPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();

    const [activeTab, setActiveTab] = useState<'copy-forward' | 'promote'>('copy-forward');

    const cyclesKey = token ? ['academicCycles', { limit: 100 }] as const : null;
    const { data: cyclesData, isLoading, error } = useSWR<{ data: AcademicCycle[] }>(cyclesKey);

    const cohortsKey = token ? ['cohorts', { limit: 500 }] as const : null;
    const { data: cohortsData } = useSWR<{ data: Cohort[] }>(cohortsKey);

    if (!token) return <Loading className="h-full" text="Authenticating..." />;
    if (isLoading && !cyclesData) return <Loading className="h-full" text="Loading Requirements..." />;
    if (error) return <ErrorState error={error} onRetry={() => {}} />;
    
    if (user?.role !== Role.ORG_ADMIN && user?.role !== Role.ORG_MANAGER) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">You do not have permission to access this page.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full p-4 md:p-8 overflow-y-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-3 rounded-full">
                    <ArrowRight className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Academic Transitions</h1>
                    <p className="text-sm text-muted-foreground">Copy forward structures and promote cohorts to the next cycle.</p>
                </div>
            </div>

            <div className="flex gap-4 border-b border-border">
                <button
                    className={`pb-2 px-4 flex items-center gap-2 font-medium transition-colors ${activeTab === 'copy-forward' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setActiveTab('copy-forward')}
                >
                    <Copy className="w-4 h-4" /> Copy Forward System
                </button>
                <button
                    className={`pb-2 px-4 flex items-center gap-2 font-medium transition-colors ${activeTab === 'promote' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setActiveTab('promote')}
                >
                    <Users className="w-4 h-4" /> Cohort Promotion
                </button>
            </div>

            <div className="flex-1 max-w-4xl">
                {activeTab === 'copy-forward' ? (
                    <CopyForwardView cycles={cyclesData?.data || []} token={token} dispatch={dispatch} />
                ) : (
                    <PromotionView cycles={cyclesData?.data || []} cohorts={cohortsData?.data || []} token={token} dispatch={dispatch} />
                )}
            </div>
        </div>
    );
}

function CopyForwardView({ cycles, token, dispatch }: { cycles: AcademicCycle[], token: string, dispatch: Dispatch<GlobalAction> }) {
    const [fromCycleId, setFromCycleId] = useState('');
    const [toCycleId, setToCycleId] = useState('');
    const [options, setOptions] = useState({ copySchedules: true, copyAssessments: false, copyMaterials: false });
    const [isExecuting, setIsExecuting] = useState(false);

    const handleCopyForward = async () => {
        if (!fromCycleId || !toCycleId) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Please select both Source and Target cycles.', type: 'error' } });
            return;
        }
        if (fromCycleId === toCycleId) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Source and Target cycles must be different.', type: 'error' } });
            return;
        }

        setIsExecuting(true);
        dispatch({ type: 'UI_START_PROCESSING', payload: 'copy-forward' });
        try {
            const res = await api.copyForward.execute({ fromCycleId, toCycleId, options }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: `Copy forward successful. Copied ${res.sectionsCopied} sections.`, type: 'success' } });
            setFromCycleId('');
            setToCycleId('');
        } catch (err: unknown) {
            const apiError = err as ApiError;
            const rawMessage = apiError?.response?.data?.message || apiError?.message || 'Error processing request';
            const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            setIsExecuting(false);
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'copy-forward' });
        }
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
            <div>
                <h2 className="text-lg font-bold">Copy Forward Tool</h2>
                <p className="text-sm text-muted-foreground mt-1">Clone sections, schedules, and materials from an old academic cycle to a new one.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-semibold">Source Cycle</label>
                    <CustomSelect
                        options={cycles.map(c => ({ value: c.id, label: c.name }))}
                        value={fromCycleId}
                        onChange={(val) => setFromCycleId(val)}
                        placeholder="Select Source Cycle"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-semibold">Target Cycle</label>
                    <CustomSelect
                        options={cycles.map(c => ({ value: c.id, label: c.name }))}
                        value={toCycleId}
                        onChange={(val) => setToCycleId(val)}
                        placeholder="Select Target Cycle"
                    />
                </div>
            </div>

            <div className="space-y-3 bg-muted/20 p-4 rounded-lg border border-border">
                <h3 className="font-semibold text-sm">Copy Options</h3>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Copy Sections</span>
                    <Toggle checked={true} onCheckedChange={() => {}} disabled />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Copy Timetables & Schedules</span>
                    <Toggle checked={options.copySchedules} onCheckedChange={(val) => setOptions({ ...options, copySchedules: val })} />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Copy Course Materials & Links</span>
                    <Toggle checked={options.copyMaterials} onCheckedChange={(val) => setOptions({ ...options, copyMaterials: val })} />
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <Button onClick={handleCopyForward} disabled={isExecuting} icon={Copy}>
                    {isExecuting ? 'Executing Copy Forward...' : 'Execute Copy Forward'}
                </Button>
            </div>
        </div>
    );
}

function PromotionView({ cycles, cohorts, token, dispatch }: { cycles: AcademicCycle[], cohorts: Cohort[], token: string, dispatch: Dispatch<GlobalAction> }) {
    const [originCohortId, setOriginCohortId] = useState('');
    const [targetCycleId, setTargetCycleId] = useState('');
    const [targetCohortId, setTargetCohortId] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);

    const handlePromote = async () => {
        if (!originCohortId || !targetCycleId || !targetCohortId) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Please select Origin Cohort, Target Cycle, and Target Cohort.', type: 'error' } });
            return;
        }

        const originCohort = cohorts.find(c => c.id === originCohortId);
        if (!originCohort || !originCohort.students || originCohort.students.length === 0) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Origin cohort has no students to promote.', type: 'error' } });
            return;
        }

        const studentIds = originCohort.students.map(s => s.id);

        setIsExecuting(true);
        dispatch({ type: 'UI_START_PROCESSING', payload: 'promote' });
        try {
            const res = await api.promotions.promoteStudents({ studentIds, fromCycleId: originCohort.academicCycleId, toCycleId: targetCycleId, toCohortId: targetCohortId }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: res.message, type: 'success' } });
        } catch (err: unknown) {
            const apiError = err as ApiError;
            const rawMessage = apiError?.response?.data?.message || apiError?.message || 'Error processing request';
            const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            setIsExecuting(false);
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'promote' });
        }
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
            <div>
                <h2 className="text-lg font-bold">Cohort Promotion</h2>
                <p className="text-sm text-muted-foreground mt-1">Bulk promote an entire cohort of students to a new academic cycle and target cohort.</p>
            </div>

            <div className="space-y-6">
                <div className="space-y-2 bg-primary/5 p-4 rounded-lg border border-primary/20">
                    <label className="text-sm font-semibold text-primary uppercase tracking-wider">Step 1: Select Origin Cohort</label>
                    <CustomSelect
                        options={cohorts.map(c => ({ value: c.id, label: `${c.name} (${c.academicCycle?.name || 'No Cycle'})` }))}
                        value={originCohortId}
                        onChange={(val) => setOriginCohortId(val)}
                        placeholder="Select Cohort to Promote"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20 p-4 rounded-lg border border-border">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold uppercase tracking-wider">Step 2: Target Cycle</label>
                        <CustomSelect
                            options={cycles.map(c => ({ value: c.id, label: c.name }))}
                            value={targetCycleId}
                            onChange={(val) => setTargetCycleId(val)}
                            placeholder="Select Target Cycle"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold uppercase tracking-wider">Step 3: Target Cohort</label>
                        <CustomSelect
                            options={cohorts.filter(c => c.academicCycleId === targetCycleId).map(c => ({ value: c.id, label: c.name }))}
                            value={targetCohortId}
                            onChange={(val) => setTargetCohortId(val)}
                            placeholder="Select Target Cohort"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <Button onClick={handlePromote} disabled={isExecuting} icon={Users}>
                    {isExecuting ? 'Promoting Students...' : 'Promote Cohort'}
                </Button>
            </div>
        </div>
    );
}
