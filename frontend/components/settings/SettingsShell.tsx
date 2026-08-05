'use client';

import type { ReactNode } from 'react';
import { Settings } from 'lucide-react';
import type { ReactElement } from 'react';
import { PageHeader, PageShell, PageTabs, type PageBreadcrumb } from '@/components/ui/PageShell';
import type { SettingsTabDefinition } from './settings-tabs';

export interface SettingsShellProps<TabKey extends string> {
    title?: string;
    description?: ReactNode;
    icon?: React.ElementType<{ className?: string }> | React.ReactNode;
    breadcrumbs?: PageBreadcrumb[];
    tabs: readonly SettingsTabDefinition<TabKey>[];
    tabCounts?: Partial<Record<TabKey, ReactNode>>;
    activeTab: TabKey;
    onTabChange: (tab: TabKey) => void;
    children: ReactNode;
    actions?: ReactNode;
    beforeTabs?: ReactNode;
    ariaLabel?: string;
    actionsDefaultOpen?: boolean;
    className?: string;
    headerClassName?: string;
}

export function SettingsShell<TabKey extends string>({
    title = 'Settings',
    description,
    icon = Settings,
    breadcrumbs,
    tabs,
    tabCounts,
    activeTab,
    onTabChange,
    children,
    actions,
    beforeTabs,
    ariaLabel = 'Settings navigation',
    actionsDefaultOpen,
    className = 'gap-3 overflow-x-hidden overflow-y-auto pb-8 pr-1 custom-scrollbar',
    headerClassName,
}: SettingsShellProps<TabKey>) {
    return (
        <PageShell className={className}>
            <PageHeader
                title={title}
                description={description}
                icon={icon}
                breadcrumbs={breadcrumbs}
                actions={actions}
                actionsDefaultOpen={actionsDefaultOpen}
                className={headerClassName}
            />

            {beforeTabs}

            <PageTabs
                ariaLabel={ariaLabel}
                items={tabs.map(({ key, label, icon: tabIcon }) => ({
                    value: key,
                    label,
                    icon: tabIcon,
                    count: tabCounts?.[key],
                }))}
                activeValue={activeTab}
                onValueChange={onTabChange}
                hideOnScroll
            />

            {children}
        </PageShell>
    );
}
