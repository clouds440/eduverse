'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { api } from '@/lib/api';
import { getSafePrimaryColor } from '@/lib/themeColor';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { useTheme } from '@/context/ThemeContext';
import { Organization, Role, ThemeMode } from '@/types';
import type {
    OrganizationSettingsFormData,
    OrganizationSettingsFormErrors,
} from '@/components/settings/organization/types';

const DEFAULT_FORM_DATA: OrganizationSettingsFormData = {
    name: '',
    location: '',
    contactEmail: '',
    phone: '',
    currency: 'USD',
    accentColor: {
        primary: '#4f46e5',
        mode: ThemeMode.SYSTEM,
    },
};

function mapSettingsError(message: string | string[]) {
    const nextErrors: OrganizationSettingsFormErrors = {};
    const messages = Array.isArray(message) ? message : [message];

    messages.forEach((item) => {
        const msg = item.toLowerCase();
        if (msg.includes('name')) nextErrors.name = item;
        else if (msg.includes('location')) nextErrors.location = item;
        else if (msg.includes('email')) nextErrors.contactEmail = item;
        else if (msg.includes('phone')) nextErrors.phone = item;
        else if (msg.includes('currency')) nextErrors.currency = item;
        else nextErrors.general = item;
    });

    return nextErrors;
}

export function useOrganizationSettingsForm() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { setPrimaryColor, setThemeMode, themeMode } = useTheme();
    const [loading, setLoading] = useState(false);
    const [reapplying, setReapplying] = useState(false);
    const [orgData, setOrgData] = useState<Organization | null>(null);
    const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
    const [formErrors, setFormErrors] = useState<OrganizationSettingsFormErrors>({});
    const [formData, setFormData] = useState<OrganizationSettingsFormData>(DEFAULT_FORM_DATA);

    useEffect(() => {
        if (!token || !user || user.role !== Role.ORG_ADMIN) return;

        setLoading(true);
        api.org
            .getOrgData(token)
            .then(async (data: Organization) => {
                const userSettings = await api.auth.getSettings(token);
                setOrgData(data);
                setFormData({
                    name: data.name || '',
                    location: data.location || '',
                    contactEmail: data.contactEmail || '',
                    phone: data.phone || '',
                    currency: data.currency || 'USD',
                    accentColor: {
                        primary: getSafePrimaryColor(data.accentColor?.primary || '#4f46e5'),
                        mode: userSettings.themeMode,
                    },
                });
            })
            .catch((err) => {
                console.error('Failed to load settings', err);
                const message = err instanceof Error ? err.message : 'Failed to load settings';
                dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            })
            .finally(() => setLoading(false));
    }, [dispatch, token, user]);

    useEffect(() => {
        if (formData.accentColor.primary) {
            setPrimaryColor(formData.accentColor.primary);
        }
    }, [formData.accentColor.primary, setPrimaryColor]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData((current) => ({ ...current, [name]: value }));
    };

    const handleLogoReady = useCallback((file: File) => {
        setPendingLogoFile(file);
    }, []);

    const handlePrimaryColorChange = (newPrimary: string) => {
        setFormErrors((current) => ({ ...current, accentColor: undefined }));
        setFormData((current) => ({
            ...current,
            accentColor: {
                ...current.accentColor,
                primary: getSafePrimaryColor(newPrimary),
            },
        }));
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;
        setFormErrors({});

        const nextErrors: OrganizationSettingsFormErrors = {};
        if (!formData.name.trim()) nextErrors.name = 'Organization name is required';
        if (!formData.location.trim()) nextErrors.location = 'Location is required';
        if (!formData.phone.trim()) nextErrors.phone = 'Phone number is required';
        if (!formData.contactEmail.trim()) nextErrors.contactEmail = 'Contact email is required';

        if (Object.keys(nextErrors).length) {
            setFormErrors(nextErrors);
            return;
        }

        dispatch({ type: 'UI_START_PROCESSING', payload: 'settings-submit' });
        try {
            const updatedSettings = await api.org.updateSettings(
                {
                    ...formData,
                    accentColor: {
                        primary: getSafePrimaryColor(formData.accentColor.primary),
                    },
                },
                token,
            );
            setOrgData((current) => (current ? { ...current, ...updatedSettings } : updatedSettings));
            dispatch({ type: 'STATS_SET_ORG_DATA', payload: updatedSettings });

            try {
                await api.auth.updateSettings({ themeMode: formData.accentColor.mode }, token);
            } catch (error) {
                console.warn('Failed to save user themeMode', error);
            }

            if (pendingLogoFile) {
                const logoRes = await api.org.uploadLogo(pendingLogoFile, token);
                setOrgData((current) =>
                    current
                        ? {
                            ...current,
                            logoUrl: logoRes.logoUrl,
                            avatarUpdatedAt: logoRes.avatarUpdatedAt,
                        }
                        : current,
                );
                setPendingLogoFile(null);
            }

            dispatch({
                type: 'TOAST_ADD',
                payload: { message: 'Settings updated successfully!', type: 'success' },
            });
            if (updatedSettings.contactEmailVerifiedAt === null) {
                dispatch({
                    type: 'TOAST_ADD',
                    payload: {
                        message: 'Contact email changed. A new verification code has been sent.',
                        type: 'info',
                    },
                });
            }
        } catch (error: unknown) {
            const errorWithResponse = error as {
                response?: { data?: { message?: string | string[] } };
                message?: string;
            };
            const message =
                errorWithResponse.response?.data?.message ||
                errorWithResponse.message ||
                'Failed to update settings. Please try again.';
            setFormErrors(mapSettingsError(message));
            console.error('Failed to update settings', error);
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'settings-submit' });
        }
    };

    const handleReapply = async () => {
        if (!token) return;
        setReapplying(true);
        try {
            await api.org.reapply(token);
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: 'Your re-application has been submitted!', type: 'success' },
            });
            setOrgData(await api.org.getOrgData(token));
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to re-apply', type: 'error' } });
            console.error('Failed to re-apply', error);
        } finally {
            setReapplying(false);
        }
    };

    return {
        loading,
        reapplying,
        orgData,
        formData,
        setFormData,
        formErrors,
        setFormErrors,
        pendingLogoFile,
        themeMode,
        setThemeMode,
        handleChange,
        handleLogoReady,
        handlePrimaryColorChange,
        handleSubmit,
        handleReapply,
    };
}
