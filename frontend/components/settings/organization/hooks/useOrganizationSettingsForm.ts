'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
    onlineAdmissionsEnabled: false,
    onlineAdmissionEmailTemplates: {},
};

const PROFILE_FIELDS = ['name', 'location', 'contactEmail', 'phone'] as const;
const FINANCE_FIELDS = ['currency'] as const;
const ADMISSIONS_FIELDS = ['onlineAdmissionsEnabled', 'onlineAdmissionEmailTemplates'] as const;

function normalizeText(value: string | null | undefined) {
    return (value ?? '').trim();
}

function countChangedFields<T extends keyof OrganizationSettingsFormData>(
    current: OrganizationSettingsFormData,
    saved: OrganizationSettingsFormData,
    fields: readonly T[],
) {
    return fields.filter((field) => normalizeText(String(current[field])) !== normalizeText(String(saved[field]))).length;
}

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
    const { token, user, updateUser } = useAuth();
    const { dispatch } = useGlobal();
    const { setPrimaryColor, setThemeMode, themeMode } = useTheme();
    const [loading, setLoading] = useState(false);
    const [reapplying, setReapplying] = useState(false);
    const [orgData, setOrgData] = useState<Organization | null>(null);
    const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
    const [formErrors, setFormErrors] = useState<OrganizationSettingsFormErrors>({});
    const [formData, setFormData] = useState<OrganizationSettingsFormData>(DEFAULT_FORM_DATA);
    const [savedFormData, setSavedFormData] = useState<OrganizationSettingsFormData>(DEFAULT_FORM_DATA);

    useEffect(() => {
        if (!token || !user || user.role !== Role.ORG_ADMIN) return;

        setLoading(true);
        api.org
            .getOrgData(token)
            .then(async (data: Organization) => {
                const userSettings = await api.auth.getSettings(token);
                setOrgData(data);
                const nextFormData = {
                    name: data.name || '',
                    location: data.location || '',
                    contactEmail: data.contactEmail || '',
                    phone: data.phone || '',
                    currency: data.currency || 'USD',
                    accentColor: {
                        primary: getSafePrimaryColor(data.accentColor?.primary || '#4f46e5'),
                        mode: userSettings.themeMode,
                    },
                    onlineAdmissionsEnabled: Boolean(data.onlineAdmissionsEnabled),
                    onlineAdmissionEmailTemplates: data.onlineAdmissionEmailTemplates || {},
                };
                setFormData(nextFormData);
                setSavedFormData(nextFormData);
            })
            .catch((err) => {
                console.error('Failed to load settings', err);
                const message = err instanceof Error ? err.message : 'Failed to load settings';
                dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            })
            .finally(() => setLoading(false));
    }, [dispatch, token, user]);

    useEffect(() => {
        if (orgData && formData.accentColor.primary) {
            setPrimaryColor(formData.accentColor.primary);
        }
    }, [formData.accentColor.primary, orgData, setPrimaryColor]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData((current) => ({ ...current, [name]: value }));
    };

    const handleLogoReady = useCallback((file: File) => {
        setPendingLogoFile(file);
    }, []);

    const dirtyCounts = useMemo(() => {
        const profile = countChangedFields(formData, savedFormData, PROFILE_FIELDS);
        const finance = countChangedFields(formData, savedFormData, FINANCE_FIELDS);
        const admissions = ADMISSIONS_FIELDS.filter((field) => JSON.stringify(formData[field]) !== JSON.stringify(savedFormData[field])).length;
        const appearance =
            getSafePrimaryColor(formData.accentColor.primary) !== getSafePrimaryColor(savedFormData.accentColor.primary)
                ? 1
                : 0;
        const branding = pendingLogoFile ? 1 : 0;

        return {
            profile,
            finance,
            admissions,
            appearance,
            branding,
            total: profile + finance + admissions + appearance + branding,
        };
    }, [formData, pendingLogoFile, savedFormData]);

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

    const saveSettings = async () => {
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

        if (dirtyCounts.total === 0) return;

        dispatch({ type: 'UI_START_PROCESSING', payload: 'settings-submit' });
        try {
            let savedOrg = orgData;
            if (dirtyCounts.profile > 0 || dirtyCounts.finance > 0 || dirtyCounts.appearance > 0 || dirtyCounts.admissions > 0) {
                savedOrg = await api.org.updateSettings(
                    {
                        name: formData.name,
                        location: formData.location,
                        contactEmail: formData.contactEmail,
                        phone: formData.phone,
                        ...(dirtyCounts.finance > 0 ? { currency: formData.currency } : {}),
                        ...(dirtyCounts.admissions > 0 ? {
                            onlineAdmissionsEnabled: formData.onlineAdmissionsEnabled,
                            onlineAdmissionEmailTemplates: formData.onlineAdmissionEmailTemplates,
                        } : {}),
                        ...(dirtyCounts.appearance > 0
                            ? {
                                accentColor: {
                                    primary: getSafePrimaryColor(formData.accentColor.primary),
                                },
                            }
                            : {}),
                    },
                    token,
                );
                setOrgData(savedOrg);
                dispatch({ type: 'STATS_SET_ORG_DATA', payload: savedOrg });
            }

            if (pendingLogoFile) {
                const logoRes = await api.org.uploadLogo(pendingLogoFile, token);
                const nextOrgData = {
                    ...(savedOrg ?? orgData),
                    logoUrl: logoRes.logoUrl,
                    avatarUpdatedAt: logoRes.avatarUpdatedAt,
                } as Organization;
                setOrgData(nextOrgData);
                dispatch({ type: 'STATS_SET_ORG_DATA', payload: nextOrgData });
                updateUser({
                    orgLogoUrl: logoRes.logoUrl,
                    avatarUpdatedAt: logoRes.avatarUpdatedAt,
                    ...(user?.role === Role.ORG_ADMIN ? { avatarUrl: logoRes.logoUrl } : {}),
                });
                setPendingLogoFile(null);
                savedOrg = nextOrgData;
            }

            if (savedOrg) {
                const nextSavedFormData = {
                    name: savedOrg.name || '',
                    location: savedOrg.location || '',
                    contactEmail: savedOrg.contactEmail || '',
                    phone: savedOrg.phone || '',
                    currency: savedOrg.currency || formData.currency || 'USD',
                    accentColor: {
                        primary: getSafePrimaryColor(savedOrg.accentColor?.primary || formData.accentColor.primary),
                        mode: formData.accentColor.mode,
                    },
                    onlineAdmissionsEnabled: Boolean(savedOrg.onlineAdmissionsEnabled),
                    onlineAdmissionEmailTemplates: savedOrg.onlineAdmissionEmailTemplates || {},
                };
                setFormData(nextSavedFormData);
                setSavedFormData(nextSavedFormData);
            }

            dispatch({
                type: 'TOAST_ADD',
                payload: { message: 'Settings updated successfully!', type: 'success' },
            });
            if (savedOrg?.contactEmailVerifiedAt === null && formData.contactEmail !== savedFormData.contactEmail) {
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

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await saveSettings();
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
        dirtyCounts,
        themeMode,
        setThemeMode,
        handleChange,
        handleLogoReady,
        handlePrimaryColorChange,
        handleSubmit,
        saveSettings,
        handleReapply,
    };
}
