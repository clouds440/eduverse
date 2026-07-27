'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import useSWR from 'swr';
import {
    CalendarClock,
    Lock,
    Mail,
    Phone,
    Save,
    ShieldCheck,
    User as UserIcon,
    UserCircle,
    UserX,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import {
    Role,
    UserStatus,
    type GuardianProfile,
    type Student,
    type Teacher,
    type User,
} from '@/types';
import TeacherForm from '@/components/forms/TeacherForm';
import StudentForm from '@/components/forms/StudentForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import {
    FormField,
    FormGrid,
    FORM_INPUT_CLASS,
    FORM_READONLY_INPUT_CLASS,
} from '@/components/ui/FormLayout';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { SettingsSection } from '../SettingsSection';

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

function roleLabel(role?: Role | null) {
    if (role === Role.FINANCE_MANAGER) return 'Finance Manager';
    if (role === Role.SUB_ADMIN) return 'Sub Admin';
    if (role === Role.ORG_MANAGER) return 'Manager';
    if (role === Role.TEACHER) return 'Teacher';
    if (role === Role.STUDENT) return 'Student';
    if (role === Role.GUARDIAN) return 'Guardian';
    return 'Account';
}

function TeacherProfileTab() {
    const { token, user } = useAuth();
    const canLoadProfile = Boolean(
        token &&
        user &&
        (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER),
    );
    const { data, isLoading, error, mutate } = useSWR<Teacher>(
        canLoadProfile ? ['account-settings-teacher-profile', user?.id] as const : null,
        () => api.org.getProfile<Teacher>(token!),
    );

    if (isLoading || (canLoadProfile && !data && !error)) {
        return <LoadingPanel />;
    }
    if (error) return <ErrorPanel error={error} onRetry={() => mutate()} />;
    if (!data || !user) return null;

    const profile = {
        ...data,
        user: data.user ?? {
            id: user.id,
            name: user.name || '',
            email: user.email || '',
            userName: user.userName || '',
            role: user.role,
            phone: undefined,
            avatarUrl: user.avatarUrl,
            avatarUpdatedAt: user.avatarUpdatedAt,
            organizationId: user.organizationId ?? user.orgId ?? null,
        },
    };

    return <TeacherForm initialData={profile} isProfile stayOnProfileSave />;
}

function StudentProfileTab() {
    const { token, user } = useAuth();
    const canLoadProfile = Boolean(token && user?.role === Role.STUDENT);
    const { data, isLoading, error, mutate } = useSWR<Student>(
        canLoadProfile ? ['account-settings-student-profile', user?.id] as const : null,
        () => api.org.getProfile<Student>(token!),
    );

    if (isLoading || (canLoadProfile && !data && !error)) {
        return <LoadingPanel />;
    }
    if (error) return <ErrorPanel error={error} onRetry={() => mutate()} />;
    if (!data) return null;

    return <StudentForm initialData={data} isProfile />;
}

function EditableUserProfileTab({
    cacheKey,
    loadingId,
    loadProfile,
    updateProfile,
}: {
    cacheKey: string;
    loadingId: string;
    loadProfile: () => Promise<User>;
    updateProfile: (data: Partial<Pick<User, 'name' | 'phone'>> & { password?: string }) => Promise<User>;
}) {
    const { token, user, updateUser } = useAuth();
    const { dispatch } = useGlobal();
    const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
    const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
    const [formErrors, setFormErrors] = useState<{ name?: string; password?: string; general?: string }>({});
    const { data: profile, isLoading, error, mutate } = useSWR<User>(
        token && user ? [cacheKey, user.id] as const : null,
        loadProfile,
    );

    useEffect(() => {
        if (!profile) return;
        setFormData({
            name: profile.name || '',
            phone: profile.phone || '',
            password: '',
        });
    }, [profile]);

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
        if (formData.password && formData.password.length < 8) {
            nextErrors.password = 'Password must be at least 8 characters';
        }
        if (Object.keys(nextErrors).length) {
            setFormErrors(nextErrors);
            return;
        }

        dispatch({ type: 'UI_START_PROCESSING', payload: loadingId });
        try {
            let savedProfile = await updateProfile({
                name: formData.name.trim(),
                phone: formData.phone.trim() || undefined,
                ...(formData.password ? { password: formData.password } : {}),
            });

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
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: 'Profile updated successfully', type: 'success' },
            });
        } catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : 'Failed to update profile';
            setFormErrors({ general: message });
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: loadingId });
        }
    };

    if (isLoading || (token && !profile && !error)) return <LoadingPanel />;
    if (error) return <ErrorPanel error={error} onRetry={() => mutate()} />;
    if (!profile || !user) return null;

    const StatusIcon = statusIcon(profile.status);

    return (
        <form onSubmit={handleSubmit} noValidate>
            <SettingsSection
                title="Profile"
                description="Basic identity and account contact details."
                icon={UserCircle}
                action={
                    <Button
                        type="submit"
                        icon={Save}
                        loadingId={loadingId}
                        className="h-10 px-4 text-xs"
                    >
                        Save Profile
                    </Button>
                }
            >
                <div className="grid min-h-0 lg:grid-cols-[260px_minmax(0,1fr)]">
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
                                <p className="mt-1 text-xs font-semibold text-muted-foreground">{roleLabel(user.role)}</p>
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
                                    placeholder="Full name"
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

                        {formErrors.general && (
                            <div className="mt-5 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm font-semibold text-danger">
                                {formErrors.general}
                            </div>
                        )}
                    </div>
                </div>
            </SettingsSection>
        </form>
    );
}

