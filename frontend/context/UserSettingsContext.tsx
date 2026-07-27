'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { api } from '@/lib/api';
import { ThemeMode, TwoFactorMethod, type UserSettings } from '@/types';
import { useAuth } from './AuthContext';

export const DEFAULT_USER_SETTINGS: UserSettings = {
    twoFactorEnabled: false,
    twoFactorMethod: TwoFactorMethod.DEVICE,
    emailTwoFactorEnabled: false,
    deviceTwoFactorEnabled: false,
    themeMode: ThemeMode.SYSTEM,
    loginNotificationEmail: true,
    loginNotificationPush: true,
    marketingEmails: false,
};

interface UserSettingsContextValue {
    settings: UserSettings;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<UserSettings | null>;
    update: (changes: Partial<UserSettings>) => Promise<UserSettings>;
}

const UserSettingsContext = createContext<UserSettingsContextValue | null>(null);

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
    const { token } = useAuth();
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        if (!token) return null;
        setLoading(true);
        setError(null);
        try {
            const next = await api.auth.getSettings(token);
            setSettings(next);
            return next;
        } catch (cause) {
            const nextError = cause instanceof Error ? cause : new Error('Unable to load account settings.');
            setError(nextError);
            throw nextError;
        } finally {
            setLoading(false);
        }
    }, [token]);

    const update = useCallback(async (changes: Partial<UserSettings>) => {
        if (!token) throw new Error('Sign in to update account settings.');
        const next = await api.auth.updateSettings(changes, token);
        setSettings(next);
        return next;
    }, [token]);

    useEffect(() => {
        if (!token) {
            setSettings(DEFAULT_USER_SETTINGS);
            setError(null);
            setLoading(false);
            return;
        }
        void refresh().catch(() => undefined);
    }, [refresh, token]);

    const value = useMemo(
        () => ({ settings, loading, error, refresh, update }),
        [error, loading, refresh, settings, update],
    );

    return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>;
}

export function useUserSettings() {
    const context = useContext(UserSettingsContext);
    if (!context) {
        throw new Error('useUserSettings must be used within UserSettingsProvider');
    }
    return context;
}
