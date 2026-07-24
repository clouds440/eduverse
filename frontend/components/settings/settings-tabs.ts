import type { LucideIcon } from 'lucide-react';

export interface SettingsTabDefinition<Key extends string> {
    key: Key;
    label: string;
    icon: LucideIcon;
}

export function isSettingsTabKey<Key extends string>(
    tabs: readonly SettingsTabDefinition<Key>[],
    value: string,
): value is Key {
    return tabs.some((tab) => tab.key === value);
}
