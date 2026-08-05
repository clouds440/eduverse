import type { ReactNode } from 'react';

export interface SettingsTabDefinition<Key extends string> {
    key: Key;
    label: string;
    icon: React.ElementType<{ className?: string }> | ReactNode;
}

export function isSettingsTabKey<Key extends string>(
    tabs: readonly SettingsTabDefinition<Key>[],
    value: string,
): value is Key {
    return tabs.some((tab) => tab.key === value);
}
