'use client';

import Link from 'next/link';
import { LockKeyhole, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Loading } from '@/components/ui/Loading';
import { getAIRoleHomeConfig } from '@/lib/ai';
import { Role } from '@/types';

interface AICopilotHomeProps {
    role?: Role | string | null;
    entitlementLoading: boolean;
    entitlementAllowed?: boolean;
    denialMessage?: string;
    sourceLabel?: string;
    remainingCredits?: number;
}

export function AICopilotHome({
    role,
    entitlementLoading,
    entitlementAllowed,
    denialMessage,
    sourceLabel,
    remainingCredits,
}: AICopilotHomeProps) {
    const config = getAIRoleHomeConfig(role);

    if (entitlementLoading) {
        return (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-lg border border-border/70 bg-card/80 p-6 text-center">
                <Loading size="md" />
                <p className="text-sm font-semibold text-muted-foreground">Checking Copilot access...</p>
            </div>
        );
    }

    if (entitlementAllowed === false) {
        return (
            <div className="grid gap-4">
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-warning/25 bg-background text-warning">
                            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-black text-warning">Copilot is not available</p>
                            <p className="mt-1 text-sm font-semibold leading-6 text-warning/85">{denialMessage ?? 'EduVerse Copilot needs an active organization or personal subscription.'}</p>
                        </div>
                    </div>
                </div>
                <div className="grid gap-2">
                    <Link
                        href="/ai/subscription"
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    >
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        Unlock EduVerse Copilot
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-4">
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                <div className="border-b border-border/60 bg-primary/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="purple" size="sm" icon={Sparkles}>{config.eyebrow}</Badge>
                                {sourceLabel && <Badge variant="secondary" size="sm">{sourceLabel}</Badge>}
                            </div>
                            <h2 className="mt-4 text-2xl font-black leading-tight text-foreground">{config.title}</h2>
                            <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">{config.description}</p>
                        </div>
                        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-background text-primary sm:flex">
                            <Sparkles className="h-6 w-6 fill-current" aria-hidden="true" />
                        </div>
                    </div>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Focus</p>
                        <p className="mt-2 text-sm font-black text-foreground">Schedules, courses, deadlines, trends</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">AI Credits</p>
                        <p className="mt-2 text-sm font-black text-foreground">
                            {typeof remainingCredits === 'number' ? `${remainingCredits.toLocaleString()} remaining` : 'Ready'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
