'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Save, Settings, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { useTheme } from '@/context/ThemeContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { useUnsavedSettingsWarning } from '@/hooks/useUnsavedSettingsWarning';
import { ThemeMode, type UserSettings } from '@/types';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import type { PageBreadcrumb } from '@/components/ui/PageShell';
import { SettingsShell } from '../SettingsShell';
import { isSettingsTabKey } from '../settings-tabs';
import { AccountAppearanceSettingsTab } from './AccountAppearanceSettingsTab';
import { AccountPreferencesSettingsTab } from './AccountPreferencesSettingsTab';
import { AccountSecuritySettings } from './AccountSecuritySettings';
import {
    ACCOUNT_SETTINGS_TABS,
    type AccountSettingsTabKey,
} from './account-settings-tabs';
import type { NotificationSettingKey } from './NotificationSettingsTab';

const HASH_TABS: Record<string, AccountSettingsTabKey> = {
    'linked-accounts': 'security',
    sessions: 'security',
};

const PREFERENCE_KEYS = [
    'loginNotificationEmail',
    'loginNotificationPush',
    'marketingEmails',
] as const satisfies readonly (keyof UserSettings)[];
const USER_SETTINGS_SAVE_KEYS = [
    'themeMode',
    ...PREFERENCE_KEYS,
] as const satisfies readonly (keyof UserSettings)[];

function getChangedUserSettings(
    draft: UserSettings,
    saved: UserSettings,
    keys: readonly (keyof UserSettings)[],
) {
    const changes: Partial<UserSettings> = {};
    keys.forEach((key) => {
        if (draft[key] !== saved[key]) {
            changes[key] = draft[key] as never;
        }
    });
    return changes;
}

export interface AccountSettingsShellProps {
    title?: string;
    description?: ReactNode;
    icon?: LucideIcon;
    breadcrumbs?: PageBreadcrumb[];
    changePasswordHref: string;
    profileContent: ReactNode;
    loading?: boolean;
    defaultTab?: AccountSettingsTabKey;
    adminOnly?: boolean;
}

export function AccountSettingsShell({
    title = 'Account Settings',
    description = 'Profile, preferences, sign-in methods, and account security.',
    icon = Settings,
    breadcrumbs,
    changePasswordHref,
    profileContent,
    loading: profileLoading = false,
    defaultTab = 'profile',
    adminOnly = false,
}: AccountSettingsShellProps) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { themeMode, setThemeMode } = useTheme();
    const { settings, loading: settingsLoading, update: updateUserSettings } = useUserSettings();
    const { getStringParam, updateQueryParams } = useUrlQueryState();
    const [draftSettings, setDraftSettings] = useState<UserSettings>(settings);
    const [savingSettings, setSavingSettings] = useState(false);

    const requestedTab = getStringParam('tab', defaultTab);
    const activeTab = isSettingsTabKey(ACCOUNT_SETTINGS_TABS, requestedTab)
        ? requestedTab
        : defaultTab;
    useEffect(() => {
        if (!settingsLoading) {
            setDraftSettings(settings);
            setThemeMode(settings.themeMode);
        }
    }, [setThemeMode, settings.themeMode, settingsLoading]);

    const preferenceDirtyCount = useMemo(
        () => PREFERENCE_KEYS.filter((key) => draftSettings[key] !== settings[key]).length,
        [draftSettings, settings],
    );
    const appearanceDirtyCount = draftSettings.themeMode !== settings.themeMode ? 1 : 0;
    const hasUnsavedChanges = preferenceDirtyCount + appearanceDirtyCount > 0;

    useUnsavedSettingsWarning(hasUnsavedChanges);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const hash = window.location.hash.replace('#', '');
        const hashTab = HASH_TABS[hash];
        if (!hashTab) return;
        if (activeTab !== hashTab) {
            updateQueryParams({ tab: hashTab });
            return;
        }
        window.requestAnimationFrame(() => {
            document.getElementById(hash)?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        });
    }, [activeTab, updateQueryParams]);

    const handleTabChange = (tab: AccountSettingsTabKey) => {
        updateQueryParams({ tab: tab === defaultTab ? undefined : tab });
    };

    const handleThemeChange = (mode: ThemeMode) => {
        setThemeMode(mode);
        setDraftSettings((current) => ({ ...current, themeMode: mode }));
    };

    const handleNotificationChange = (
        key: NotificationSettingKey,
        enabled: boolean,
    ) => {
        setDraftSettings((current) => ({ ...current, [key]: enabled }));
    };

    const handleSaveSettings = async () => {
        if (!token || savingSettings || !hasUnsavedChanges) return;
        setSavingSettings(true);
        try {
            const changes = getChangedUserSettings(draftSettings, settings, USER_SETTINGS_SAVE_KEYS);
            const saved = await updateUserSettings(changes);
            setDraftSettings(saved);
            setThemeMode(saved.themeMode);
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: 'Settings updated successfully', type: 'success' },
            });
        } catch (error) {
            setThemeMode(settings.themeMode);
            const message = error instanceof Error ? error.message : 'Failed to save settings';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            setSavingSettings(false);
        }
    };

    if (!user || profileLoading || settingsLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loading size="md" />
            </div>
        );
    }

    return (
        <SettingsShell
            title={title}
            description={description}
            icon={icon}
            breadcrumbs={breadcrumbs}
            tabs={ACCOUNT_SETTINGS_TABS}
            tabCounts={{
                ...(appearanceDirtyCount ? { appearance: appearanceDirtyCount } : {}),
                ...(preferenceDirtyCount ? { preferences: preferenceDirtyCount } : {}),
            }}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            ariaLabel={adminOnly ? 'Admin settings navigation' : 'Account settings navigation'}
            className="min-h-0 gap-3 overflow-x-hidden overflow-y-auto pb-8 pr-1 custom-scrollbar"
            actions={
                <Button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={!hasUnsavedChanges || savingSettings}
                    isLoading={savingSettings}
                    icon={Save}
                    className="h-10 px-4 text-xs sm:h-11 sm:px-5 sm:text-sm"
                >
                    Save Settings
                </Button>
            }
            actionsDefaultOpen
        >
            {activeTab === 'profile' && profileContent}

            {activeTab === 'appearance' && (
                <AccountAppearanceSettingsTab
                    themeMode={themeMode}
                    onThemeModeChange={handleThemeChange}
                />
            )}

            {activeTab === 'preferences' && (
                <AccountPreferencesSettingsTab
                    settings={draftSettings}
                    onNotificationChange={handleNotificationChange}
                />
            )}

            {activeTab === 'security' && (
                <AccountSecuritySettings
                    changePasswordHref={changePasswordHref}
                />
            )}
        </SettingsShell>
    );
}
