'use client';

import { Building2, DoorOpen } from 'lucide-react';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { cn } from '@/lib/utils';
import BuildingsTab from './_components/BuildingsTab';
import RoomsTab from './_components/RoomsTab';

const TABS = [
    { key: 'buildings', label: 'Buildings', icon: Building2 },
    { key: 'rooms', label: 'Rooms', icon: DoorOpen },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function BuildingsAndRoomsPage() {
    const { getStringParam, updateQueryParams } = useUrlQueryState();
    const tab = (getStringParam('tab') || 'buildings') as TabKey;
    const activeTab = TABS.some((t) => t.key === tab) ? tab : 'buildings';

    const handleTabChange = (key: TabKey) => {
        // Reset tab-specific query params when switching tabs
        updateQueryParams({ tab: key, page: 1, search: undefined, status: undefined, sortBy: undefined, sortOrder: undefined, departmentId: undefined, buildingId: undefined, type: undefined });
    };

    return (
        <PageShell>
            <div className="shrink-0 space-y-3">
                <PageHeader
                    title="Buildings & Rooms"
                    description="Manage campus buildings and their schedulable rooms."
                    icon={Building2}
                    breadcrumbs={[{ label: 'Organization' }, { label: 'Setup' }, { label: 'Buildings & Rooms' }]}
                />

                <nav
                    aria-label="Buildings and Rooms navigation"
                    className="flex gap-1 overflow-x-auto rounded-lg border border-border/70 bg-card/95 p-1 shadow-sm scrollbar-none"
                >
                    {TABS.map(({ key, label, icon: Icon }) => {
                        const isActive = activeTab === key;
                        return (
                            <button
                                key={key}
                                onClick={() => handleTabChange(key)}
                                className={cn(
                                    'flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-w-32',
                                    isActive
                                        ? 'bg-background text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                )}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className="relative min-h-0 flex-1 overflow-y-auto pt-3 custom-scrollbar">
                {activeTab === 'buildings' && <BuildingsTab />}
                {activeTab === 'rooms' && <RoomsTab />}
            </div>
        </PageShell>
    );
}
