'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
    AlertCircle,
    Building2,
    BarChart3,
    CheckCircle,
    Coins,
    ExternalLink,
    Gauge,
    Link as LinkIcon,
    Mail,
    MapPin,
    Palette,
    Phone,
    RefreshCw,
    Save,
    School,
    Settings,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    TriangleAlert,
    Unlink,
    Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { AIOrgSettingsResponse, AIOrgUsageResponse, AISubscriptionOwnerType, AISubscriptionPlan, LinkedAccount, Organization, Role, ThemeMode } from '@/types';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { useGlobal } from '@/context/GlobalContext';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useTheme } from '@/context/ThemeContext';
import SessionManagement from '@/components/SessionManagement';
import { Loading } from '@/components/ui/Loading';
import { ThemeDropdown } from '@/components/ui/ThemeDropdown';
import { getSafePrimaryColor } from '@/lib/themeColor';
import { ColorSelector } from '@/components/ui/ColorSelector';
import { Badge } from '@/components/ui/Badge';
import { PageHeader, PageShell, PageTabs } from '@/components/ui/PageShell';
import { DocsLink } from '@/components/ui/DocsLink';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { SUPPORTED_CURRENCY_OPTIONS } from '@/lib/currencies';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const SETTINGS_TABS = [
    { key: 'profile', label: 'Profile', icon: Building2 },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'finance', label: 'Finance', icon: Coins },
    { key: 'ai', label: 'AI Copilot', icon: Sparkles },
    { key: 'branding', label: 'Branding', icon: School },
    { key: 'security', label: 'Security', icon: ShieldCheck },
] as const;

type SettingsTabKey = typeof SETTINGS_TABS[number]['key'];
type AIOrgAccessField = 'allowSubAdmins' | 'allowManagers' | 'allowFinanceManagers' | 'allowTeachers' | 'allowStudents' | 'allowGuardians';

const AI_ROLE_LABELS: Partial<Record<Role, string>> = {
    [Role.ORG_ADMIN]: 'Org admins',
    [Role.SUB_ADMIN]: 'Sub admins',
    [Role.ORG_MANAGER]: 'Managers',
    [Role.FINANCE_MANAGER]: 'Finance managers',
    [Role.TEACHER]: 'Teachers',
    [Role.STUDENT]: 'Students',
    [Role.GUARDIAN]: 'Guardians',
};

const AI_ACCESS_FIELDS: Partial<Record<Role, AIOrgAccessField>> = {
    [Role.SUB_ADMIN]: 'allowSubAdmins',
    [Role.ORG_MANAGER]: 'allowManagers',
    [Role.FINANCE_MANAGER]: 'allowFinanceManagers',
    [Role.TEACHER]: 'allowTeachers',
    [Role.STUDENT]: 'allowStudents',
    [Role.GUARDIAN]: 'allowGuardians',
};

const AI_ACCESS_ROLE_ENTRIES = Object.entries(AI_ACCESS_FIELDS) as [Role, AIOrgAccessField][];

const HASH_TAB_MAP: Record<string, SettingsTabKey> = {
    'contact-email': 'profile',
    'linked-accounts': 'security',
    sessions: 'security',
};

function SettingsSection({
    icon: Icon,
    title,
    description,
    children,
    action,
    className,
    contentClassName,
    id,
}: {
    icon: LucideIcon;
    title: string;
    description?: ReactNode;
    children: ReactNode;
    action?: ReactNode;
    className?: string;
    contentClassName?: string;
    id?: string;
}) {
    return (
        <section id={id} className={cn('overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm', className)}>
            <div className="flex flex-col gap-3 border-b border-border/60 bg-background/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-primary">
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-black text-foreground sm:text-base">{title}</h2>
                        {description && <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-muted-foreground">{description}</p>}
                    </div>
                </div>
                {action && <div className="flex shrink-0 justify-start sm:justify-end">{action}</div>}
            </div>
            <div className={cn('p-4 sm:p-5', contentClassName)}>
                {children}
            </div>
        </section>
    );
}

function SettingsActionLink({
    href,
    icon: Icon,
    children,
}: {
    href: string;
    icon?: LucideIcon;
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
            <span className="min-w-0 text-center">{children}</span>
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
        </Link>
    );
}

function FieldError({ children }: { children?: string }) {
    if (!children) return null;
    return <p className="mt-1.5 text-xs font-semibold text-danger">{children}</p>;
}

function GoogleIcon({ className }: { className?: string }) {
    return <Image src="/assets/svgs/google.svg" alt="" width={20} height={20} className={cn('h-5 w-5', className)} />;
}

function formatAIQuantity(value?: number | null) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0);
}

