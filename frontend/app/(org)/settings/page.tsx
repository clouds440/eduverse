'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
    AlertCircle,
    Building2,
    CheckCircle,
    ExternalLink,
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Organization, Role, ThemeMode } from '@/types';
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
import Link from 'next/link';

function SettingsSection({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: LucideIcon;
    title: string;
    description?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
            <div className="flex items-start gap-3 border-b border-border/60 bg-background/45 px-4 py-4 sm:px-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-primary">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-base font-black text-foreground">{title}</h2>
                    {description && <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">{description}</p>}
                </div>
            </div>
            <div className="p-4 sm:p-5">
                {children}
            </div>
        </section>
    );
}

function FieldError({ children }: { children?: string }) {
    if (!children) return null;
    return <p className="mt-1.5 text-xs font-semibold text-danger">{children}</p>;
}

export default function SettingsPage() {
    const { token, user } = useAuth();
    const router = useRouter();
    const { dispatch } = useGlobal();
    const { setPrimaryColor, setThemeMode, themeMode } = useTheme();
    const [loading, setLoading] = useState(false);
    const [reapplying, setReapplying] = useState(false);
    const [orgData, setOrgData] = useState<Organization | null>(null);
    const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
    const [redirecting, setRedirecting] = useState(user?.role === Role.ORG_ADMIN ? false : true);
    const [formErrors, setFormErrors] = useState<{ name?: string; location?: string; contactEmail?: string; phone?: string; accentColor?: string; general?: string }>({});

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

    useEffect(() => {
        const hash = window.location.hash;
        if ((hash === '#sessions' || hash === '#contact-email') && !redirecting && !loading) {
            const element = document.getElementById(hash.slice(1));
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [redirecting, loading]);

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
    }, [token, dispatch, user, router]);

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

    if (loading || redirecting) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loading size="md" />
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 pb-8">
            <PageHeader
                title="Organization Settings"
                description={<>Identity, contact, appearance, and account security. <DocsLink href="/docs/settings#organization-settings">Read settings docs</DocsLink></>}
                icon={Settings}
                actions={(
                    <div className="flex flex-wrap items-center gap-2">
                        {orgData?.status && (
                            <Badge
                                variant={orgData.status === 'APPROVED' ? 'success' : orgData.status === 'REJECTED' ? 'error' : 'warning'}
                                size="md"
                                dot
                            >
                                {orgData.status.replace('_', ' ')}
                            </Badge>
                        )}
                        {orgData?.contactEmailVerifiedAt ? (
                            <Badge variant="success" size="md" icon={ShieldCheck}>Contact verified</Badge>
                        ) : (
                            <Badge variant="warning" size="md" icon={TriangleAlert}>Contact unverified</Badge>
                        )}
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

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-6">
                        <SettingsSection
                            icon={Building2}
                            title="Organization Profile"
                            description={<>These details identify the organization across dashboards and records. <DocsLink href="/docs/settings#organization-profile">Profile details</DocsLink></>}
                        >
                            <div className="grid gap-5 md:grid-cols-2">
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
                                        className="h-12 border-border/60 bg-background/70 font-medium"
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
                                        className="h-12 border-border/60 bg-background/70 font-medium"
                                    />
                                    <FieldError>{formErrors.location}</FieldError>
                                </div>

                                <div id="contact-email" className="space-y-2 scroll-mt-24">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Label htmlFor="settings-contact-email" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Contact Email</Label>
                                    </div>
                                    <Input
                                        id="settings-contact-email"
                                        type="email"
                                        name="contactEmail"
                                        value={formData.contactEmail}
                                        onChange={handleChange}
                                        icon={Mail}
                                        placeholder="contact@example.com"
                                        error={!!formErrors.contactEmail}
                                        className="h-12 border-border/60 bg-background/70 font-medium"
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
                                        className="h-12 border-border/60 bg-background/70 font-medium"
                                    />
                                    <FieldError>{formErrors.phone}</FieldError>
                                </div>
                            </div>
                        </SettingsSection>

                        <SettingsSection
                            icon={Palette}
                            title="Appearance"
                            description={<>Choose the primary accent and preferred theme for this workspace. <DocsLink href="/docs/settings#appearance-theme">Appearance details</DocsLink></>}
                        >
                            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)]">
                                <div className="space-y-3">
                                    <Label htmlFor="settings-primary-color" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Primary Accent Color</Label>
                                    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/70 p-3">
                                        <ColorSelector
                                            value={formData.accentColor.primary}
                                            onChange={handlePrimaryColorChange}
                                            ariaLabelPrefix="accent color"
                                        />
                                        <div className="min-w-0 flex-1 border-t border-border/50 pt-2 flex items-center justify-between">
                                            <p className="font-mono text-sm font-black uppercase text-foreground">{formData.accentColor.primary}</p>
                                            <p className="text-xs font-semibold leading-relaxed text-muted-foreground">
                                                Predefined brand palette.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Theme Mode</Label>
                                    <ThemeDropdown
                                        currentMode={themeMode}
                                        onModeChange={(mode) => {
                                            setFormData((current) => ({ ...current, accentColor: { ...current.accentColor, mode } }));
                                            setThemeMode(mode);
                                        }}
                                    />
                                    <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Preview</p>
                                        <div className="mt-3 flex items-center gap-2">
                                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: formData.accentColor.primary }} />
                                            <span className="h-3 w-12 rounded-full bg-muted" />
                                            <span className="h-3 w-8 rounded-full bg-foreground/20" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </SettingsSection>
                    </div>

                    <aside className="space-y-6 xl:sticky xl:top-4">
                        <SettingsSection
                            icon={School}
                            title="Logo"
                            description={<>Upload a square organization mark. <DocsLink href="/docs/settings#branding-logo">Logo details</DocsLink></>}
                        >
                            <div className="flex flex-col items-center gap-3">
                                <PhotoUploadPicker
                                    currentImageUrl={orgData?.logoUrl}
                                    updatedAt={orgData?.avatarUpdatedAt}
                                    onFileReady={handleLogoReady}
                                    type="org"
                                    sizeClassName="h-32 w-32"
                                    hint="Saved when you click Save Settings"
                                />
                                {pendingLogoFile && (
                                    <p className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-black text-primary">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        New logo ready
                                    </p>
                                )}
                            </div>
                        </SettingsSection>

                        <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm sm:p-5">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-primary">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-foreground">Contact Verification</h2>
                                    <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">
                                        Password recovery uses the verified contact email.
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 rounded-xl border border-border/70 bg-background/70 p-3">
                                {orgData?.contactEmailVerifiedAt ? (
                                    <div className="flex items-center justify-center gap-2 text-success">
                                        <CheckCircle className="h-4 w-4" />
                                        <span className="text-sm font-black">Verified</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2 text-warning">
                                        <TriangleAlert className="h-4 w-4" />
                                        <span className="text-sm font-black">Verification pending</span>
                                    </div>
                                )}
                            </div>
                            <Link href="/change-password" >
                                <div className="flex items-center justify-center mt-4 rounded-lg border border-border/70 bg-background/70 hover:bg-background p-3 text-sm font-medium cursor-pointer">
                                    <span className="flex items-center gap-2">
                                        Change Password
                                        <ExternalLink className="h-4 w-4" />
                                    </span>
                                </div>
                            </Link>

                        </section>
                    </aside>
                </div>

                {formErrors.general && (
                    <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm font-semibold text-danger">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>{formErrors.general}</span>
                    </div>
                )}

                <div className="sticky bottom-3 z-20 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 px-3">
                            <p className="text-sm font-black text-foreground">Save organization settings</p>
                            <p className="text-xs font-semibold text-muted-foreground">Logo, profile, and appearance changes are applied together.</p>
                        </div>
                        <Button
                            type="submit"
                            loadingId="settings-submit"
                            className="h-12 w-full px-6 text-sm sm:w-auto"
                            icon={Save}
                        >
                            Save Settings
                        </Button>
                    </div>
                </div>
            </form>

            <div id="sessions" className="scroll-mt-24">
                <SessionManagement userId={user?.id} />
            </div>
        </div>
    );
}
