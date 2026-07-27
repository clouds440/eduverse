'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import {
    Role,
    ThemeMode,
    type LinkedAccount,
} from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/api';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { AccountAppearanceSettingsTab } from '@/components/settings/account/AccountAppearanceSettingsTab';
import { AccountSecuritySettings } from '@/components/settings/account/AccountSecuritySettings';
import {
    NotificationSettingsTab,
    type NotificationSettingKey,
} from '@/components/settings/account/NotificationSettingsTab';
import {
    ADMIN_SETTINGS_TABS,
    type AdminSettingsTabKey,
} from '@/components/settings/admin/admin-settings-tabs';
import { isSettingsTabKey } from '@/components/settings/settings-tabs';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell, PageTabs } from '@/components/ui/PageShell';
import { useUserSettings } from '@/context/UserSettingsContext';

const HASH_TABS: Record<string, AdminSettingsTabKey> = {
    'linked-accounts': 'security',
    sessions: 'security',
};

export default function AdminSettingsPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { themeMode, setThemeMode } = useTheme();
    const { settings, loading: settingsLoading, update: updateUserSettings } = useUserSettings();
    const { getStringParam, searchParams, updateQueryParams } = useUrlQueryState();
    const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [linkedAccountsLoading, setLinkedAccountsLoading] = useState(false);
    const [savingTheme, setSavingTheme] = useState(false);
    const [savingNotification, setSavingNotification] = useState<NotificationSettingKey>();

    const requestedTab = getStringParam('tab', 'appearance');
    const activeTab = isSettingsTabKey(ADMIN_SETTINGS_TABS, requestedTab)
        ? requestedTab
        : 'appearance';
    const googleAccount = useMemo(
        () => linkedAccounts.find((account) => account.provider === 'google'),
        [linkedAccounts],
    );

    const fetchLinkedAccounts = useCallback(async () => {
        if (!token) return;
        setLinkedAccountsLoading(true);
        try {
            setLinkedAccounts(await api.auth.getLinkedAccounts(token));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load linked accounts';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            setLinkedAccountsLoading(false);
        }
    }, [dispatch, token]);

    useEffect(() => {
        if (!user) return;
        if (user.role !== Role.SUPER_ADMIN && user.role !== Role.PLATFORM_ADMIN) {
            window.location.replace('/');
        }
    }, [user]);

    useEffect(() => {
        if (!token || !user) return;
        if (user.role !== Role.SUPER_ADMIN && user.role !== Role.PLATFORM_ADMIN) return;

        setLoading(true);
        api.auth.getLinkedAccounts(token)
            .then((accounts) => setLinkedAccounts(accounts))
            .catch((error) => {
                const message = error instanceof Error ? error.message : 'Failed to load account settings';
                dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            })
            .finally(() => setLoading(false));
    }, [dispatch, token, user]);

    useEffect(() => {
        if (!settingsLoading) setThemeMode(settings.themeMode);
    }, [setThemeMode, settings.themeMode, settingsLoading]);

    useEffect(() => {
        const googleLink = searchParams.get('googleLink');
        if (googleLink !== 'success') return;

        dispatch({
            type: 'TOAST_ADD',
            payload: { message: 'Google account linked successfully.', type: 'success' },
        });
        updateQueryParams({ tab: 'security', googleLink: undefined });
        void fetchLinkedAccounts();
    }, [dispatch, fetchLinkedAccounts, searchParams, updateQueryParams]);

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

    const handleStartGoogleLink = () => {
        window.location.href = api.auth.getGoogleLinkUrl();
    };

    const handleUnlinkGoogle = async () => {
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'unlink-google' });
        try {
            await api.auth.unlinkGoogle(token);
            await fetchLinkedAccounts();
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: 'Google account unlinked successfully.', type: 'success' },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to unlink Google account';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'unlink-google' });
        }
    };

    if (!user || loading || settingsLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loading size="md" />
            </div>
        );
    }

    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.PLATFORM_ADMIN) {
        return null;
    }

    return (
        <PageShell className="min-h-0 gap-3 overflow-x-hidden overflow-y-auto pb-8 pr-1 custom-scrollbar">
            <PageHeader
                title="Admin Settings"
                description="Personal appearance, notifications, sign-in methods, and account security."
                icon={Settings}
                breadcrumbs={[
                    { label: 'Admin' },
                    { label: 'Settings' },
                ]}
            />

            <PageTabs
                ariaLabel="Admin settings navigation"
                items={ADMIN_SETTINGS_TABS.map(({ key, label, icon }) => ({
                    value: key,
                    label,
                    icon,
                }))}
                activeValue={activeTab}
                onValueChange={(tab) => updateQueryParams({
                    tab: tab === 'appearance' ? undefined : tab,
                })}
                hideOnScroll
            />

            {activeTab === 'appearance' && (
                <AccountAppearanceSettingsTab
                    themeMode={themeMode}
                    saving={savingTheme}
                    onThemeModeChange={handleThemeChange}
                />
            )}

            {activeTab === 'notifications' && (
                <NotificationSettingsTab
                    settings={settings}
                    savingKey={savingNotification}
                    onChange={handleNotificationChange}
                />
            )}

            {activeTab === 'security' && (
                <AccountSecuritySettings
                    googleAccount={googleAccount}
                    linkedAccountsLoading={linkedAccountsLoading}
                    changePasswordHref="/admin/change-password"
                    onStartGoogleLink={handleStartGoogleLink}
                    onUnlinkGoogle={handleUnlinkGoogle}
                />
            )}
        </PageShell>
    );
}