function GuardianProfileTab() {
    const { token, user } = useAuth();
    const { data: profile, isLoading, error, mutate } = useSWR<GuardianProfile>(
        token && user?.role === Role.GUARDIAN ? ['account-settings-guardian-profile', user.id] as const : null,
        () => api.org.getMyGuardianProfile(token!),
    );

    if (isLoading || (token && !profile && !error)) return <LoadingPanel />;
    if (error) return <ErrorPanel error={error} onRetry={() => mutate()} />;
    if (!profile) return null;

    return (
        <SettingsSection
            icon={UserCircle}
            title="Profile"
            description="Basic guardian account details. Contact the school office if these need to change."
        >
            <FormGrid>
                <FormField label="Full Name">
                    <Input value={profile.user?.name || 'Guardian'} readOnly disabled icon={UserIcon} className={FORM_READONLY_INPUT_CLASS} />
                </FormField>
                <FormField label="Email Address">
                    <Input value={profile.user?.email || ''} readOnly disabled icon={Mail} className={FORM_READONLY_INPUT_CLASS} />
                </FormField>
                <FormField label="Contact Phone">
                    <Input value={profile.phone || profile.user?.phone || ''} readOnly disabled icon={Phone} className={FORM_READONLY_INPUT_CLASS} />
                </FormField>
                <FormField label="Account Status">
                    <Input value={profile.user?.status || 'ACTIVE'} readOnly disabled icon={ShieldCheck} className={FORM_READONLY_INPUT_CLASS} />
                </FormField>
            </FormGrid>
        </SettingsSection>
    );
}

function LoadingPanel() {
    return (
        <div className="flex justify-center rounded-lg border border-border/70 bg-card/90 py-20 shadow-sm">
            <Loading size="lg" />
        </div>
    );
}

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
    const displayError = error instanceof Error || typeof error === 'string'
        ? error
        : 'Unable to load profile.';

    return (
        <div className="rounded-lg border border-border/70 bg-card/90 p-6 shadow-sm">
            <ErrorState error={displayError} onRetry={onRetry} />
        </div>
    );
}

export function UserAccountProfileSettingsTab() {
    const { token, user } = useAuth();

    if (!token || !user) return null;

    if (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) {
        return <TeacherProfileTab />;
    }

    if (user.role === Role.STUDENT) {
        return <StudentProfileTab />;
    }

    if (user.role === Role.SUB_ADMIN) {
        return (
            <EditableUserProfileTab
                cacheKey="account-settings-sub-admin-profile"
                loadingId="sub-admin-profile-submit"
                loadProfile={() => api.org.getProfile<User>(token)}
                updateProfile={(data) => api.org.updateProfile<User>(data, token)}
            />
        );
    }

    if (user.role === Role.FINANCE_MANAGER) {
        return (
            <EditableUserProfileTab
                cacheKey="account-settings-finance-manager-profile"
                loadingId="finance-manager-profile-submit"
                loadProfile={() => api.org.getFinanceManagerProfile(token)}
                updateProfile={(data) => api.org.updateFinanceManagerProfile(data, token)}
            />
        );
    }

    if (user.role === Role.GUARDIAN) {
        return <GuardianProfileTab />;
    }

    return null;
}
