'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { ArrowDownToLine, ArrowUpToLine, Calculator, Plus, ListRestart, Save, Star, Trash2, Trophy } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { StatusBanner } from '@/components/ui/StatusBanner';
import {
    ApiError,
    GpaGradeRule,
    GpaPolicy,
    GpaPolicyPreviewResponse,
} from '@/types';
import { GpaCalculationMethod, GpaRounding, Role } from '@/types/enums';

const STANDARD_RULES: GpaGradeRule[] = [
    { min: 85, max: 100, letter: 'A', points: 4.0 },
    { min: 80, max: 84.99, letter: 'A-', points: 3.7 },
    { min: 75, max: 79.99, letter: 'B+', points: 3.3 },
    { min: 70, max: 74.99, letter: 'B', points: 3.0 },
    { min: 65, max: 69.99, letter: 'B-', points: 2.7 },
    { min: 60, max: 64.99, letter: 'C+', points: 2.3 },
    { min: 55, max: 59.99, letter: 'C', points: 2.0 },
    { min: 50, max: 54.99, letter: 'D', points: 1.0 },
    { min: 0, max: 49.99, letter: 'F', points: 0 },
];
const MARK_GAP = 0.01;
const MARK_EPSILON = 0.000001;
const DESIRED_INSERT_SPAN = 4.99;
const MIN_REMAINING_SPAN = 1;
const NEW_POLICY_ID = '__new_policy__';

type PolicyDraft = {
    id?: string;
    name: string;
    scale: string;
    method: GpaCalculationMethod;
    rounding: GpaRounding;
    gradeRules: DraftGpaGradeRule[];
    isDefault: boolean;
};

type DraftGpaGradeRule = Omit<GpaGradeRule, 'min' | 'max' | 'points'> & {
    localId?: string;
    min: number | string;
    max: number | string;
    points: number | string;
};

