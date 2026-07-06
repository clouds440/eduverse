'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle, Clock, ListChecks, MapPin, Save, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { PreferenceWindow, PreferenceWindowKind, PreferenceWindowOption, PreferenceWindowStatus, Section } from '@/types';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type SectionWithCount = Section & { _count?: { enrollments?: number } };

function formatDate(value: string) {
    return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function optionLabel(option: PreferenceWindowOption) {
    if (option.section) return `${option.section.course?.name || 'Course'} - ${option.section.name}`;
    if (option.course) return option.course.code ? `${option.course.code} - ${option.course.name}` : option.course.name;
    return 'Option';
}

function optionMeta(option: PreferenceWindowOption) {
    if (option.section) {
        return [option.section.course?.code, option.section.academicCycle?.name, option.section.cohort?.name].filter(Boolean).join(' - ');
    }
    return option.course?.department?.name || option.course?.code || 'Course option';
}

function formatSchedule(section: Section) {
    const schedules = section.schedules || [];
    if (schedules.length === 0) return ['No schedule set'];
    return schedules.map((schedule) => {
        const day = schedule.date ? new Date(schedule.date).toLocaleDateString([], { dateStyle: 'medium' }) : WEEKDAYS[schedule.day] || 'Scheduled';
        const room = schedule.roomRef?.name || schedule.room || section.defaultRoom?.name || section.room;
        const teacher = schedule.teacher?.user?.name || schedule.teacher?.user?.email;
        return [day, `${schedule.startTime} - ${schedule.endTime}`, room, teacher].filter(Boolean).join(' - ');
    });
}

function teacherNames(section?: Section | null) {
    const names = section?.teachers?.map((teacher) => teacher.user?.name || teacher.user?.email).filter(Boolean) || [];
    return names.length ? names.join(', ') : 'Teacher not assigned';
}

function capacityLabel(section?: Section | null) {
    if (!section) return null;
    const sectionWithCount = section as SectionWithCount;
    const capacity = section.defaultRoom?.capacity;
    const enrolled = sectionWithCount._count?.enrollments;
    if (!capacity && enrolled === undefined) return null;
    if (!capacity) return `${enrolled || 0} enrolled`;
    return `${enrolled || 0}/${capacity} enrolled`;
}

function isWindowOpen(window?: PreferenceWindow) {
    if (!window) return false;
    const now = new Date();
    return window.status === PreferenceWindowStatus.ACTIVE && now >= new Date(window.startAt) && now <= new Date(window.endAt);
}

function buildInitialRankOrder(window?: PreferenceWindow) {
    const options = window?.options || [];
    const rankedIds = (window?.submissions?.[0]?.ranks || [])
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .map((rank) => rank.optionId);
    const optionIds = options.map((option) => option.id);
    return [...rankedIds.filter((id) => optionIds.includes(id)), ...optionIds.filter((id) => !rankedIds.includes(id))];
}

function OptionCard({
    option,
    rank,
    canMoveUp,
    canMoveDown,
    disabled,
    onMoveUp,
    onMoveDown,
}: {
    option: PreferenceWindowOption;
    rank: number;
    canMoveUp: boolean;
    canMoveDown: boolean;
    disabled: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    const section = option.section;
    const capacity = capacityLabel(section);

    return (
        <Card padding="md" hoverable={false}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="primary" size="sm">Rank {rank}</Badge>
                        <Badge variant={option.targetType === 'SECTION' ? 'info' : 'secondary'} size="sm">
                            {option.targetType === 'SECTION' ? 'Section' : 'Course'}
                        </Badge>
                        {capacity && <Badge variant="neutral" size="sm">{capacity}</Badge>}
                    </div>
                    <h2 className="text-lg font-black text-foreground">{optionLabel(option)}</h2>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">{optionMeta(option)}</p>

                    {section ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
                                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="truncate text-sm font-semibold text-foreground">{teacherNames(section)}</span>
                            </div>
                            <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
                                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="truncate text-sm font-semibold text-foreground">
                                    {section.defaultRoom?.name || section.room || 'Room not assigned'}
                                </span>
                            </div>
                            <div className="md:col-span-2">
                                <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                                    {formatSchedule(section).map((schedule) => (
                                        <div key={schedule} className="flex min-w-0 items-center gap-2">
                                            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="truncate text-sm font-semibold text-foreground">{schedule}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : option.course?.description ? (
                        <p className="mt-4 text-sm font-medium text-muted-foreground">{option.course.description}</p>
                    ) : null}
                </div>

                <div className="flex shrink-0 gap-2 lg:flex-col">
                    <Button type="button" size="icon" variant="outline" icon={ArrowUp} aria-label="Move up" disabled={disabled || !canMoveUp} onClick={onMoveUp} />
                    <Button type="button" size="icon" variant="outline" icon={ArrowDown} aria-label="Move down" disabled={disabled || !canMoveDown} onClick={onMoveDown} />
                </div>
            </div>
        </Card>
    );
}

export default function StudentPreferenceWindowPage() {
    const params = useParams();
    const id = params.id as string;
    const { token } = useAuth();
    const { dispatch } = useGlobal();
    const [rankOrder, setRankOrder] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const key = token && id ? ['student-preference-window', id, token] as const : null;
    const { data: window, error, isLoading, mutate } = useSWR<PreferenceWindow>(
        key,
        ([, windowId, t]) => api.org.getStudentPreferenceWindow(windowId as string, t as string),
    );

    useEffect(() => {
        setRankOrder(buildInitialRankOrder(window));
    }, [window?.id, window?.submissions?.[0]?.updatedAt]);

    const optionsById = useMemo(() => new Map((window?.options || []).map((option) => [option.id, option])), [window?.options]);
    const rankedOptions = rankOrder.map((optionId) => optionsById.get(optionId)).filter((option): option is PreferenceWindowOption => Boolean(option));
    const open = isWindowOpen(window);
    const submitted = Boolean(window?.submissions?.length);

    const move = (index: number, direction: -1 | 1) => {
        setRankOrder((current) => {
            const next = [...current];
            const targetIndex = index + direction;
            if (targetIndex < 0 || targetIndex >= next.length) return current;
            [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
            return next;
        });
    };

    const submit = async () => {
        if (!token || !window) return;
        setSaving(true);
        try {
            await api.org.submitPreferenceWindow(window.id, rankOrder, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Preferences saved', type: 'success' } });
            await mutate();
        } catch (submitError) {
            dispatch({ type: 'TOAST_ADD', payload: { message: submitError instanceof Error ? submitError.message : 'Unable to save preferences', type: 'error' } });
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) {
        return (
            <PageShell>
                <PageHeader title="Preferences" description="Loading preference window." icon={ListChecks} />
                <ResourcePanel>
                    <div className="space-y-3 p-4">
                        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-lg" />)}
                    </div>
                </ResourcePanel>
            </PageShell>
        );
    }

    if (error) {
        return (
            <PageShell>
                <PageHeader title="Preferences" description="Open and submit your ranked options." icon={ListChecks} />
                <ResourcePanel>
                    <div className="p-4"><ErrorState error={error} onRetry={() => mutate()} /></div>
                </ResourcePanel>
            </PageShell>
        );
    }

    if (!window) {
        return (
            <PageShell>
                <PageHeader title="Preferences" description="Open and submit your ranked options." icon={ListChecks} />
                <ResourcePanel>
                    <EmptyState icon={ListChecks} title="Preference window unavailable" description="This window is no longer available." className="min-h-96" />
                </ResourcePanel>
            </PageShell>
        );
    }

    return (
        <PageShell>
            <PageHeader
                title={window.title}
                description={window.description || 'Rank the available options in your preferred order.'}
                icon={ListChecks}
                breadcrumbs={[{ label: 'Student Portal' }, { label: 'Preferences' }, { label: window.title }]}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={open ? 'warning' : 'neutral'} icon={open ? Clock : CheckCircle}>
                            {open ? `Deadline ${formatDate(window.endAt)}` : 'Closed'}
                        </Badge>
                        {submitted && <Badge variant="success" icon={CheckCircle}>Submitted</Badge>}
                        <Button type="button" icon={Save} disabled={!open || rankOrder.length !== (window.options?.length || 0)} isLoading={saving} loadingText="Saving" onClick={submit}>
                            {submitted ? 'Update' : 'Submit'}
                        </Button>
                    </div>
                }
            />
            <ResourcePanel>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar sm:p-4">
                    {window.kind === PreferenceWindowKind.COURSE_CHOICE && (
                        <div className="mb-4 rounded-lg border border-info/20 bg-info/10 p-4 text-sm font-semibold text-info">
                            Courses may contain multiple sections. Final enrollment is still handled by your institution.
                        </div>
                    )}
                    {!open && (
                        <div className="mb-4 rounded-lg border border-border bg-muted/35 p-4 text-sm font-semibold text-muted-foreground">
                            This preference window is closed. You can review your submitted ranking, but changes are no longer accepted.
                        </div>
                    )}
                    <div className="space-y-3">
                        {rankedOptions.map((option, index) => (
                            <OptionCard
                                key={option.id}
                                option={option}
                                rank={index + 1}
                                canMoveUp={index > 0}
                                canMoveDown={index < rankedOptions.length - 1}
                                disabled={!open || saving}
                                onMoveUp={() => move(index, -1)}
                                onMoveDown={() => move(index, 1)}
                            />
                        ))}
                    </div>
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
