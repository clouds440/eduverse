'use client';

import { useState, type ReactNode } from 'react';
import { Building2, DoorOpen } from 'lucide-react';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { PageHeader, PageShell, PageTabs } from '@/components/ui/PageShell';
import { PageActionsHostProvider } from '@/components/ui/PageActionsHost';
import BuildingsTab from './_components/BuildingsTab';
import RoomsTab from './_components/RoomsTab';

const TABS = [
    { key: 'buildings', label: 'Buildings', icon: Building2 },
    { key: 'rooms', label: 'Rooms', icon: DoorOpen },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function BuildingsAndRoomsPage() {
    const { getStringParam, updateQueryParams } = useUrlQueryState();
    const [headerActions, setHeaderActions] = useState<ReactNode>(null);
    const tab = (getStringParam('tab') || 'buildings') as TabKey;
    const activeTab = TABS.some((t) => t.key === tab) ? tab : 'buildings';

    const handleTabChange = (key: TabKey) => {
        // Reset tab-specific query params when switching tabs
        updateQueryParams({ tab: key, page: 1, search: undefined, status: undefined, sortBy: undefined, sortOrder: undefined, departmentId: undefined, buildingId: undefined, type: undefined });
    };

    return (
        <PageActionsHostProvider setActions={setHeaderActions}>
            <PageShell className="gap-0">
                <div className="shrink-0 space-y-0.5">
                    <PageHeader
                        title="Buildings & Rooms"
                        description="Manage campus buildings and their schedulable rooms."
                        icon={Building2}
                        breadcrumbs={[{ label: 'Organization' }, { label: 'Setup' }, { label: 'Buildings & Rooms' }]}
                        actions={headerActions}
                    />

                    <PageTabs
                        ariaLabel="Buildings and Rooms navigation"
                        items={TABS.map(({ key, label, icon }) => ({ value: key, label, icon }))}
                        activeValue={activeTab}
                        onValueChange={handleTabChange}
                        hideOnScroll
                    />
                </div>

                <div className="relative min-h-0 flex-1 overflow-hidden">
                    {activeTab === 'buildings' && <BuildingsTab />}
                    {activeTab === 'rooms' && <RoomsTab />}
                </div>
            </PageShell>
        </PageActionsHostProvider>
    );
}


