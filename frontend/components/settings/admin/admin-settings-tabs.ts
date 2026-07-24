import { BellRing, MonitorCog, Shield } from 'lucide-react';
import type { SettingsTabDefinition } from '../settings-tabs';

export type AdminSettingsTabKey = 'appearance' | 'notifications' | 'security';

export const ADMIN_SETTINGS_TABS: readonly SettingsTabDefinition<AdminSettingsTabKey>[] = [
    {
        key: 'appearance',
        label: 'Appearance',
        icon: MonitorCog,
    },
    {
        key: 'notifications',
        label: 'Notifications',
        icon: BellRing,
    },
    {
        key: 'security',
        label: 'Security',
        icon: Shield,
    },
];
