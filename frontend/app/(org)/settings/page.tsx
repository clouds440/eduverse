'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
    AlertCircle,
    Building2,
    CheckCircle,
    ExternalLink,
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
    TriangleAlert,
    Unlink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { LinkedAccount, Organization, Role, ThemeMode } from '@/types';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { useGlobal } from '@/context/GlobalContext';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/context/ThemeContext';
import SessionManagement from '@/components/SessionManagement';
import { Loading } from '@/components/ui/Loading';
import { ThemeDropdown } from '@/components/ui/ThemeDropdown';
import { getSafePrimaryColor } from '@/lib/themeColor';
import { ColorSelector } from '@/components/ui/ColorSelector';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageShell';
import { DocsLink } from '@/components/ui/DocsLink';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const SETTINGS_TABS = [
    { key: 'profile', label: 'Profile', icon: Building2 },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'branding', label: 'Branding', icon: School },
    { key: 'security', label: 'Security', icon: ShieldCheck },
] as const;

type SettingsTabKey = typeof SETTINGS_TABS[number]['key'];

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
    const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
    const [redirecting, setRedirecting] = useState(user?.role === Role.ORG_ADMIN ? false : true);
    const [formErrors, setFormErrors] = useState<{ name?: string; location?: string; contactEmail?: string; phone?: string; accentColor?: string; general?: string }>({});
    const pendingHashScrollRef = useRef<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        location: '',
        contactEmail: '',
        phone: '',
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
            router.push(`/teachers/${user.id}/profile${hash}`);
            return;
        }
        if (user.role === Role.SUB_ADMIN) {
            router.push(`/sub-admins/${user.id}/profile${hash}`);
            return;
        }
        if (user.role === Role.STUDENT) {
            router.push(`/students/${user.id}?tab=profile${hash}`);
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
                    else nextErrors.general = item;
                });
            } else {
                const msg = message.toLowerCase();
                if (msg.includes('name')) nextErrors.name = message;
                else if (msg.includes('location')) nextErrors.location = message;
                else if (msg.includes('email')) nextErrors.contactEmail = message;
                else if (msg.includes('phone')) nextErrors.phone = message;
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

    if (loading || redirecting) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loading size="md" />
            </div>
        );
    }

    return (
        <div className="flex w-full flex-1 flex-col gap-6 pb-8">
            <PageHeader
                title="Organization Settings"
                description={<>Identity, contact, appearance, and account security. <DocsLink href="/docs/settings#organization-settings">Read settings docs</DocsLink></>}
                icon={Settings}
                actionsDefaultOpen
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
                        <Button
                            type="submit"
                            form="organization-settings-form"
                            loadingId="settings-submit"
                            className="h-10 px-4 text-xs sm:h-11 sm:px-5 sm:text-sm"
                            icon={Save}
                        >
                            Save Settings
                        </Button>
                    </div>
                )}
            />

            {orgData?.status === 'REJECTED' && (
                <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-danger sm:p-5">
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

            <form id="organization-settings-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
                <nav
                    aria-label="Settings navigation"
                    className="flex gap-1 overflow-x-auto rounded-lg border border-border/70 bg-card/95 p-1 shadow-sm scrollbar-none"
                >
                    {SETTINGS_TABS.map(({ key, label, icon: Icon }) => {
                        const isActive = activeTab === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => handleTabChange(key)}
                                className={cn(
                                    'flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-w-32',
                                    isActive
                                        ? 'bg-background text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                )}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                        );
                    })}
                </nav>

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
        </div>
    );
}
