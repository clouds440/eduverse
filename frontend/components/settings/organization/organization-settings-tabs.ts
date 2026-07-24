import {
    Building2,
    Coins,
    Palette,
    School,
    ShieldCheck,
    Sparkles,
    Trophy,
} from 'lucide-react';
import { Role } from '@/types';
import type { SettingsTabDefinition } from '../settings-tabs';

export type OrganizationSettingsTabKey =
    | 'profile'
    | 'appearance'
    | 'finance'
    | 'ai'
    | 'gpa-policies'
    | 'branding'
    | 'security';

export type OrganizationSettingsTabDefinition =
    SettingsTabDefinition<OrganizationSettingsTabKey> & {
        allowedRoles?: readonly Role[];
    };

export const ORGANIZATION_SETTINGS_TABS: readonly OrganizationSettingsTabDefinition[] = [
    { key: 'profile', label: 'Profile', icon: Building2 },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'finance', label: 'Finance', icon: Coins },
    { key: 'ai', label: 'EduVerse Copilot', icon: Sparkles },
    {
        key: 'gpa-policies',
        label: 'GPA Policies',
        icon: Trophy,
        allowedRoles: [Role.ORG_ADMIN],
    },
    { key: 'branding', label: 'Branding', icon: School },
    { key: 'security', label: 'Security', icon: ShieldCheck },
];

export function getOrganizationSettingsTabs(role?: Role) {
    return ORGANIZATION_SETTINGS_TABS.filter(
        (tab) => !tab.allowedRoles || (role && tab.allowedRoles.includes(role)),
    );
}
