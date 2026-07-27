'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Settings, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { useTheme } from '@/context/ThemeContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { ThemeMode } from '@/types';
import { Loading } from '@/components/ui/Loading';
import type { PageBreadcrumb } from '@/components/ui/PageShell';
import { SettingsShell } from '../SettingsShell';
import { isSettingsTabKey } from '../settings-tabs';
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
    const [savingTheme, setSavingTheme] = useState(false);
    const [savingNotification, setSavingNotification] = useState<NotificationSettingKey>();

    const requestedTab = getStringParam('tab', defaultTab);
    const activeTab = isSettingsTabKey(ACCOUNT_SETTINGS_TABS, requestedTab)
        ? requestedTab
        : defaultTab;
    useEffect(() => {
        if (!settingsLoading) setThemeMode(settings.themeMode);
    }, [setThemeMode, settings.themeMode, settingsLoading]);

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

    const handleThemeChange = async (mode: ThemeMode) => {
        if (!token || savingTheme) return;
        const previousMode = settings.themeMode;
        setThemeMode(mode);
        setSavingTheme(true);
        try {
            await updateUserSettings({ themeMode: mode });
        } catch (error) {
            setThemeMode(previousMode);
            const message = error instanceof Error ? error.message : 'Failed to save theme preference';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            setSavingTheme(false);
        }
    };

    const handleNotificationChange = async (
        key: NotificationSettingKey,
        enabled: boolean,
    ) => {
        if (!token || savingNotification) return;
        setSavingNotification(key);
        try {
            await updateUserSettings({ [key]: enabled });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save notification preference';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            setSavingNotification(undefined);
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
            activeTab={activeTab}
            onTabChange={handleTabChange}
            ariaLabel={adminOnly ? 'Admin settings navigation' : 'Account settings navigation'}
            className="min-h-0 gap-3 overflow-x-hidden overflow-y-auto pb-8 pr-1 custom-scrollbar"
        >
            {activeTab === 'profile' && profileContent}

            {activeTab === 'preferences' && (
                <AccountPreferencesSettingsTab
                    settings={settings}
                    themeMode={themeMode}
                    savingTheme={savingTheme}
                    savingNotification={savingNotification}
                    onThemeModeChange={handleThemeChange}
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
