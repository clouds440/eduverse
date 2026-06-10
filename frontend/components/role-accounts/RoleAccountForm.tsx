'use client';

import { useCallback, useMemo } from 'react';
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

    const onSubmit: SubmitHandler<RoleAccountFormData> = async (data) => {
        if (!token) return;

        dispatch({ type: 'UI_START_PROCESSING', payload: `${cacheKeyPrefix}-submit` });
        try {
            const { password, ...rest } = data;
            const payload: CreateRoleAccountRequest | UpdateRoleAccountRequest = {
                ...rest,
                ...(accountId ? (password ? { password } : {}) : { password }),
            };

            if (accountId) {
                await updateAccount(accountId, payload as UpdateRoleAccountRequest, token);
            } else {
                await createAccount(payload as CreateRoleAccountRequest, token);
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
            >
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