function createRuleId() {
    return `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDraftRule(rule: GpaGradeRule | DraftGpaGradeRule): DraftGpaGradeRule {
    return { ...rule, localId: ('localId' in rule ? rule.localId : undefined) || createRuleId() };
}

function newDraft(): PolicyDraft {
    return {
        name: 'Standard 4.0',
        scale: '4',
        method: GpaCalculationMethod.WEIGHTED_BY_CREDIT_HOURS,
        rounding: GpaRounding.TWO_DECIMALS,
        gradeRules: STANDARD_RULES.map(toDraftRule),
        isDefault: false,
    };
}

function draftFromPolicy(policy: GpaPolicy): PolicyDraft {
    return {
        id: policy.id,
        name: policy.name,
        scale: String(policy.scale),
        method: policy.method,
        rounding: policy.rounding,
        gradeRules: policy.gradeRules.map(toDraftRule),
        isDefault: policy.isDefault,
    };
}

function getComparableDraft(draft: PolicyDraft) {
    return {
        id: draft.id || '',
        name: draft.name.trim(),
        scale: Number(draft.scale),
        method: draft.method,
        rounding: draft.rounding,
        isDefault: draft.isDefault,
        gradeRules: draft.gradeRules.map((rule) => ({
            min: parseNumericInput(rule.min),
            max: parseNumericInput(rule.max),
            letter: rule.letter.trim(),
            points: parseNumericInput(rule.points),
        })),
    };
}

function areDraftsEqual(first: PolicyDraft, second: PolicyDraft) {
    return JSON.stringify(getComparableDraft(first)) === JSON.stringify(getComparableDraft(second));
}

function getApiErrorMessage(error: unknown, fallback: string) {
    const apiError = error as ApiError;
    const responseMessage = apiError?.response?.data?.message;
    if (Array.isArray(responseMessage)) return responseMessage.join(' ');
    return responseMessage || apiError?.message || fallback;
}

function validateDraft(draft: PolicyDraft) {
    const scale = Number(draft.scale);
    if (!draft.name.trim()) return 'Policy name is required.';
    if (!Number.isFinite(scale) || scale <= 0) return 'GPA scale must be greater than zero.';
    if (draft.gradeRules.length === 0) return 'Add at least one grade rule.';

    const rules = draft.gradeRules.map((rule) => ({
        ...rule,
        min: parseNumericInput(rule.min),
        max: parseNumericInput(rule.max),
        points: parseNumericInput(rule.points),
    }));

    for (const rule of rules) {
        if (!rule.letter.trim()) return 'Each grade rule needs a letter grade.';
        if (![rule.min, rule.max, rule.points].every(Number.isFinite)) return 'Grade rule values must be numbers.';
        if (rule.min < 0 || rule.max > 100 || rule.min > rule.max) return 'Grade ranges must stay within 0-100 and min cannot exceed max.';
        if (rule.points < 0 || rule.points > scale) return 'Grade points must stay within the GPA scale.';
    }

    const sorted = [...rules].sort((a, b) => a.min - b.min);

    if (sorted[0].min > 0) {
        return `Grade rules must cover marks from 0 to 100. Missing 0-${roundMark(sorted[0].min - MARK_GAP)}.`;
    }

    for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        if (current.min <= previous.max) return 'Grade ranges cannot overlap.';
        if (current.min - previous.max > MARK_GAP + MARK_EPSILON) {
            return `Grade rules must not skip mark ranges. Missing ${roundMark(previous.max + MARK_GAP)}-${roundMark(current.min - MARK_GAP)}.`;
        }
        if (current.points < previous.points) {
            return `Grade points cannot decrease as marks increase. ${current.letter} has fewer points than ${previous.letter}.`;
        }
    }

    const lastRule = sorted[sorted.length - 1];
    if (lastRule.max < 100) {
        return `Grade rules must cover marks from 0 to 100. Missing ${roundMark(lastRule.max + MARK_GAP)}-100.`;
    }

    return null;
}

function roundMark(value: number) {
    return Number(value.toFixed(2));
}

function roundPoint(value: number) {
    return Number(value.toFixed(1));
}

function parseNumericInput(value: number | string) {
    if (typeof value === 'string' && value.trim() === '') return Number.NaN;
    return Number(value);
}

function suggestInsertedLetter(letter: string, position: 'above' | 'below') {
    const trimmed = letter.trim();
    if (!trimmed) return 'New';
    if (position === 'above') {
        if (trimmed.endsWith('-')) return trimmed.slice(0, -1);
        if (trimmed.endsWith('+')) return `${trimmed}*`;
        return `${trimmed}+`;
    }
    if (trimmed.endsWith('+')) return trimmed.slice(0, -1);
    if (trimmed.endsWith('-')) return `${trimmed}*`;
    return `${trimmed}-`;
}

function getInsertSpan(rule: DraftGpaGradeRule) {
    const span = parseNumericInput(rule.max) - parseNumericInput(rule.min);
    if (!Number.isFinite(span) || span < MARK_GAP * 2) return null;
    if (span >= DESIRED_INSERT_SPAN + MARK_GAP + MIN_REMAINING_SPAN) return DESIRED_INSERT_SPAN;
    const splitSpan = roundMark((span - MARK_GAP) / 2);
    return splitSpan >= MARK_GAP ? splitSpan : null;
}

function getNearestRulePoints(
    rules: DraftGpaGradeRule[],
    targetIndex: number,
    target: { min: number; max: number },
    position: 'above' | 'below',
) {
    const candidates = rules
        .map((rule, index) => ({
            index,
            min: parseNumericInput(rule.min),
            max: parseNumericInput(rule.max),
            points: parseNumericInput(rule.points),
        }))
        .filter((rule) => (
            rule.index !== targetIndex &&
            Number.isFinite(rule.min) &&
            Number.isFinite(rule.max) &&
            Number.isFinite(rule.points)
        ));

    if (position === 'above') {
        return candidates
            .filter((rule) => rule.min > target.max)
            .sort((first, second) => first.min - second.min)[0]?.points;
    }

    return candidates
        .filter((rule) => rule.max < target.min)
        .sort((first, second) => second.max - first.max)[0]?.points;
}

function chooseInsertedPoints(
    rules: DraftGpaGradeRule[],
    targetIndex: number,
    target: { min: number; max: number; points: number },
    position: 'above' | 'below',
    scale: number,
) {
    const neighborPoints = getNearestRulePoints(rules, targetIndex, target, position);
    if (position === 'above') {
        const upperBound = Math.min(scale, neighborPoints ?? scale);
        if (upperBound < target.points) return null;
        return roundPoint(target.points + ((upperBound - target.points) / 2));
    }

    const lowerBound = Math.max(0, neighborPoints ?? 0);
    if (lowerBound > target.points) return null;
    return roundPoint(lowerBound + ((target.points - lowerBound) / 2));
}

function insertRuleNear(rules: DraftGpaGradeRule[], targetIndex: number, position: 'above' | 'below', scale: number, insertedId: string) {
    const target = rules[targetIndex];
    if (!target) return null;

    const normalizedTarget = {
        ...target,
        min: parseNumericInput(target.min),
        max: parseNumericInput(target.max),
        points: parseNumericInput(target.points),
    };
    const insertSpan = getInsertSpan(normalizedTarget);
    if (insertSpan === null) return null;
    const insertedPoints = chooseInsertedPoints(rules, targetIndex, normalizedTarget, position, scale);
    if (insertedPoints === null) return null;

    const insertedRule: DraftGpaGradeRule = position === 'above'
        ? {
            localId: insertedId,
            min: roundMark(normalizedTarget.max - insertSpan),
            max: normalizedTarget.max,
            letter: suggestInsertedLetter(normalizedTarget.letter, position),
            points: insertedPoints,
        }
        : {
            localId: insertedId,
            min: normalizedTarget.min,
            max: roundMark(normalizedTarget.min + insertSpan),
            letter: suggestInsertedLetter(normalizedTarget.letter, position),
            points: insertedPoints,
        };

    const updatedTarget: DraftGpaGradeRule = position === 'above'
        ? { ...normalizedTarget, max: roundMark(parseNumericInput(insertedRule.min) - MARK_GAP) }
        : { ...normalizedTarget, min: roundMark(parseNumericInput(insertedRule.max) + MARK_GAP) };

    if (
        parseNumericInput(updatedTarget.min) > parseNumericInput(updatedTarget.max) ||
        parseNumericInput(insertedRule.min) > parseNumericInput(insertedRule.max)
    ) return null;

    const nextRules = [...rules];
    nextRules[targetIndex] = updatedTarget;
    nextRules.splice(position === 'above' ? targetIndex : targetIndex + 1, 0, insertedRule);
    return nextRules;
}

function removeRuleAndMergeRange(rules: DraftGpaGradeRule[], targetIndex: number) {
    if (rules.length <= 1) return null;
    const target = rules[targetIndex];
    if (!target) return null;

    const targetMin = parseNumericInput(target.min);
    const targetMax = parseNumericInput(target.max);
    if (!Number.isFinite(targetMin) || !Number.isFinite(targetMax)) {
        return rules.filter((_, ruleIndex) => ruleIndex !== targetIndex);
    }

    const sorted = rules
        .map((rule, index) => ({
            rule,
            index,
            min: parseNumericInput(rule.min),
            max: parseNumericInput(rule.max),
        }))
        .filter((item) => Number.isFinite(item.min) && Number.isFinite(item.max))
        .sort((first, second) => first.min - second.min);
    const sortedTargetIndex = sorted.findIndex((item) => item.index === targetIndex);
    if (sortedTargetIndex === -1) return null;

    const lowerNeighbor = sorted[sortedTargetIndex - 1];
    const upperNeighbor = sorted[sortedTargetIndex + 1];
    const mergeTargetIndex = lowerNeighbor?.index ?? upperNeighbor?.index;
    if (mergeTargetIndex === undefined) return null;

    return rules
        .map((rule, index) => {
            if (index !== mergeTargetIndex) return rule;
            if (lowerNeighbor?.index === mergeTargetIndex) {
                return { ...rule, max: targetMax };
            }
            return { ...rule, min: targetMin };
        })
        .filter((_, index) => index !== targetIndex);
}

export default function GpaPoliciesPage() {
    const { token, user } = useAuth();
    const router = useRouter();
    const { dispatch } = useGlobal();
    const [selectedPolicyId, setSelectedPolicyId] = useState('');
    const [draft, setDraft] = useState<PolicyDraft>(newDraft);
    const [formError, setFormError] = useState<string | null>(null);
    const [deletingPolicy, setDeletingPolicy] = useState<GpaPolicy | null>(null);
    const [previewMarks, setPreviewMarks] = useState('88');
    const [previewCredits, setPreviewCredits] = useState('3');
    const [preview, setPreview] = useState<GpaPolicyPreviewResponse | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [previewing, setPreviewing] = useState(false);

    useEffect(() => {
        if (user && user.role !== Role.ORG_ADMIN) router.replace('/overview');
    }, [router, user]);

    useEffect(() => {
        if (!highlightedRuleId) return;
        const timer = window.setTimeout(() => setHighlightedRuleId(null), 1600);
        return () => window.clearTimeout(timer);
    }, [highlightedRuleId]);

    const { data: policies = [], error, isLoading, mutate } = useSWR<GpaPolicy[]>(
        token && user?.role === Role.ORG_ADMIN ? ['gpaPolicies', token] : null,
        () => api.org.getGpaPolicies(token!, { includeArchived: true }),
    );

    useEffect(() => {
        if (selectedPolicyId === NEW_POLICY_ID) return;
        if (policies.length === 0) return;
        const selected = policies.find((policy) => policy.id === selectedPolicyId) || policies.find((policy) => policy.isDefault) || policies[0];
        if (!selected || selected.id === draft.id) return;
        setSelectedPolicyId(selected.id);
        setDraft(draftFromPolicy(selected));
        setFormError(null);
        setPreview(null);
        setPreviewError(null);
        setHighlightedRuleId(null);
    }, [draft.id, policies, selectedPolicyId]);

    const validationError = useMemo(() => validateDraft(draft), [draft]);
    const selectedPolicy = policies.find((policy) => policy.id === draft.id);
    const isNewPolicyDraft = selectedPolicyId === NEW_POLICY_ID && !draft.id;
    const baselineDraft = useMemo(() => (
        selectedPolicy ? draftFromPolicy(selectedPolicy) : newDraft()
    ), [selectedPolicy]);
    const hasDraftChanges = useMemo(() => !areDraftsEqual(draft, baselineDraft), [baselineDraft, draft]);
    const newPolicyActionLabel = draft.id && hasDraftChanges
        ? 'Discard & New'
        : hasDraftChanges
            ? 'Reset to Defaults'
            : 'New Policy';
    const newPolicyActionTitle = draft.id && hasDraftChanges
        ? 'Discard unsaved changes and start a new policy'
        : hasDraftChanges
            ? 'Reset this draft to the default GPA policy'
            : 'Start a new GPA policy';
    const displayedRules = useMemo(() => (
        draft.gradeRules
            .map((rule, index) => ({ rule, index }))
            .sort((first, second) => parseNumericInput(second.rule.max) - parseNumericInput(first.rule.max))
    ), [draft.gradeRules]);

    const updateRule = (index: number, patch: Partial<DraftGpaGradeRule>) => {
        setDraft((current) => ({
            ...current,
            gradeRules: current.gradeRules.map((rule, ruleIndex) => (
                ruleIndex === index ? { ...rule, ...patch } : rule
            )),
        }));
    };

    const addRule = () => {
        const scale = Number(draft.scale);
        if (!Number.isFinite(scale) || scale <= 0) {
            setFormError('Set a valid GPA scale before adding a rule.');
            return;
        }

        const insertedId = createRuleId();
        setDraft((current) => {
            const candidates = current.gradeRules
                .map((rule, index) => {
                    const min = parseNumericInput(rule.min);
                    const max = parseNumericInput(rule.max);
                    return {
                        index,
                        min,
                        max,
                        span: max - min,
                        canAddAbove: Number.isFinite(max) && max < 100,
                        canAddBelow: Number.isFinite(min) && min > 0,
                    };
                })
                .filter((rule) => Number.isFinite(rule.span) && rule.span > MARK_GAP && (rule.canAddAbove || rule.canAddBelow))
                .sort((first, second) => second.span - first.span);
            const candidate = candidates[0];
            if (!candidate) {
                setFormError('No grade range is wide enough to split safely.');
                return current;
            }

            const position: 'above' | 'below' = candidate.canAddAbove ? 'above' : 'below';
            const nextRules = insertRuleNear(current.gradeRules, candidate.index, position, scale, insertedId);
            if (!nextRules) {
                setFormError('No grade range is wide enough to split safely.');
                return current;
            }

            setFormError(null);
            setHighlightedRuleId(insertedId);
            return { ...current, gradeRules: nextRules };
        });
    };

    const insertRule = (index: number, position: 'above' | 'below') => {
        const scale = Number(draft.scale);
        if (!Number.isFinite(scale) || scale <= 0) {
            setFormError('Set a valid GPA scale before adding a rule.');
            return;
        }
        const insertedId = createRuleId();
        setDraft((current) => {
            const nextRules = insertRuleNear(current.gradeRules, index, position, scale, insertedId);
            if (!nextRules) {
                setFormError('This grade range is too narrow to split. Widen it before adding a nearby rule.');
                return current;
            }
            setFormError(null);
            setHighlightedRuleId(insertedId);
            return { ...current, gradeRules: nextRules };
        });
    };

    const removeRule = (index: number) => {
        setDraft((current) => {
            const nextRules = removeRuleAndMergeRange(current.gradeRules, index);
            if (!nextRules) {
                setFormError('At least one grade rule is required.');
                return current;
            }
            setFormError(null);
            return { ...current, gradeRules: nextRules };
        });
    };

    const savePolicy = async () => {
        if (!token) return;
        const nextError = validateDraft(draft);
        if (nextError) {
            setFormError(nextError);
            return;
        }

        setSaving(true);
        setFormError(null);
        const payload = {
            name: draft.name.trim(),
            scale: Number(draft.scale),
            method: draft.method,
            rounding: draft.rounding,
            gradeRules: draft.gradeRules.map((rule) => ({
                min: parseNumericInput(rule.min),
                max: parseNumericInput(rule.max),
                letter: rule.letter.trim(),
                points: parseNumericInput(rule.points),
            })),
        };

        try {
            const saved = draft.id
                ? await api.org.updateGpaPolicy(draft.id, payload, token)
                : await api.org.createGpaPolicy({ ...payload, isDefault: draft.isDefault }, token);
            await mutate();
            setSelectedPolicyId(saved.id);
            setDraft(draftFromPolicy(saved));
            dispatch({ type: 'TOAST_ADD', payload: { type: 'success', message: 'GPA policy saved.' } });
        } catch (saveError) {
            setFormError(getApiErrorMessage(saveError, 'Unable to save GPA policy.'));
        } finally {
            setSaving(false);
        }
    };

    const setDefaultPolicy = async (policy: GpaPolicy) => {
        if (!token || policy.isDefault) return;
        try {
            await api.org.setDefaultGpaPolicy(policy.id, token);
            await mutate();
            dispatch({ type: 'TOAST_ADD', payload: { type: 'success', message: 'Default GPA policy updated.' } });
        } catch (defaultError) {
            setFormError(getApiErrorMessage(defaultError, 'Unable to set default policy.'));
        }
    };

    const deletePolicy = async (policy: GpaPolicy) => {
        if (!token) return;
        try {
            await api.org.deleteGpaPolicy(policy.id, token);
            await mutate();
            setDraft(newDraft());
            setSelectedPolicyId('');
            dispatch({ type: 'TOAST_ADD', payload: { type: 'success', message: 'GPA policy deleted.' } });
        } catch (deleteError) {
            setFormError(getApiErrorMessage(deleteError, 'Unable to delete GPA policy.'));
        }
    };

    const previewPolicy = async () => {
        if (!token) return;
        const nextError = validateDraft(draft);
        const marks = Number(previewMarks);
        const creditHours = Number(previewCredits);
        if (nextError) {
            setPreviewError(nextError);
            return;
        }
        if (!Number.isFinite(marks) || marks < 0 || marks > 100) {
            setPreviewError('Sample marks must be between 0 and 100.');
            return;
        }
        if (!Number.isFinite(creditHours) || creditHours <= 0) {
            setPreviewError('Sample credit hours must be greater than zero.');
            return;
        }

        setPreviewing(true);
        setPreviewError(null);
        try {
            const result = await api.org.previewGpaPolicy({
                marks,
                creditHours,
                scale: Number(draft.scale),
                method: draft.method,
                rounding: draft.rounding,
                gradeRules: draft.gradeRules.map((rule) => ({
                    min: parseNumericInput(rule.min),
                    max: parseNumericInput(rule.max),
                    letter: rule.letter.trim(),
                    points: parseNumericInput(rule.points),
                })),
            }, token);
            setPreview(result);
        } catch (previewFailure) {
            setPreviewError(getApiErrorMessage(previewFailure, 'Unable to preview GPA policy.'));
        } finally {
            setPreviewing(false);
        }
    };

    if (!token || user?.role !== Role.ORG_ADMIN) return <Loading className="h-full" text="Checking access..." />;

    return (
        <PageShell>
            <PageHeader
                title="GPA Policies"
                description="Manage organization GPA scales, grade boundaries, and transcript calculation rules."
                icon={Trophy}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academic Settings' },
                    { label: 'GPA Policies' },
                ]}
                actions={(
                    <Button
                        type="button"
                        variant="secondary"
                        icon={hasDraftChanges ? ListRestart : Plus}
                        title={newPolicyActionTitle}
                        onClick={() => {
                            setDraft(newDraft());
                            setSelectedPolicyId(NEW_POLICY_ID);
                            setFormError(null);
                            setPreview(null);
                            setPreviewError(null);
                            setHighlightedRuleId(null);
                        }}
                    >
                        {newPolicyActionLabel}
                    </Button>
                )}
            />

            <ResourcePanel>
                {isLoading && <Loading text="Loading GPA policies..." />}
                {error && <ErrorState error={error} onRetry={() => mutate()} />}

                {!isLoading && !error && (
                    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
                        <aside className="min-h-0 min-w-0 overflow-y-auto border-b border-border/70 p-4 lg:border-b-0 lg:border-r">
                            <div className="space-y-2">
                                {isNewPolicyDraft && (
                                    <button
                                        type="button"
                                        className="w-full rounded-md border border-primary bg-primary/10 p-3 text-left transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-black text-foreground">{draft.name || 'New GPA Policy'}</p>
                                                <p className="mt-1 text-xs font-semibold text-muted-foreground">Unsaved policy · Scale {draft.scale || 'N/A'}</p>
                                            </div>
                                            <Badge variant="warning" size="sm">Draft</Badge>
                                        </div>
                                    </button>
                                )}
                                {policies.map((policy) => (
                                    <button
                                        key={policy.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedPolicyId(policy.id);
                                            setDraft(draftFromPolicy(policy));
                                            setFormError(null);
                                            setPreview(null);
                                            setPreviewError(null);
                                            setHighlightedRuleId(null);
                                        }}
                                        className={`w-full rounded-md border p-3 text-left transition-colors ${policy.id === draft.id ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/35 hover:bg-muted/50'}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-black text-foreground">{policy.name}</p>
                                                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                                    {policy.method === GpaCalculationMethod.WEIGHTED_BY_CREDIT_HOURS ? 'Weighted by credits' : 'Simple average'} · Scale {policy.scale}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1">
                                                {policy.isDefault && <Badge variant="success" size="sm" icon={Star}>Default</Badge>}
                                                {policy.isArchived && <Badge variant="neutral" size="sm">Archived</Badge>}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {policies.length === 0 && !isNewPolicyDraft && (
                                <EmptyState
                                    icon={Trophy}
                                    title="No GPA policies yet"
                                    description="Create a policy to define transcript grade points."
                                    className="min-h-72"
                                />
                            )}
                        </aside>

                        <div className="min-h-0 min-w-0 overflow-y-auto p-4">
                            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                                <form
                                    className="min-w-0 space-y-5"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        savePolicy();
                                    }}
                                >
                                    {(formError || validationError) && (
                                        <StatusBanner
                                            variant="danger"
                                            title={formError || validationError || 'Invalid GPA policy'}
                                        />
                                    )}

                                    <section className="rounded-lg border border-border bg-background p-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div>
                                                <Label htmlFor="policy-name" required>Name</Label>
                                                <Input
                                                    id="policy-name"
                                                    value={draft.name}
                                                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                                                    error={!draft.name.trim()}
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="policy-scale" required>Scale</Label>
                                                <Input
                                                    id="policy-scale"
                                                    type="number"
                                                    min="0.01"
                                                    step="any"
                                                    value={draft.scale}
                                                    onChange={(event) => setDraft((current) => ({ ...current, scale: event.target.value }))}
                                                    error={!Number.isFinite(Number(draft.scale)) || Number(draft.scale) <= 0}
                                                />
                                            </div>
                                            <div>
                                                <Label>Method</Label>
                                                <CustomSelect<GpaCalculationMethod>
                                                    value={draft.method}
                                                    onChange={(method) => setDraft((current) => ({ ...current, method }))}
                                                    options={[
                                                        { value: GpaCalculationMethod.WEIGHTED_BY_CREDIT_HOURS, label: 'Weighted by credit hours' },
                                                        { value: GpaCalculationMethod.SIMPLE_AVERAGE, label: 'Simple average' },
                                                    ]}
                                                />
                                            </div>
                                            <div>
                                                <Label>Rounding</Label>
                                                <CustomSelect<GpaRounding>
                                                    value={draft.rounding}
                                                    onChange={(rounding) => setDraft((current) => ({ ...current, rounding }))}
                                                    options={[
                                                        { value: GpaRounding.TWO_DECIMALS, label: '2 decimals' },
                                                        { value: GpaRounding.ONE_DECIMAL, label: '1 decimal' },
                                                        { value: GpaRounding.NONE, label: 'No rounding' },
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
                                        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                                            <div>
                                                <h2 className="text-base font-black">Grade Boundaries</h2>
                                                <p className="text-xs font-semibold text-muted-foreground">Ranges must be unique and stay within 0-100.</p>
                                            </div>
                                            <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={addRule}>Add Rule</Button>
                                        </div>
                                        <div className="max-w-full overflow-x-auto">
                                            <table className="w-full min-w-195 table-fixed text-sm">
                                                <colgroup>
                                                    <col className="w-[18%]" />
                                                    <col className="w-[18%]" />
                                                    <col className="w-[24%]" />
                                                    <col className="w-[18%]" />
                                                    <col className="w-[22%]" />
                                                </colgroup>
                                                <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                                                    <tr>
                                                        <th className="px-3 py-2">Min Marks</th>
                                                        <th className="px-3 py-2">Max Marks</th>
                                                        <th className="px-3 py-2">Letter Grade</th>
                                                        <th className="px-3 py-2">Grade Points</th>
                                                        <th className="px-3 py-2 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/60">
                                                    {displayedRules.map(({ rule, index }) => {
                                                        const maxMarks = parseNumericInput(rule.max);
                                                        const minMarks = parseNumericInput(rule.min);
                                                        const isTopRange = Number.isFinite(maxMarks) && maxMarks >= 100;
                                                        const isBottomRange = Number.isFinite(minMarks) && minMarks <= 0;
                                                        return (
                                                        <tr
                                                            key={rule.localId || `${index}-${rule.letter}`}
                                                            className={highlightedRuleId === rule.localId ? 'bg-primary/10 animate-pulse transition-colors' : 'transition-colors'}
                                                        >
                                                            <td className="p-3">
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    step="0.01"
                                                                    value={rule.min}
                                                                    onChange={(event) => updateRule(index, { min: event.target.value })}
                                                                />
                                                            </td>
                                                            <td className="p-3">
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    step="0.01"
                                                                    value={rule.max}
                                                                    onChange={(event) => updateRule(index, { max: event.target.value })}
                                                                />
                                                            </td>
                                                            <td className="p-3">
                                                                <Input
                                                                    value={rule.letter}
                                                                    onChange={(event) => updateRule(index, { letter: event.target.value })}
                                                                />
                                                            </td>
                                                            <td className="p-3">
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    max={draft.scale}
                                                                    step="0.1"
                                                                    value={rule.points}
                                                                    onChange={(event) => updateRule(index, { points: event.target.value })}
                                                                />
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex justify-end gap-1.5">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="xs"
                                                                        icon={ArrowUpToLine}
                                                                        aria-label="Add rule above"
                                                                        title={isTopRange ? 'Cannot add above the 100 marks range' : 'Add rule above'}
                                                                        className="w-8 px-0"
                                                                        disabled={isTopRange}
                                                                        onClick={() => insertRule(index, 'above')}
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="xs"
                                                                        icon={ArrowDownToLine}
                                                                        aria-label="Add rule below"
                                                                        title={isBottomRange ? 'Cannot add below the 0 marks range' : 'Add rule below'}
                                                                        className="w-8 px-0"
                                                                        disabled={isBottomRange}
                                                                        onClick={() => insertRule(index, 'below')}
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="xs"
                                                                        icon={Trash2}
                                                                        aria-label="Remove rule"
                                                                        title="Remove rule"
                                                                        className="w-8 px-0 text-danger hover:bg-danger/10 hover:text-danger"
                                                                        onClick={() => removeRule(index)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                                        <div className="flex gap-2">
                                            {selectedPolicy && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        icon={Star}
                                                        disabled={selectedPolicy.isDefault || selectedPolicy.isArchived}
                                                        onClick={() => setDefaultPolicy(selectedPolicy)}
                                                    >
                                                        {selectedPolicy.isDefault ? 'Default Policy' : selectedPolicy.isArchived ? 'Archived' : 'Set Default'}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="danger"
                                                        icon={Trash2}
                                                        disabled={selectedPolicy.isDefault}
                                                        onClick={() => setDeletingPolicy(selectedPolicy)}
                                                    >
                                                        {(selectedPolicy._count?.academicCycles || 0) > 0 ? 'Archive' : 'Delete'}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                        <Button type="submit" icon={Save} isLoading={saving} loadingText="Saving">
                                            Save Policy
                                        </Button>
                                    </div>
                                </form>

                                <aside className="space-y-4">
                                    <section className="rounded-lg border border-border bg-background p-4">
                                        <div className="mb-4 flex items-center gap-2">
                                            <Calculator className="h-4 w-4 text-primary" />
                                            <h2 className="text-base font-black">Preview</h2>
                                        </div>
                                        {previewError && (
                                            <StatusBanner variant="danger" title={previewError} className="mb-4" />
                                        )}
                                        <div className="space-y-3">
                                            <div>
                                                <Label htmlFor="preview-marks">Sample Marks</Label>
                                                <Input
                                                    id="preview-marks"
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.1"
                                                    value={previewMarks}
                                                    onChange={(event) => setPreviewMarks(event.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="preview-credits">Credit Hours</Label>
                                                <Input
                                                    id="preview-credits"
                                                    type="number"
                                                    min="0.01"
                                                    step="0.5"
                                                    value={previewCredits}
                                                    onChange={(event) => setPreviewCredits(event.target.value)}
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                icon={Calculator}
                                                onClick={previewPolicy}
                                                isLoading={previewing}
                                                loadingText="Calculating"
                                                className="w-full"
                                            >
                                                Calculate
                                            </Button>
                                        </div>

                                        {preview && (
                                            <div className="mt-4 grid grid-cols-2 gap-2">
                                                <div className="rounded-md bg-muted/40 p-3">
                                                    <p className="text-xs font-semibold text-muted-foreground">Letter</p>
                                                    <p className="text-lg font-black">{preview.letterGrade}</p>
                                                </div>
                                                <div className="rounded-md bg-muted/40 p-3">
                                                    <p className="text-xs font-semibold text-muted-foreground">Points</p>
                                                    <p className="text-lg font-black">{preview.gradePoints}</p>
                                                </div>
                                                <div className="rounded-md bg-muted/40 p-3">
                                                    <p className="text-xs font-semibold text-muted-foreground">GPA</p>
                                                    <p className="text-lg font-black text-primary">{preview.gpa}</p>
                                                </div>
                                                <div className="rounded-md bg-muted/40 p-3">
                                                    <p className="text-xs font-semibold text-muted-foreground">Credits</p>
                                                    <p className="text-lg font-black">{preview.totalCreditHours}</p>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                </aside>
                            </div>
                        </div>
                    </div>
                )}
            </ResourcePanel>

            <ConfirmDialog
                isOpen={Boolean(deletingPolicy)}
                onClose={() => setDeletingPolicy(null)}
                onConfirm={() => deletingPolicy && deletePolicy(deletingPolicy)}
                title={(deletingPolicy?._count?.academicCycles || 0) > 0 ? 'Archive GPA policy?' : 'Delete GPA policy?'}
                description={(deletingPolicy?._count?.academicCycles || 0) > 0
                    ? `${deletingPolicy?.name || 'This GPA policy'} is used by academic cycles, so it will be archived and kept for historical transcripts.`
                    : `This will permanently remove ${deletingPolicy?.name || 'this GPA policy'}.`}
                confirmText={(deletingPolicy?._count?.academicCycles || 0) > 0 ? 'Archive' : 'Delete'}
                isDestructive
            />
        </PageShell>
    );
}