function formatAICost(value?: number | null) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value ?? 0);
}

function getAIUsagePercent(used: number, total: number) {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((used / total) * 100));
}

export default function SettingsPage() {
    const { token, user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { getStringParam, updateQueryParams } = useUrlQueryState();
    const { dispatch } = useGlobal();
    const { setPrimaryColor, setThemeMode, themeMode } = useTheme();
    const [loading, setLoading] = useState(false);
    const [reapplying, setReapplying] = useState(false);
    const [orgData, setOrgData] = useState<Organization | null>(null);
    const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
    const [linkedAccountsLoading, setLinkedAccountsLoading] = useState(false);
    const [aiSettings, setAiSettings] = useState<AIOrgSettingsResponse | null>(null);
    const [aiUsage, setAiUsage] = useState<AIOrgUsageResponse | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiRoleCreditDrafts, setAiRoleCreditDrafts] = useState<Partial<Record<Role, string>>>({});
    const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
    const [redirecting, setRedirecting] = useState(user?.role === Role.ORG_ADMIN ? false : true);
    const [formErrors, setFormErrors] = useState<{ name?: string; location?: string; contactEmail?: string; phone?: string; currency?: string; accentColor?: string; general?: string }>({});
    const pendingHashScrollRef = useRef<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        location: '',
        contactEmail: '',
        phone: '',
        currency: 'USD',
        accentColor: {
            primary: '#4f46e5',
            mode: ThemeMode.SYSTEM,
        },
    });
    const googleAccount = linkedAccounts.find((account) => account.provider === 'google');
    const tabParam = getStringParam('tab', 'profile') as SettingsTabKey;
    const activeTab = SETTINGS_TABS.some((tab) => tab.key === tabParam) ? tabParam : 'profile';

    const handleTabChange = (tab: SettingsTabKey) => {
        updateQueryParams({ tab: tab === 'profile' ? undefined : tab });
    };

    const fetchLinkedAccounts = useCallback(async () => {
        if (!token) return;
        setLinkedAccountsLoading(true);
        try {
            const accounts = await api.auth.getLinkedAccounts(token);
            setLinkedAccounts(accounts);
        } catch (error) {
            console.error('Failed to load linked accounts', error);
            const message = error instanceof Error ? error.message : 'Failed to load linked accounts';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            setLinkedAccountsLoading(false);
        }
    }, [dispatch, token]);

    const fetchAISettings = useCallback(async () => {
        if (!token) return;
        setAiLoading(true);
        try {
            const settings = await api.ai.getOrgSettings(token);
            setAiSettings(settings);
            setAiRoleCreditDrafts(Object.fromEntries(
                settings.roleCreditPolicies.map((policy) => [policy.role, String(policy.monthlyCredits)]),
            ) as Partial<Record<Role, string>>);
        } catch (error) {
            console.error('Failed to load AI Copilot settings', error);
            const message = error instanceof Error ? error.message : 'Failed to load AI Copilot settings';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            setAiLoading(false);
        }
    }, [dispatch, token]);

    useEffect(() => {
        if (typeof window === 'undefined' || redirecting || loading) return;
        const hash = window.location.hash.replace('#', '') || pendingHashScrollRef.current || '';
        const hashTab = HASH_TAB_MAP[hash];
        if (hashTab && activeTab !== hashTab) {
            pendingHashScrollRef.current = hash;
            updateQueryParams({ tab: hashTab === 'profile' ? undefined : hashTab });
            return;
        }

        if (hashTab) {
            const element = document.getElementById(hash);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                pendingHashScrollRef.current = null;
            }
        }
    }, [activeTab, redirecting, loading, updateQueryParams]);

    useEffect(() => {
        const linkStatus = searchParams.get('googleLink');
        if (!linkStatus) return;

        if (linkStatus === 'success') {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Google account linked successfully.', type: 'success' } });
            updateQueryParams({ tab: 'security', googleLink: undefined });
            void fetchLinkedAccounts();
        }
    }, [dispatch, fetchLinkedAccounts, searchParams, updateQueryParams]);

    useEffect(() => {
        if (!token || !user) return;

        const hash = typeof window !== 'undefined' ? window.location.hash : '';

        if (user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN) {
            router.push(`/admin/settings${hash}`);
            return;
        }
        if (user.role === Role.ORG_MANAGER || user.role === Role.TEACHER) {
            router.push(`/teacher/${user.id}/profile${hash}`);
            return;
        }
        if (user.role === Role.SUB_ADMIN) {
            router.push(`/sub-admin/${user.id}/profile${hash}`);
            return;
        }
        if (user.role === Role.FINANCE_MANAGER) {
            router.push(`/finance-manager/${user.id}/profile${hash}`);
            return;
        }
        if (user.role === Role.STUDENT) {
            router.push(`/student/${user.id}?tab=profile${hash}`);
            return;
        }

        if (user.role !== Role.ORG_ADMIN) return;

        setLoading(true);
        api.org.getOrgData(token)
            .then((data: Organization) => {
                setOrgData(data);
                setFormData({
                    name: data.name || '',
                    location: data.location || '',
                    contactEmail: data.contactEmail || '',
                    phone: data.phone || '',
                    currency: data.currency || 'USD',
                    accentColor: {
                        primary: getSafePrimaryColor(data.accentColor?.primary || '#4f46e5'),
                        mode: (data.accentColor?.mode as ThemeMode) || ThemeMode.SYSTEM,
                    },
                });
                void fetchLinkedAccounts();
            })
            .catch((err) => {
                console.error('Failed to load settings', err);
                const message = err instanceof Error ? err.message : 'Failed to load settings';
                dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            })
            .finally(() => {
                setLoading(false);
                setRedirecting(false);
            });
    }, [token, dispatch, user, router, fetchLinkedAccounts]);

    useEffect(() => {
        if (!redirecting && formData.accentColor.primary) {
            setPrimaryColor(formData.accentColor.primary);
        }
    }, [formData.accentColor.primary, setPrimaryColor, redirecting]);

    useEffect(() => {
        if (activeTab !== 'ai' || redirecting || loading || aiSettings) return;
        void fetchAISettings();
    }, [activeTab, aiSettings, fetchAISettings, loading, redirecting]);

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

        let hasError = false;
        const newErrors: typeof formErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Organization name is required';
            hasError = true;
        }
        if (!formData.location.trim()) {
            newErrors.location = 'Location is required';
            hasError = true;
        }
        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required';
            hasError = true;
        }
        if (!formData.contactEmail.trim()) {
            newErrors.contactEmail = 'Contact email is required';
            hasError = true;
        }


        if (hasError) {
            setFormErrors(newErrors);
            return;
        }

        dispatch({ type: 'UI_START_PROCESSING', payload: 'settings-submit' });
        try {
            const payload = {
                ...formData,
                accentColor: {
                    primary: getSafePrimaryColor(formData.accentColor.primary),
                },
            };

            const updatedSettings = await api.org.updateSettings(payload, token) as Organization;
            setOrgData((current) => current ? { ...current, ...updatedSettings } : updatedSettings);
            dispatch({ type: 'STATS_SET_ORG_DATA', payload: updatedSettings });

            try {
                await api.auth.updateProfile({ themeMode: formData.accentColor.mode }, token);
            } catch (error) {
                console.warn('Failed to save user themeMode', error);
            }

            if (pendingLogoFile) {
                const logoRes = await api.org.uploadLogo(pendingLogoFile, token);
                setOrgData((current) => current ? { ...current, logoUrl: logoRes.logoUrl, avatarUpdatedAt: logoRes.avatarUpdatedAt } : current);
                setPendingLogoFile(null);
            }

            dispatch({ type: 'TOAST_ADD', payload: { message: 'Settings updated successfully!', type: 'success' } });
            if (updatedSettings.contactEmailVerifiedAt === null) {
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Contact email changed. A new verification code has been sent.', type: 'info' } });
            }
        } catch (error: unknown) {
            const errorWithResponse = error as { response?: { data?: { message?: string | string[] } }; message?: string };
            const message = errorWithResponse.response?.data?.message || errorWithResponse.message || 'Failed to update settings. Please try again.';
            const nextErrors: typeof formErrors = {};

            if (Array.isArray(message)) {
                message.forEach((item: string) => {
                    const msg = item.toLowerCase();
                    if (msg.includes('name')) nextErrors.name = item;
                    else if (msg.includes('location')) nextErrors.location = item;
                    else if (msg.includes('email')) nextErrors.contactEmail = item;
                    else if (msg.includes('phone')) nextErrors.phone = item;
                    else if (msg.includes('currency')) nextErrors.currency = item;
                    else nextErrors.general = item;
                });
            } else {
                const msg = message.toLowerCase();
                if (msg.includes('name')) nextErrors.name = message;
                else if (msg.includes('location')) nextErrors.location = message;
                else if (msg.includes('email')) nextErrors.contactEmail = message;
                else if (msg.includes('phone')) nextErrors.phone = message;
                else if (msg.includes('currency')) nextErrors.currency = message;
                else nextErrors.general = message;
            }
            setFormErrors(nextErrors);
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
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Your re-application has been submitted!', type: 'success' } });
            const data = await api.org.getOrgData(token);
            setOrgData(data);
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to re-apply', type: 'error' } });
            console.error('Failed to re-apply', error);
        } finally {
            setReapplying(false);
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
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Google account unlinked successfully.', type: 'success' } });
            await fetchLinkedAccounts();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to unlink Google account';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'unlink-google' });
        }
    };

    const refreshAIUsage = async () => {
        if (!token) return;
        const usage = await api.ai.getOrgUsage(token);
        setAiUsage(usage);
    };

    const handleAIPlanChange = async (plan: AISubscriptionPlan) => {
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'ai-plan-update' });
        try {
            if (plan !== AISubscriptionPlan.NONE) {
                const checkout = await api.ai.createOrgBillingCheckout(plan, token);
                if (checkout.checkoutUrl) {
                    window.location.assign(checkout.checkoutUrl);
                    return;
                }
                throw new Error('Lemon Squeezy checkout did not return a redirect URL.');
            }

            const settings = await api.ai.updateOrgSubscription(plan, token);
            setAiSettings(settings);
            setAiRoleCreditDrafts(Object.fromEntries(
                settings.roleCreditPolicies.map((policy) => [policy.role, String(policy.monthlyCredits)]),
            ) as Partial<Record<Role, string>>);
            await refreshAIUsage();
            dispatch({ type: 'TOAST_ADD', payload: { message: 'AI Copilot subscription updated.', type: 'success' } });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update AI Copilot subscription';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'ai-plan-update' });
        }
    };

    const handleAIBillingPortal = async () => {
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'ai-billing-portal' });
        try {
            const portal = await api.ai.createBillingPortal(AISubscriptionOwnerType.ORGANIZATION, token, '/settings?tab=ai');
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
            const settings = await api.ai.updateOrgAccessPolicy({ [field]: enabled } as Partial<AIOrgSettingsResponse['accessPolicy']>, token);
            setAiSettings(settings);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'AI Copilot role access updated.', type: 'success' } });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update AI Copilot role access';
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
            setAiRoleCreditDrafts(Object.fromEntries(
                settings.roleCreditPolicies.map((policy) => [policy.role, String(policy.monthlyCredits)]),
            ) as Partial<Record<Role, string>>);
            await refreshAIUsage();
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Monthly AI Credits updated.', type: 'success' } });
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
    const aiUsagePercent = aiBalance ? getAIUsagePercent(aiBalance.usedCredits, aiBalance.monthlyCredits) : 0;
    const maxAITrendCredits = Math.max(1, ...(aiUsage?.trends ?? []).map((point) => point.creditsUsed));

    if (loading || redirecting) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loading size="md" />
            </div>
        );
    }

    return (
        <PageShell className="gap-0 overflow-x-hidden overflow-y-auto pb-8 custom-scrollbar">
            <PageHeader
                title="Organization Settings"
                description={<>Identity, contact, appearance, and account security. <DocsLink href="/docs/settings#organization-settings">Read settings docs</DocsLink></>}
                icon={Settings}
                actionsDefaultOpen
                className="mb-0.5"
                actions={(
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {orgData?.status && (
                            <Badge
                                variant={orgData.status === 'APPROVED' ? 'success' : orgData.status === 'REJECTED' ? 'error' : 'warning'}
                                size="md"
                                dot
                            >
                                {orgData.status.replace('_', ' ')}
                            </Badge>
                        )}
                        {activeTab !== 'ai' && (
                            <Button
                                type="submit"
                                form="organization-settings-form"
                                loadingId="settings-submit"
                                className="h-10 px-4 text-xs sm:h-11 sm:px-5 sm:text-sm"
                                icon={Save}
                            >
                                Save Settings
                            </Button>
                        )}
                    </div>
                )}
            />

            {orgData?.status === 'REJECTED' && (
                <div className="mb-0.5 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-danger sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10">
                                <TriangleAlert className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-base font-black">Application rejected</h2>
                                <MarkdownRenderer
                                    content={orgData?.statusHistory && orgData.statusHistory.length > 0
                                        ? orgData.statusHistory[orgData.statusHistory.length - 1].message
                                        : 'Please correct the details below and re-submit for review.'}
                                    className="mt-1 text-sm font-semibold text-danger/80"
                                />
                            </div>
                        </div>
                        <Button
                            onClick={handleReapply}
                            disabled={reapplying}
                            icon={RefreshCw}
                            variant="danger"
                            className="w-full shrink-0 lg:w-auto"
                        >
                            Re-submit for Review
                        </Button>
                    </div>
                </div>
            )}
            <PageTabs
                ariaLabel="Settings navigation"
                items={SETTINGS_TABS.map(({ key, label, icon }) => ({ value: key, label, icon }))}
                activeValue={activeTab}
                onValueChange={handleTabChange}
                hideOnScroll
            />

            <form id="organization-settings-form" onSubmit={handleSubmit} className="min-w-0" noValidate>
                <div className="min-w-0">

                    {activeTab === 'profile' && (
                        <div className="grid gap-4">
                            <SettingsSection
                                icon={Building2}
                                title="Organization Profile"
                                description={<>These details identify the organization across dashboards and records. <DocsLink href="/docs/settings#organization-profile">Profile details</DocsLink></>}
                            >
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="settings-name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Organization Name</Label>
                                        <Input
                                            id="settings-name"
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            icon={School}
                                            placeholder="School Name"
                                            error={!!formErrors.name}
                                            className="h-11 border-border/60 bg-background/70 font-medium"
                                        />
                                        <FieldError>{formErrors.name}</FieldError>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="settings-location" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Location</Label>
                                        <Input
                                            id="settings-location"
                                            type="text"
                                            name="location"
                                            value={formData.location}
                                            onChange={handleChange}
                                            required
                                            icon={MapPin}
                                            placeholder="City, State"
                                            error={!!formErrors.location}
                                            className="h-11 border-border/60 bg-background/70 font-medium"
                                        />
                                        <FieldError>{formErrors.location}</FieldError>
                                    </div>

                                    <div id="contact-email" className="space-y-2 scroll-mt-24">
                                        <Label htmlFor="settings-contact-email" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Contact Email</Label>
                                        <Input
                                            id="settings-contact-email"
                                            type="email"
                                            name="contactEmail"
                                            value={formData.contactEmail}
                                            onChange={handleChange}
                                            icon={Mail}
                                            placeholder="contact@example.com"
                                            error={!!formErrors.contactEmail}
                                            className="h-11 border-border/60 bg-background/70 font-medium"
                                        />
                                        <FieldError>{formErrors.contactEmail}</FieldError>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="settings-phone" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Phone Number</Label>
                                        <Input
                                            id="settings-phone"
                                            type="text"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            icon={Phone}
                                            placeholder="+1 (555) 000-0000"
                                            error={!!formErrors.phone}
                                            className="h-11 border-border/60 bg-background/70 font-medium"
                                        />
                                        <FieldError>{formErrors.phone}</FieldError>
                                    </div>
                                </div>
                            </SettingsSection>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
                            <SettingsSection
                                icon={Palette}
                                title="Accent Color"
                                description={<>Choose the primary accent for this workspace. <DocsLink href="/docs/settings#appearance-theme">Appearance details</DocsLink></>}
                            >
                                <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                                    <ColorSelector
                                        value={formData.accentColor.primary}
                                        onChange={handlePrimaryColorChange}
                                        ariaLabelPrefix="accent color"
                                    />
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                                        <p className="font-mono text-sm font-black uppercase text-foreground">{formData.accentColor.primary}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Selected</span>
                                            <span className="h-6 w-6 rounded-md border border-border/60 bg-primary shadow-xs" />
                                        </div>
                                    </div>
                                </div>
                            </SettingsSection>

                            <SettingsSection
                                icon={Settings}
                                title="Theme Mode"
                                description="Set the preferred display mode for your account."
                            >
                                <div className="space-y-4">
                                    <ThemeDropdown
                                        currentMode={themeMode}
                                        onModeChange={(mode) => {
                                            setFormData((current) => ({ ...current, accentColor: { ...current.accentColor, mode } }));
                                            setThemeMode(mode);
                                        }}
                                    />
                                    <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Preview</p>
                                        <div className="mt-3 flex items-center gap-2">
                                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: formData.accentColor.primary }} />
                                            <span className="h-3 w-12 rounded-full bg-muted" />
                                            <span className="h-3 w-8 rounded-full bg-foreground/20" />
                                        </div>
                                    </div>
                                </div>
                            </SettingsSection>
                        </div>
                    )}

                    {activeTab === 'finance' && (
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
                            <SettingsSection
                                icon={Coins}
                                title="Organization Currency"
                                description="Set the default currency used across finance structures, salary records, fee book amounts, and finance dashboards."
                            >
                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)] md:items-start">
                                    <div className="space-y-2">
                                        <Label htmlFor="settings-currency" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Default Currency</Label>
                                        <CustomSelect
                                            value={formData.currency}
                                            onChange={(value) => {
                                                setFormErrors((current) => ({ ...current, currency: undefined }));
                                                setFormData((current) => ({ ...current, currency: value }));
                                            }}
                                            options={SUPPORTED_CURRENCY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                                            placeholder="Choose currency"
                                            searchable
                                            error={!!formErrors.currency}
                                        />
                                        <FieldError>{formErrors.currency}</FieldError>
                                    </div>
                                    <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Current setting</p>
                                        <p className="mt-2 text-2xl font-black text-foreground">{formData.currency}</p>
                                        <p className="mt-1 text-xs font-semibold text-muted-foreground">Existing financial structures are updated to this currency when settings are saved.</p>
                                    </div>
                                </div>
                            </SettingsSection>

                            <SettingsSection icon={CheckCircle} title="Finance Coverage" description="Where this currency appears after saving.">
                                <div className="space-y-3 text-sm">
                                    {['Finance structures', 'Student fee book', 'Teacher salary overview', 'Finance dashboard insights'].map((item) => (
                                        <div key={item} className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2.5">
                                            <span className="font-semibold text-muted-foreground">{item}</span>
                                            <Badge variant="success" size="sm" dot>{formData.currency}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </SettingsSection>
                        </div>
                    )}
                    {activeTab === 'ai' && (
                        <div className="grid gap-4">
                            {aiLoading && !aiSettings ? (
                                <div className="flex min-h-56 items-center justify-center rounded-lg border border-border/70 bg-card">
                                    <Loading size="md" />
                                </div>
                            ) : !aiSettings || activeAIPlan === AISubscriptionPlan.NONE || aiSettings.subscription.status !== 'ACTIVE' ? (
                                <SettingsSection
                                    icon={Sparkles}
                                    title="AI Copilot Settings"
                                    description="Organization AI settings are available after an active organization AI subscription is started."
                                    action={(
                                        <Button
                                            type="button"
                                            variant="primary"
                                            icon={ExternalLink}
                                            onClick={() => router.push('/ai/subscription')}
                                            className="text-xs"
                                            px="px-3"
                                            py="py-2"
                                        >
                                            Subscribe
                                        </Button>
                                    )}
                                >
                                    <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                                        <p className="text-sm font-black text-foreground">No active organization AI subscription</p>
                                        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                                            Use the dedicated subscription page to start or change the organization package. Usage dashboards live under AI Copilot, separate from configuration.
                                        </p>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <Link
                                                href="/ai/subscription"
                                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary px-3 py-2 text-xs font-black text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                                            >
                                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                                                View AI Packages
                                            </Link>
                                            <Link
                                                href="/ai"
                                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70"
                                            >
                                                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                                                Usage
                                            </Link>
                                        </div>
                                    </div>
                                </SettingsSection>
                            ) : (
                                <>
                                    <SettingsSection
                                        icon={Sparkles}
                                        title="AI Copilot Settings"
                                        description="Configure who can use the active organization AI package and how monthly credits are allocated."
                                        action={(
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Link
                                                    href="/ai/subscription"
                                                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70"
                                                >
                                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                                    View/change subscription
                                                </Link>
                                                <Link
                                                    href="/ai"
                                                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70"
                                                >
                                                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                                                    Usage
                                                </Link>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    icon={RefreshCw}
                                                    onClick={fetchAISettings}
                                                    disabled={aiLoading}
                                                    className="text-xs"
                                                    px="px-3"
                                                    py="py-2"
                                                >
                                                    Refresh
                                                </Button>
                                            </div>
                                        )}
                                    >
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Plan</p>
                                                <p className="mt-2 text-2xl font-black text-foreground">{activeAIPlanOption?.label ?? activeAIPlan}</p>
                                                <p className="mt-1 text-xs font-semibold text-muted-foreground">{aiSettings.subscription.status}</p>
                                            </div>
                                            <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Monthly Credits</p>
                                                <p className="mt-2 text-2xl font-black text-foreground">{formatAIQuantity(aiSettings.subscription.monthlyCredits)}</p>
                                                <p className="mt-1 text-xs font-semibold text-muted-foreground">{aiSettings.subscription.limitMode} limit</p>
                                            </div>
                                            <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Subscription</p>
                                                <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">Plan changes and billing live in the dedicated subscription flow.</p>
                                            </div>
                                        </div>
                                    </SettingsSection>

                                    <div className="grid gap-4 xl:grid-cols-2">
                                        <SettingsSection
                                            icon={Users}
                                            title="Role Access"
                                            description="Choose which organization roles can use organization-funded AI Copilot."
                                        >
                                            <div className="space-y-3">
                                                {aiSettings?.warning && (
                                                    <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm font-semibold text-warning">
                                                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                                        <span>{aiSettings.warning}</span>
                                                    </div>
                                                )}
                                                <div className="grid gap-2">
                                                    {AI_ACCESS_ROLE_ENTRIES.map(([role, field]) => {
                                                        const checked = Boolean(aiSettings?.accessPolicy[field]);
                                                        return (
                                                            <label key={role} className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2.5">
                                                                <span className="text-sm font-semibold text-foreground">{AI_ROLE_LABELS[role as Role] ?? role}</span>
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                                                                    checked={checked}
                                                                    disabled={!aiSettings}
                                                                    onChange={(event) => handleAIAccessToggle(field, event.target.checked)}
                                                                />
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </SettingsSection>

                                        <SettingsSection
                                            icon={Gauge}
                                            title="Role Monthly Credits"
                                            description="Set monthly per-user credit caps for each role using the organization plan."
                                        >
                                            <div className="space-y-2">
                                                {(aiSettings?.roleCreditPolicies ?? []).map((policy) => (
                                                    <div key={policy.role} className="grid gap-2 rounded-md border border-border/70 bg-background/60 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(140px,0.4fr)_auto] sm:items-center">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-black text-foreground">{AI_ROLE_LABELS[policy.role] ?? policy.role}</p>
                                                            <p className="text-xs font-semibold text-muted-foreground">Per user each month</p>
                                                        </div>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            value={aiRoleCreditDrafts[policy.role] ?? String(policy.monthlyCredits)}
                                                            onChange={(event) => setAiRoleCreditDrafts((current) => ({ ...current, [policy.role]: event.target.value }))}
                                                            className="h-10 border-border/60 bg-background/70 font-medium"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            loadingId={`ai-role-credit-${policy.role}`}
                                                            onClick={() => handleAIRoleCreditSave(policy.role)}
                                                            className="text-xs"
                                                            px="px-3"
                                                            py="py-2"
                                                        >
                                                            Save
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </SettingsSection>
                                    </div>

                                    {false && (
                                    <SettingsSection
                                        icon={BarChart3}
                                        title="AI Usage Dashboard"
                                        description="Track credits, active users, feature usage, and rough cost estimates for the current billing period."
                                    >
                                        <div className="grid gap-4 xl:grid-cols-3">
                                            <div className="space-y-2">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Top Users</p>
                                                {(aiUsage?.topUsers ?? []).length === 0 ? (
                                                    <p className="rounded-md border border-border/70 bg-background/60 p-3 text-sm font-semibold text-muted-foreground">No AI usage recorded yet.</p>
                                                ) : aiUsage?.topUsers.map((row) => (
                                                    <div key={row.userId} className="rounded-md border border-border/70 bg-background/60 p-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="min-w-0 truncate text-sm font-black text-foreground">{row.name}</p>
                                                            <Badge variant="secondary" size="sm">{formatAIQuantity(row.creditsUsed)}</Badge>
                                                        </div>
                                                        <p className="mt-1 text-xs font-semibold text-muted-foreground">{AI_ROLE_LABELS[row.role as Role] ?? row.role ?? 'User'} · {formatAICost(row.estimatedCost)}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Feature Usage</p>
                                                {(aiUsage?.featureUsage ?? []).length === 0 ? (
                                                    <p className="rounded-md border border-border/70 bg-background/60 p-3 text-sm font-semibold text-muted-foreground">Tool usage appears here after Copilot tools run.</p>
                                                ) : aiUsage?.featureUsage.map((row) => (
                                                    <div key={row.toolName} className="rounded-md border border-border/70 bg-background/60 p-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="min-w-0 truncate text-sm font-black text-foreground">{row.toolName}</p>
                                                            <Badge variant="primary" size="sm">{row.calls}</Badge>
                                                        </div>
                                                        <p className="mt-1 text-xs font-semibold text-muted-foreground">{row.allowed} allowed · {row.denied} denied</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Usage Trend</p>
                                                {(aiUsage?.trends ?? []).length === 0 ? (
                                                    <p className="rounded-md border border-border/70 bg-background/60 p-3 text-sm font-semibold text-muted-foreground">Daily credit trends appear after usage is recorded.</p>
                                                ) : aiUsage?.trends.map((point) => (
                                                    <div key={point.date} className="rounded-md border border-border/70 bg-background/60 p-3">
                                                        <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                            <span>{point.date}</span>
                                                            <span>{formatAIQuantity(point.creditsUsed)}</span>
                                                        </div>
                                                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                                                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, Math.round((point.creditsUsed / maxAITrendCredits) * 100))}%` }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </SettingsSection>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    {activeTab === 'branding' && (
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
                            <SettingsSection
                                icon={School}
                                title="Organization Logo"
                                description={<>Upload a square organization mark. <DocsLink href="/docs/settings#branding-logo">Logo details</DocsLink></>}
                                contentClassName="sm:p-6"
                            >
                                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                                    <PhotoUploadPicker
                                        currentImageUrl={orgData?.logoUrl}
                                        updatedAt={orgData?.avatarUpdatedAt}
                                        onFileReady={handleLogoReady}
                                        type="org"
                                        sizeClassName="h-32 w-32"
                                        hint="Saved when you click Save Settings"
                                    />
                                    <div className="min-w-0 space-y-3">
                                        <p className="text-sm font-semibold leading-6 text-muted-foreground">
                                            Use a clear square mark that still reads well in small navigation and table views.
                                        </p>
                                        {pendingLogoFile && (
                                            <Badge variant="primary" size="md" icon={CheckCircle}>New logo ready</Badge>
                                        )}
                                    </div>
                                </div>
                            </SettingsSection>

                            <SettingsSection icon={CheckCircle} title="Logo Status" description="Saved logo state for this workspace.">
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2.5">
                                        <span className="font-semibold text-muted-foreground">Current logo</span>
                                        <Badge variant={orgData?.logoUrl ? 'success' : 'secondary'} size="sm">
                                            {orgData?.logoUrl ? 'Available' : 'Not set'}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2.5">
                                        <span className="font-semibold text-muted-foreground">Pending change</span>
                                        <Badge variant={pendingLogoFile ? 'primary' : 'secondary'} size="sm">
                                            {pendingLogoFile ? 'Ready to save' : 'None'}
                                        </Badge>
                                    </div>
                                </div>
                            </SettingsSection>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="grid gap-4 xl:grid-cols-2">
                            <SettingsSection
                                icon={ShieldCheck}
                                title="Contact Verification"
                                description="Password recovery uses the verified contact email."
                                action={(
                                    orgData?.contactEmailVerifiedAt ? (
                                        <Badge variant="success" size="md" icon={CheckCircle}>Verified</Badge>
                                    ) : (
                                        <Badge variant="warning" size="md" icon={TriangleAlert}>Pending</Badge>
                                    )
                                )}
                            >
                                <div className="flex flex-col gap-4 rounded-lg border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-black text-foreground">{formData.contactEmail || 'No contact email'}</p>
                                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                            Update this from the Profile tab when the organization contact changes.
                                        </p>
                                    </div>
                                    <SettingsActionLink href="/change-password" icon={ExternalLink}>
                                        Change Password
                                    </SettingsActionLink>
                                </div>
                            </SettingsSection>

                            <SettingsSection
                                id="linked-accounts"
                                icon={LinkIcon}
                                title="Linked Accounts"
                                description="Use linked providers as alternate sign-in methods."
                            >
                                <div className="flex flex-col gap-4 rounded-lg border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-foreground">
                                            <Image src="/assets/svgs/google.svg" alt="" width={24} height={24} className="h-6 w-6" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-black text-foreground">Google</p>
                                                {googleAccount ? (
                                                    <Badge variant="success" size="sm" dot>Linked</Badge>
                                                ) : (
                                                    <Badge variant="secondary" size="sm">Not linked</Badge>
                                                )}
                                            </div>
                                            {googleAccount ? (
                                                <div className="mt-1 space-y-0.5 text-xs font-semibold text-muted-foreground">
                                                    {googleAccount.email && <p className="truncate">Linked as {googleAccount.email}</p>}
                                                    <p>Linked on {new Date(googleAccount.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            ) : (
                                                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                                    Link Google after signing in with your EduVerse password.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {googleAccount ? (
                                        <Button
                                            type="button"
                                            variant="danger"
                                            icon={Unlink}
                                            onClick={handleUnlinkGoogle}
                                            loadingId="unlink-google"
                                            disabled={linkedAccountsLoading}
                                            className="w-full shrink-0 text-xs sm:w-auto"
                                            px="px-4"
                                            py="py-2.5"
                                        >
                                            Unlink Google
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            icon={GoogleIcon}
                                            onClick={handleStartGoogleLink}
                                            disabled={linkedAccountsLoading}
                                            className="w-full shrink-0 text-xs sm:w-auto"
                                            px="px-4"
                                            py="py-2.5"
                                        >
                                            Link Google
                                        </Button>
                                    )}
                                </div>
                            </SettingsSection>
                        </div>
                    )}
                </div>

                {formErrors.general && (
                    <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm font-semibold text-danger">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>{formErrors.general}</span>
                    </div>
                )}
            </form>

            {activeTab === 'security' && (
                <div id="sessions" className="scroll-mt-24">
                    <SessionManagement userId={user?.id} />
                </div>
            )}
        </PageShell>
    );
}



