import { BellRing, Shield, UserCircle } from 'lucide-react';
import type { SettingsTabDefinition } from '../settings-tabs';

export type AccountSettingsTabKey = 'profile' | 'preferences' | 'security';

export const ACCOUNT_SETTINGS_TABS: readonly SettingsTabDefinition<AccountSettingsTabKey>[] = [
    {
        key: 'profile',
        label: 'Profile',
        icon: UserCircle,
    },
    {
        key: 'preferences',
        label: 'Preferences',
        icon: BellRing,
    },
    {
        key: 'security',
        label: 'Security',
        icon: Shield,
    },
];
