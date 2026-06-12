'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler, useWatch, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, Lock, Mail, Phone, ShieldCheck, User, UserX } from 'lucide-react';
import { mutate } from 'swr';
import { ZodType } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { matchesCacheKeyPrefix, CacheKeyPrefix } from '@/lib/swr';
import { CreateRoleAccountRequest, UpdateRoleAccountRequest, User as AppUser, UserStatus } from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { FormActions, FormField, FormGrid, FormSection, FORM_INPUT_CLASS, FORM_READONLY_INPUT_CLASS } from '@/components/ui/FormLayout';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { api } from '@/lib/api';

export type RoleAccountFormData = {
    name: string;
    email: string;
    phone?: string;
    password?: string;
    status: UserStatus;
};

interface RoleAccountFormProps {
    accountId?: string;
    initialData?: AppUser;
    label: string;
    description: string;
    cacheKeyPrefix: CacheKeyPrefix;
    createSchema: ZodType<RoleAccountFormData>;
    updateSchema: ZodType<RoleAccountFormData>;
    createAccount: (data: CreateRoleAccountRequest, token: string) => Promise<AppUser>;
    updateAccount: (id: string, data: UpdateRoleAccountRequest, token: string) => Promise<AppUser>;
    listHref: string;
}

const USER_STATUS_OPTIONS = [
    { value: UserStatus.ACTIVE, label: 'Active', icon: ShieldCheck },
    { value: UserStatus.SUSPENDED, label: 'Suspended', icon: UserX },
    { value: UserStatus.ON_LEAVE, label: 'On Leave', icon: CalendarClock },
];

function getAccountDefaults(initialData?: AppUser): RoleAccountFormData {
    return initialData ? {
        name: initialData.name || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        password: '',
        status: initialData.status || UserStatus.ACTIVE,
    } : {
        name: '',
        email: '',
        phone: '',
        password: '',
        status: UserStatus.ACTIVE,
    };
}

function userStatusIcon(status?: UserStatus) {
    if (status === UserStatus.SUSPENDED) return UserX;
    if (status === UserStatus.ON_LEAVE) return CalendarClock;
    return ShieldCheck;
}

export default function RoleAccountForm({
    accountId,
    initialData,
    label,
    description,
    cacheKeyPrefix,
    createSchema,
    updateSchema,
    createAccount,
    updateAccount,
    listHref,
}: RoleAccountFormProps) {
    const { token } = useAuth();
    const router = useRouter();
    const { dispatch } = useGlobal();
    const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);

    const resolver = useMemo(
        () => zodResolver((accountId ? updateSchema : createSchema) as any) as unknown as Resolver<RoleAccountFormData>,
        [accountId, createSchema, updateSchema]
    );

    const {
        control,
        register,
        handleSubmit,
        setValue,
        trigger,
        formState: { errors },
    } = useForm<RoleAccountFormData>({
        resolver,
        defaultValues: getAccountDefaults(initialData),
    });

    const watchedStatus = useWatch({ control, name: 'status' }) as UserStatus | undefined;

    const handleStatusChange = useCallback((value: string) => {
        setValue('status', value as UserStatus);
        trigger('status');
    }, [setValue, trigger]);

    const handleCancel = useCallback(() => {
        router.back();
    }, [router]);

    const handlePhotoReady = useCallback((file: File) => {
        setPendingPhoto(file);
    }, []);

    const onSubmit: SubmitHandler<RoleAccountFormData> = async (data) => {
        if (!token) return;

        dispatch({ type: 'UI_START_PROCESSING', payload: `${cacheKeyPrefix}-submit` });
        try {
            const { password, ...rest } = data;
            const payload: CreateRoleAccountRequest | UpdateRoleAccountRequest = {
                ...rest,
                ...(accountId ? (password ? { password } : {}) : { password }),
            };

            const savedAccount = accountId
                ? await updateAccount(accountId, payload as UpdateRoleAccountRequest, token)
                : await createAccount(payload as CreateRoleAccountRequest, token);

            if (pendingPhoto) {
                await api.org.uploadAvatar(savedAccount.id, pendingPhoto, token);
                setPendingPhoto(null);
            }

            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: `${label} ${accountId ? 'updated' : 'created'} successfully`,
                    type: 'success',
                },
            });
            mutate(matchesCacheKeyPrefix(cacheKeyPrefix));
            router.push(listHref);
        } catch (error: unknown) {
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: error instanceof Error ? error.message : `Failed to save ${label.toLowerCase()}`,
                    type: 'error',
                },
            });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `${cacheKeyPrefix}-submit` });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <FormSection
                title="Account & Credentials"
                description={description}
                icon={ShieldCheck}
                bodyClassName="p-0"
            >
                <div className="grid min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="border-b border-border/60 bg-background/35 p-5 lg:border-b-0 lg:border-r">
                        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/70 bg-card/80 p-4 text-center">
                        <PhotoUploadPicker
                            currentImageUrl={initialData?.avatarUrl}
                            updatedAt={initialData?.avatarUpdatedAt}
                            onFileReady={handlePhotoReady}
                            hint="Upload a square profile picture for this account."
                            type="user"
                        />
                            <div>
                                <p className="text-sm font-black text-foreground">{initialData?.name || label}</p>
                                <p className="mt-1 text-xs font-semibold text-muted-foreground">{watchedStatus || UserStatus.ACTIVE}</p>
                            </div>
                        </div>
                    </aside>

                    <div className="p-4 sm:p-5">
                        <FormGrid>
                    <FormField label="Full Name" required error={errors.name?.message}>
                        <Input
                            type="text"
                            {...register('name')}
                            error={!!errors.name}
                            icon={User}
                            placeholder="Ayesha Malik"
                            className={FORM_INPUT_CLASS}
                        />
                    </FormField>

                    <FormField label="Status" error={errors.status?.message}>
                        <CustomSelect
                            options={USER_STATUS_OPTIONS}
                            value={watchedStatus || UserStatus.ACTIVE}
                            onChange={handleStatusChange}
                            error={!!errors.status}
                            icon={userStatusIcon(watchedStatus)}
                        />
                    </FormField>

                    <FormField label="Email Address" required error={errors.email?.message}>
                        <Input
                            type="email"
                            {...register('email')}
                            readOnly={!!accountId}
                            disabled={!!accountId}
                            error={!!errors.email}
                            icon={Mail}
                            placeholder="user@school.com"
                            className={accountId ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                        />
                    </FormField>

                    <FormField label="Account Password" required={!accountId} error={errors.password?.message}>
                        <Input
                            type="password"
                            {...register('password')}
                            error={!!errors.password}
                            icon={Lock}
                            placeholder={accountId ? 'Leave blank to keep current' : 'Min 8 chars, 1 upper, 1 lower, 1 num'}
                            className={FORM_INPUT_CLASS}
                        />
                    </FormField>

                    <FormField label="Contact Phone" error={errors.phone?.message}>
                        <Input
                            type="text"
                            {...register('phone')}
                            error={!!errors.phone}
                            icon={Phone}
                            placeholder="+1 555-0123"
                            className={FORM_INPUT_CLASS}
                        />
                    </FormField>
                        </FormGrid>
                    </div>
                </div>
            </FormSection>

            <FormActions
                onCancel={handleCancel}
                loadingId={`${cacheKeyPrefix}-submit`}
                loadingText="Saving..."
                title={`Save ${label.toLowerCase()} account`}
                description="Only the main organization admin can create, update, disable, restore, or delete this account type."
                submitText={accountId ? `Update ${label}` : `Create ${label}`}
            />
        </form>
    );
}
