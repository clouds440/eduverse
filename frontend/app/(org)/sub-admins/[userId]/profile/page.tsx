'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Building2, CalendarClock, Lock, Mail, Phone, ShieldCheck, User as UserIcon, UserX } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { DepartmentScopeType, Role, User, UserStatus } from '@/types';
import SessionManagement from '@/components/SessionManagement';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormActions, FormField, FormGrid, FormPageHeader, FormPageShell, FormSection, FORM_INPUT_CLASS, FORM_READONLY_INPUT_CLASS } from '@/components/ui/FormLayout';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { formatDepartmentLabel } from '@/lib/utils';

const STATUS_VARIANT: Record<UserStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
    [UserStatus.ACTIVE]: 'success',
    [UserStatus.SUSPENDED]: 'error',
    [UserStatus.ON_LEAVE]: 'warning',
    [UserStatus.ALUMNI]: 'neutral',
    [UserStatus.EMERITUS]: 'neutral',
    [UserStatus.DELETED]: 'error',
};

function statusIcon(status?: UserStatus) {
    if (status === UserStatus.SUSPENDED || status === UserStatus.DELETED) return UserX;
    if (status === UserStatus.ON_LEAVE) return CalendarClock;
    return ShieldCheck;
}

export default function SubAdminProfilePage() {
    const { user, token, loading: authLoading, updateUser } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const params = useParams();
    const userId = params.userId as string;
    const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
    const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
    const [formErrors, setFormErrors] = useState<{ name?: string; password?: string; general?: string }>({});

    const canLoadProfile = Boolean(token && user?.role === Role.SUB_ADMIN && userId === user.id);
    const { data: profile, isLoading: profileLoading, error, mutate } = useSWR<User>(
        canLoadProfile ? ['sub-admin-profile', userId] as const : null,
        () => api.org.getProfile<User>(token!)
    );

    useEffect(() => {
        if (authLoading || !user) return;
        if (user.role !== Role.SUB_ADMIN) {
            router.replace('/overview');
            return;
        }
        if (userId !== user.id) {
            router.replace(`/sub-admins/${user.id}/profile`);
        }
    }, [authLoading, router, user, userId]);

    useEffect(() => {
        if (!profile) return;
        setFormData({
            name: profile.name || '',
            phone: profile.phone || '',
            password: '',
        });
    }, [profile]);

    useEffect(() => {
        const hash = window.location.hash;
        if (!profileLoading && hash) {
            document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [profileLoading]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData((current) => ({ ...current, [name]: value }));
        setFormErrors((current) => ({ ...current, [name]: undefined, general: undefined }));
    };

    const handlePhotoReady = useCallback((file: File) => {
        setPendingPhoto(file);
    }, []);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token || !profile) return;

        const nextErrors: typeof formErrors = {};
        if (!formData.name.trim()) nextErrors.name = 'Full name is required';
        if (formData.password && formData.password.length < 8) nextErrors.password = 'Password must be at least 8 characters';
        if (Object.keys(nextErrors).length) {
            setFormErrors(nextErrors);
            return;
        }

        dispatch({ type: 'UI_START_PROCESSING', payload: 'sub-admin-profile-submit' });
        try {
            let savedProfile = await api.org.updateProfile<User>({
                name: formData.name.trim(),
                phone: formData.phone.trim() || undefined,
                ...(formData.password ? { password: formData.password } : {}),
            }, token);

            if (pendingPhoto) {
                const avatar = await api.org.uploadAvatar(savedProfile.id, pendingPhoto, token);
                savedProfile = { ...savedProfile, ...avatar };
                setPendingPhoto(null);
            }

            updateUser({
                name: savedProfile.name,
                avatarUrl: savedProfile.avatarUrl,
                avatarUpdatedAt: savedProfile.avatarUpdatedAt,
            });
            setFormData((current) => ({ ...current, password: '' }));
            await mutate(savedProfile, false);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Profile updated successfully', type: 'success' } });
        } catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : 'Failed to update profile';
            setFormErrors({ general: message });
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'sub-admin-profile-submit' });
        }
    };

    const departments = (profile?.subAdminDepartments || []).flatMap((entry) => entry.department ? [entry.department] : []);
    const scopeLabel = profile?.departmentScopeType === DepartmentScopeType.SELECTED ? 'Selected Departments' : 'All Departments';
    const StatusIcon = statusIcon(profile?.status);

    if (authLoading || profileLoading || (canLoadProfile && !profile && !error)) {
        return (
            <FormPageShell>
                <FormPageHeader
                    title="Account Settings"
                    description="Update your personal information and security preferences."
                    icon={ShieldCheck}
                />
                <div className="flex justify-center rounded-lg border border-border/70 bg-card/90 py-20 shadow-sm">
                    <Loading size="lg" />
                </div>
            </FormPageShell>
        );
    }

    if (error) {
        return (
            <FormPageShell>
                <FormPageHeader
                    title="Account Settings"
                    description="Update your personal information and security preferences."
                    icon={ShieldCheck}
                />
                <div className="rounded-lg border border-border/70 bg-card/90 p-6 shadow-sm">
                    <ErrorState error={error} onRetry={() => mutate()} />
                </div>
            </FormPageShell>
        );
    }

    if (!profile || user?.role !== Role.SUB_ADMIN || userId !== user.id) return null;

    return (
        <FormPageShell>
            <FormPageHeader
                title="Account Settings"
                description="Update your personal information and security preferences."
                icon={ShieldCheck}
            />

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <FormSection
                    title="Account & Credentials"
                    description="Keep your contact details current and refresh your password when needed."
                    icon={ShieldCheck}
                    bodyClassName="p-0"
                >
                    <div className="grid min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
                        <aside className="border-b border-border/60 bg-background/35 p-5 lg:border-b-0 lg:border-r">
                            <div className="flex flex-col items-center gap-4 rounded-lg border border-border/70 bg-card/80 p-4 text-center">
                                <PhotoUploadPicker
                                    currentImageUrl={profile.avatarUrl}
                                    updatedAt={profile.avatarUpdatedAt}
                                    onFileReady={handlePhotoReady}
                                    hint="Saved when you click Save Profile"
                                    type="user"
                                />
                                <div>
                                    <p className="text-sm font-black text-foreground">{profile.name}</p>
                                    <p className="mt-1 text-xs font-semibold text-muted-foreground">Sub Admin</p>
                                </div>
                                {profile.status && (
                                    <Badge variant={STATUS_VARIANT[profile.status]} size="md" icon={StatusIcon} dot>
                                        {profile.status.replace('_', ' ')}
                                    </Badge>
                                )}
                            </div>
                        </aside>

                        <div className="p-4 sm:p-5">
                            <FormGrid>
                                <FormField label="Full Name" required error={formErrors.name}>
                                    <Input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        error={!!formErrors.name}
                                        icon={UserIcon}
                                        placeholder="Ayesha Malik"
                                        className={FORM_INPUT_CLASS}
                                    />
                                </FormField>

                                <FormField label="Email Address">
                                    <Input
                                        type="email"
                                        value={profile.email || ''}
                                        readOnly
                                        disabled
                                        icon={Mail}
                                        className={FORM_READONLY_INPUT_CLASS}
                                    />
                                </FormField>

                                <FormField label="Contact Phone">
                                    <Input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        icon={Phone}
                                        placeholder="+1 555-0123"
                                        className={FORM_INPUT_CLASS}
                                    />
                                </FormField>

                                <FormField label="Account Password" error={formErrors.password} helper="Leave blank to keep your current password.">
                                    <Input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        error={!!formErrors.password}
                                        icon={Lock}
                                        placeholder="New password"
                                        className={FORM_INPUT_CLASS}
                                    />
                                </FormField>
                            </FormGrid>
                        </div>
                    </div>
                </FormSection>

                <FormSection
                    title="Department Scope"
                    description="Your organization admin controls which departments this account can manage."
                    icon={Building2}
                >
                    <FormGrid>
                        <FormField label="Access Scope">
                            <Input
                                type="text"
                                value={scopeLabel}
                                readOnly
                                disabled
                                icon={Building2}
                                className={FORM_READONLY_INPUT_CLASS}
                            />
                        </FormField>

                        <FormField label="Departments">
                            <div className="min-h-12 rounded-md border border-border/60 bg-muted/40 px-3.5 py-3">
                                {profile.departmentScopeType !== DepartmentScopeType.SELECTED ? (
                                    <Badge variant="primary" size="md">All Departments</Badge>
                                ) : departments.length ? (
                                    <div className="flex flex-wrap gap-2">
                                        {departments.map((department) => (
                                            <Badge key={department.id} variant="secondary" size="md">
                                                {formatDepartmentLabel(department)}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-sm font-semibold text-muted-foreground">No departments assigned</span>
                                )}
                            </div>
                        </FormField>
                    </FormGrid>
                </FormSection>

                {formErrors.general && (
                    <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm font-semibold text-danger">
                        {formErrors.general}
                    </div>
                )}

                <FormActions
                    onCancel={() => router.back()}
                    cancelText="Back"
                    submitText="Save Profile"
                    loadingId="sub-admin-profile-submit"
                    loadingText="Saving..."
                    title="Save profile settings"
                    description="Your profile picture and account details are applied together."
                />
            </form>

            <div id="sessions" className="scroll-mt-24">
                <SessionManagement userId={profile.id} />
            </div>
        </FormPageShell>
    );
}
