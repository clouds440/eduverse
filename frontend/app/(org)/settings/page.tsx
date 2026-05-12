'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Settings, Save, CheckCircle, Mail, MapPin, Phone, School, RefreshCw, AlertCircle, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { Organization, Role } from '@/types';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { useGlobal } from '@/context/GlobalContext';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/context/ThemeContext';
import { ThemeMode } from '@/types';
import SessionManagement from '@/components/SessionManagement';
import { Loading } from '@/components/ui/Loading';
import { ThemeDropdown } from '@/components/ui/ThemeDropdown';

export default function SettingsPage() {
    const { token, user } = useAuth();
    const router = useRouter();
    const { dispatch } = useGlobal();
    const [loading, setLoading] = useState(false);
    const [reapplying, setReapplying] = useState(false);
    const [orgData, setOrgData] = useState<Organization | null>(null);
    const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
    const [redirecting, setRedirecting] = useState(user?.role === Role.ORG_ADMIN ? false : true);

    // Scroll to section if hash is present
    useEffect(() => {
        const hash = window.location.hash;
        if (hash === '#sessions' && !redirecting && !loading) {
            const element = document.getElementById('sessions');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [redirecting, loading]);

    const [formData, setFormData] = useState({
        name: '',
        location: '',
        contactEmail: '',
        phone: '',
        accentColor: {
            primary: '#4f46e5',
            mode: ThemeMode.SYSTEM
        }
    });

    useEffect(() => {
        if (!token || !user) return;

        // Preserve hash from URL for scrolling
        const hash = typeof window !== 'undefined' ? window.location.hash : '';

        // Redirect based on role
        if (user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN) {
            router.push(`/admin/settings${hash}`);
            return;
        } else if (user.role === Role.ORG_MANAGER || user.role === Role.TEACHER) {
            router.push(`/teachers/${user.id}/profile${hash}`);
            return;
        } else if (user.role === Role.STUDENT) {
            router.push(`/students/${user.id}?tab=profile${hash}`);
            return;
        }

        // Only ORG_ADMIN continues to org settings
        if (user.role !== Role.ORG_ADMIN) {
            return;
        }
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
                        primary: data.accentColor?.primary || '#4f46e5',
                        mode: (data.accentColor?.mode as ThemeMode) || ThemeMode.SYSTEM
                    }
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Live preview helpers
    // We'll use ThemeContext to preview primary and mode
    const { setPrimaryColor, setThemeMode, themeMode } = useTheme();

    // Update theme immediately when color changes (real-time preview)
    useEffect(() => {
        setPrimaryColor(formData.accentColor.primary);
    }, [formData.accentColor.primary, setPrimaryColor]);

    const handleLogoReady = useCallback((file: File) => {
        setPendingLogoFile(file);
    }, []);

    const [formErrors, setFormErrors] = useState<{ name?: string; location?: string; contactEmail?: string; phone?: string; general?: string }>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;
        setFormErrors({});

        // validation
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
            // 1. Save text settings — send only primary for accentColor (no secondary)
            const payload = {
                ...formData,
                accentColor: {
                    primary: formData.accentColor.primary
                }
            };

            await api.org.updateSettings(payload, token);

            // 1b. Save per-user themeMode to user profile
            try {
                await api.auth.updateProfile({ themeMode: formData.accentColor.mode }, token);
            } catch (e) {
                // non-blocking — inform user but continue
                console.warn('Failed to save user themeMode', e);
            }

            // 2. Upload logo if one was selected
            if (pendingLogoFile) {
                const logoRes = await api.org.uploadLogo(pendingLogoFile, token);
                // Update local org data so the avatar reflects the new URL
                setOrgData((prev: Organization | null) => prev ? { ...prev, logoUrl: logoRes.logoUrl, avatarUpdatedAt: logoRes.avatarUpdatedAt } : prev);
                setPendingLogoFile(null);
            }

            dispatch({ type: 'TOAST_ADD', payload: { message: 'Settings updated successfully!', type: 'success' } });
        } catch (error: any) {
            const message = error?.response?.data?.message || error?.message || 'Failed to update settings. Please try again.';
            const newErrors: typeof formErrors = {};

            if (Array.isArray(message)) {
                message.forEach((m: string) => {
                    const msg = m.toLowerCase();
                    if (msg.includes('name')) newErrors.name = m;
                    else if (msg.includes('location')) newErrors.location = m;
                    else if (msg.includes('email')) newErrors.contactEmail = m;
                    else if (msg.includes('phone')) newErrors.phone = m;
                    else newErrors.general = m;
                });
            } else {
                const msgStr = message;
                if (msgStr.toLowerCase().includes('name')) newErrors.name = msgStr;
                else if (msgStr.toLowerCase().includes('location')) newErrors.location = msgStr;
                else if (msgStr.toLowerCase().includes('email')) newErrors.contactEmail = msgStr;
                else if (msgStr.toLowerCase().includes('phone')) newErrors.phone = msgStr;
                else newErrors.general = msgStr;
            }
            setFormErrors(newErrors);
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
            <div className="flex justify-center items-center h-64">
                <Loading size="md" />
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col max-w-7xl mx-auto w-full">
            <div className="mb-6 md:mb-8">
                <div className="mt-2 flex items-center gap-4 md:gap-6">
                    <div className="relative p-3 md:p-4 bg-linear-to-br from-primary/10 to-primary/5 backdrop-blur-xl rounded-2xl border border-primary/20 shadow-xl">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                        <Settings className="w-8 h-8 md:w-10 md:h-10 text-primary relative z-10" />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Settings</h1>
                        <p className="text-muted-foreground font-semibold opacity-70 mt-1 tracking-wider text-xs md:text-sm">Organization Profile & Configuration</p>
                    </div>
                </div>
            </div>

            <div className="bg-linear-to-br from-card/80 via-card/60 to-card/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 p-6 md:p-10 mb-10 text-card-foreground">
                {orgData?.status === 'REJECTED' && (
                    <div className="mb-6 md:mb-8 p-4 md:p-6 bg-destructive/10 border border-destructive/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="p-3 bg-destructive/20 rounded-xl text-destructive">
                                <TriangleAlert className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div>
                                <h4 className="text-base md:text-lg font-black text-destructive leading-tight">Your application was rejected</h4>
                                <div className="mt-2">
                                    <MarkdownRenderer
                                        content={orgData?.statusHistory && orgData.statusHistory.length > 0
                                            ? orgData.statusHistory[orgData.statusHistory.length - 1].message
                                            : 'Please correct the details below and re-submit for review.'}
                                        className="text-xs md:text-sm text-muted-foreground! font-medium prose prose-red dark:prose-invert prose-sm max-w-none opacity-80"
                                    />
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={handleReapply}
                            disabled={reapplying}
                            icon={RefreshCw}
                            variant="primary"
                        >
                            Re-submit for Review
                        </Button>
                    </div>
                )}


                <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8" noValidate>
                    {/* Logo section */}
                    <div className="flex flex-col items-center gap-2 pb-6 border-b border-border/50">
                        <Label className="text-xs font-semibold tracking-wider text-muted-foreground opacity-70">Organization Logo</Label>
                        <PhotoUploadPicker
                            currentImageUrl={orgData?.logoUrl}
                            onFileReady={handleLogoReady}
                            type="org"
                            hint="Click to change logo — saved when you click Save Settings"
                        />
                        {pendingLogoFile && (
                            <p className="text-xs text-primary font-semibold flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" />
                                New logo ready — will upload on save
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 pt-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold tracking-wider text-muted-foreground opacity-70">Organization Name</Label>
                            <Input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                icon={School}
                                placeholder="School Name"
                                error={!!formErrors.name}
                                className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                            />
                            {formErrors.name && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.name}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold tracking-wider text-muted-foreground opacity-70">Primary Accent Color</Label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <input
                                        type="color"
                                        value={formData.accentColor.primary}
                                        onChange={(e) => {
                                            const newPrimary = e.target.value;
                                            setFormData({ ...formData, accentColor: { ...formData.accentColor, primary: newPrimary } });
                                        }}
                                        className="w-full h-12 rounded-xl border border-border/50 cursor-pointer"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1 font-semibold tracking-wider leading-none">HEX: {formData.accentColor.primary}</p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed font-medium">
                                Pick accent color.
                            </p>

                            <div className="mt-4 space-y-2">
                                <Label className="text-xs font-semibold tracking-wider text-muted-foreground opacity-70">Theme Mode</Label>
                                <ThemeDropdown
                                    currentMode={themeMode}
                                    onModeChange={(mode) => {
                                        setFormData({ ...formData, accentColor: { ...formData.accentColor, mode } });
                                        setThemeMode(mode);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold tracking-wider text-muted-foreground opacity-70">Location</Label>
                            <Input
                                type="text"
                                name="location"
                                value={formData.location}
                                onChange={handleChange}
                                required
                                icon={MapPin}
                                placeholder="City, State"
                                error={!!formErrors.location}
                                className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                            />
                            {formErrors.location && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.location}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold tracking-wider text-muted-foreground opacity-70">Contact Email</Label>
                            <Input
                                type="email"
                                name="contactEmail"
                                value={formData.contactEmail}
                                onChange={handleChange}
                                icon={Mail}
                                placeholder="contact@example.com"
                                error={!!formErrors.contactEmail}
                                className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                            />
                            {formErrors.contactEmail && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.contactEmail}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold tracking-wider text-muted-foreground opacity-70">Phone Number</Label>
                            <Input
                                type="text"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                icon={Phone}
                                placeholder="+1 (555) 000-0000"
                                error={!!formErrors.phone}
                                className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                            />
                            {formErrors.phone && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.phone}</p>}
                        </div>
                    </div>

                    {formErrors.general && (
                        <div className="p-4 bg-danger/10 border border-danger/30 text-danger rounded-xl flex items-center text-sm font-medium animate-shake">
                            <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                            {formErrors.general}
                        </div>
                    )}

                    <div className="pt-4 border-t border-border/50 flex justify-end">
                        <Button
                            type="submit"
                            loadingId="settings-submit"
                            className="h-12 md:h-14 px-8 md:px-10 font-semibold shadow-lg hover:shadow-xl transition-shadow"
                            icon={Save}
                        >
                            SAVE SETTINGS
                        </Button>
                    </div>
                </form>
            </div>

            <div id="sessions">
                <SessionManagement userId={user?.id} />
            </div>
        </div>
    );
}
