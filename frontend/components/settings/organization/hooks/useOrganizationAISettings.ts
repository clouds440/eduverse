'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { settingsPath } from '@/lib/routes';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import {
    AIOrgSettingsResponse,
    AIOrgUsageResponse,
    AISubscriptionOwnerType,
    AISubscriptionPlan,
    Role,
} from '@/types';

export type AIOrgAccessField =
    | 'allowSubAdmins'
    | 'allowManagers'
    | 'allowFinanceManagers'
    | 'allowTeachers'
    | 'allowStudents'
    | 'allowGuardians';

function getAIUsagePercent(used: number, total: number) {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((used / total) * 100));
}

function getRoleCreditDrafts(settings: AIOrgSettingsResponse) {
    return Object.fromEntries(
        settings.roleCreditPolicies.map((policy) => [
            policy.role,
            String(policy.monthlyCredits),
        ]),
    ) as Partial<Record<Role, string>>;
}

export function useOrganizationAISettings({
    active,
    loading,
    currency,
}: {
    active: boolean;
    loading: boolean;
    currency: string;
}) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const [aiSettings, setAiSettings] = useState<AIOrgSettingsResponse | null>(null);
    const [aiUsage, setAiUsage] = useState<AIOrgUsageResponse | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiRoleCreditDrafts, setAiRoleCreditDrafts] = useState<Partial<Record<Role, string>>>({});

    const fetchAISettings = useCallback(async () => {
        if (!token) return;
        setAiLoading(true);
        try {
            const settings = await api.ai.getOrgSettings(token);
            setAiSettings(settings);
            setAiRoleCreditDrafts(getRoleCreditDrafts(settings));
        } catch (error) {
            console.error('Failed to load EduVerse Copilot settings', error);
            const message = error instanceof Error ? error.message : 'Failed to load EduVerse Copilot settings';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            setAiLoading(false);
        }
    }, [dispatch, token]);

    const refreshAIUsage = useCallback(async () => {
        if (!token) return;
        setAiUsage(await api.ai.getOrgUsage(token));
    }, [token]);

    useEffect(() => {
        if (!active || loading || aiSettings) return;
        void fetchAISettings();
    }, [active, aiSettings, fetchAISettings, loading]);

    const handleAIPlanChange = async (plan: AISubscriptionPlan) => {
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'ai-plan-update' });
        try {
            if (plan !== AISubscriptionPlan.NONE && plan !== AISubscriptionPlan.FREE) {
                const checkout = await api.ai.createOrgBillingCheckout(plan, token);
                if (checkout.checkoutUrl) {
                    window.location.assign(checkout.checkoutUrl);
                    return;
                }
                throw new Error('Lemon Squeezy checkout did not return a redirect URL.');
            }

            const settings = await api.ai.updateOrgSubscription(plan, token);
            setAiSettings(settings);
            setAiRoleCreditDrafts(getRoleCreditDrafts(settings));
            await refreshAIUsage();
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: 'EduVerse Copilot subscription updated.', type: 'success' },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update EduVerse Copilot subscription';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'ai-plan-update' });
        }
    };

    const handleAIBillingPortal = async () => {
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'ai-billing-portal' });
        try {
            const portal = await api.ai.createBillingPortal(
                AISubscriptionOwnerType.ORGANIZATION,
                token,
                user?.id ? settingsPath(user.id, 'ai') : '/',
            );
            window.location.assign(portal.portalUrl);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to open AI billing portal';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'ai-billing-portal' });
        }
    };

    const handleAIAccessToggle = async (field: AIOrgAccessField, enabled: boolean) => {
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: `ai-access-${field}` });
        try {
            const settings = await api.ai.updateOrgAccessPolicy(
                { [field]: enabled } as Partial<AIOrgSettingsResponse['accessPolicy']>,
                token,
            );
            setAiSettings(settings);
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: 'EduVerse Copilot role access updated.', type: 'success' },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update EduVerse Copilot role access';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `ai-access-${field}` });
        }
    };

    const handleAIRoleCreditSave = async (role: Role) => {
        if (!token) return;
        const draftValue = aiRoleCreditDrafts[role] ?? '0';
        const monthlyCredits = Math.max(0, Math.round(Number(draftValue) || 0));
        dispatch({ type: 'UI_START_PROCESSING', payload: `ai-role-credit-${role}` });
        try {
            const settings = await api.ai.updateRoleCreditPolicy(role, monthlyCredits, token);
            setAiSettings(settings);
            setAiRoleCreditDrafts(getRoleCreditDrafts(settings));
            await refreshAIUsage();
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: 'Monthly AI Credits updated.', type: 'success' },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update monthly AI Credits';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `ai-role-credit-${role}` });
        }
    };

    const aiBalance = aiUsage?.usage ?? aiSettings?.usage ?? null;
    const activeAIPlan = aiSettings?.subscription.plan ?? AISubscriptionPlan.NONE;
    const activeAIPlanOption = aiSettings?.plans.find((plan) => plan.plan === activeAIPlan);
    const aiUsagePercent = aiBalance
        ? getAIUsagePercent(aiBalance.usedCredits, aiBalance.monthlyCredits)
        : 0;
    const maxAITrendCredits = Math.max(
        1,
        ...(aiUsage?.trends ?? []).map((point) => point.creditsUsed),
    );

    return {
        aiLoading,
        aiSettings,
        aiUsage,
        aiCurrency: currency,
        aiBalance,
        activeAIPlan,
        activeAIPlanOption,
        aiUsagePercent,
        maxAITrendCredits,
        aiRoleCreditDrafts,
        setAiRoleCreditDrafts,
        fetchAISettings,
        handleAIPlanChange,
        handleAIBillingPortal,
        handleAIAccessToggle,
        handleAIRoleCreditSave,
    };
}
