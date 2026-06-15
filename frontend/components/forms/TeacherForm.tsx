'use client';

import useSWR, { mutate } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { User, Mail, Lock, BookOpen, Phone, Plus, ShieldCheck, UserX, CalendarClock, MapPin, UserLock, BriefcaseBusiness } from 'lucide-react';
import { api } from '@/lib/api';
import { useGlobal } from '@/context/GlobalContext';
import { Department, DepartmentScopeType, Section, Teacher, TeacherStatus, Role, CreateTeacherRequest, UpdateTeacherRequest } from '@/types';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { FormActions, FormField, FormGrid, FormSection, FORM_INPUT_CLASS, FORM_READONLY_INPUT_CLASS } from '@/components/ui/FormLayout';
import { formatCourseSectionLabel, formatDepartmentLabel } from '@/lib/utils';
import { useForm, SubmitHandler, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { teacherCreateSchema, teacherUpdateSchema, teacherProfileSchema, TeacherCreateFormData, TeacherUpdateFormData, TeacherProfileFormData } from '@/lib/schemas';
import { Toggle } from '@/components/ui/Toggle';
import { DocsLink } from '@/components/ui/DocsLink';
import { Badge } from '../ui/Badge';

interface TeacherFormProps {
    teacherId?: string;
    initialData?: Teacher;
    isProfile?: boolean;
    defaultManager?: boolean;
}

const TEACHER_STATUS_OPTIONS = [
    { value: TeacherStatus.ACTIVE, label: 'Active', icon: ShieldCheck },
    { value: TeacherStatus.SUSPENDED, label: 'Suspended', icon: UserX },
    { value: TeacherStatus.ON_LEAVE, label: 'On Leave', icon: CalendarClock },
    { value: TeacherStatus.EMERITUS, label: 'Emeritus', icon: UserLock },
];

function todayInputValue() {
    return new Date().toISOString().split('T')[0];
}

function dateInputValue(value?: string | Date | null, fallback = '') {
    return value ? new Date(value).toISOString().split('T')[0] : fallback;
}

function getTeacherDefaults(initialData?: Teacher, initialIsManager = false) {
    return initialData ? {
        name: initialData.user?.name || '',
        phone: initialData.user?.phone || '',
        email: initialData.user?.email || '',
        password: '',
        education: initialData.education || '',
        designation: initialData.designation || '',
        subject: initialData.subject || '',
        isManager: !!initialIsManager,
        department: initialData.department || '',
        departmentIds: initialData.teacherDepartments?.map((entry) => entry.departmentId) || [],
        departmentScopeType: initialData.departmentScopeType || DepartmentScopeType.ALL,
        scopeDepartmentIds: initialData.managerDepartments?.map((entry) => entry.departmentId) || [],
        joiningDate: dateInputValue(initialData.joiningDate, todayInputValue()),
        address: initialData.address || '',
        emergencyContact: initialData.emergencyContact || '',
        bloodGroup: initialData.bloodGroup || '',
        status: initialData.status as TeacherStatus || TeacherStatus.ACTIVE,
        sectionIds: initialData.sections?.map(s => s.id) || [],
    } : {
        name: '',
        phone: '',
        email: '',
        password: '',
        education: '',
        designation: '',
        subject: '',
        isManager: false,
        department: '',
        departmentIds: [],
        departmentScopeType: DepartmentScopeType.ALL,
        scopeDepartmentIds: [],
        joiningDate: todayInputValue(),
        address: '',
        emergencyContact: '',
        bloodGroup: '',
        status: TeacherStatus.ACTIVE,
        sectionIds: [],
    };
}

function teacherStatusIcon(status?: TeacherStatus) {
    if (status === TeacherStatus.ACTIVE) return ShieldCheck;
    if (status === TeacherStatus.SUSPENDED) return UserX;
    if (status === TeacherStatus.EMERITUS) return UserLock;
    return CalendarClock;
}

export default function TeacherForm({ teacherId, initialData, isProfile, defaultManager = false }: TeacherFormProps) {
    const { token, user: currentUser, updateUser } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { dispatch } = useGlobal();
    const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
    const listHref = pathname.startsWith('/users/teachers') ? '/users/teachers' : '/teachers';

    const initialIsManager = initialData?.user?.role === Role.ORG_MANAGER || defaultManager || (isProfile && currentUser?.role === Role.ORG_MANAGER);
    const resolver = useMemo(
        () => zodResolver(isProfile ? teacherProfileSchema : (teacherId ? teacherUpdateSchema : teacherCreateSchema)),
        [isProfile, teacherId]
    );
    const defaultValues = useMemo(
        () => getTeacherDefaults(initialData, initialIsManager),
        [initialData, initialIsManager]
    );

    const {
        control,
        register,
        handleSubmit,
        setValue,
        trigger,
        reset,
        formState: { errors },
    } = useForm({
        resolver,
        defaultValues,
    });

    useEffect(() => {
        if (initialData) {
            reset(getTeacherDefaults(initialData, initialData.user?.role === Role.ORG_MANAGER || (isProfile && currentUser?.role === Role.ORG_MANAGER)));
        }
    }, [initialData, reset, isProfile, currentUser?.role]);

    const watchedStatus = useWatch({ control, name: 'status' }) as TeacherStatus | undefined;
    const watchedIsManager = useWatch({ control, name: 'isManager' }) as boolean | undefined;
    const watchedSectionIds = useWatch({ control, name: 'sectionIds' }) as string[] | undefined;
    const watchedDepartmentIds = useWatch({ control, name: 'departmentIds' }) as string[] | undefined;
    const watchedDepartmentScopeType = useWatch({ control, name: 'departmentScopeType' }) as DepartmentScopeType | undefined;
    const watchedScopeDepartmentIds = useWatch({ control, name: 'scopeDepartmentIds' }) as string[] | undefined;

    const { data: sectionsData } = useSWR<{ data: Section[] }>(token ? ['sections', { limit: 1000 }] as const : null);
    const { data: departmentsData } = useSWR<{ data: Department[] }>(token ? ['departments', { limit: 1000, isActive: true }] as const : null);
    const sectionOptions = useMemo(() => (sectionsData?.data || []).map(section => ({
        value: section.id,
        label: formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name }),
    })), [sectionsData?.data]);
    const departmentOptions = useMemo(() => (departmentsData?.data || []).map(department => ({
        value: department.id,
        label: formatDepartmentLabel(department),
    })), [departmentsData?.data]);

    const canAssignManagerRole = currentUser?.role === Role.ORG_ADMIN || currentUser?.role === Role.SUB_ADMIN;
    const isManagerLocked = !canAssignManagerRole;
    const isStatusLocked = isProfile || (
        currentUser?.role === Role.ORG_MANAGER &&
        (initialData?.user?.role === Role.ORG_MANAGER || currentUser?.id === initialData?.userId)
    );
    const editableClass = isProfile ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS;
    const currentUserAvatarUrl = isProfile ? currentUser?.avatarUrl : '';

    const handleStatusChange = useCallback((value: string) => {
        if (isProfile) return;
        setValue('status', value as TeacherStatus);
        trigger('status');
    }, [isProfile, setValue, trigger]);

    const handleManagerChange = useCallback((checked: boolean) => {
        if (!canAssignManagerRole) return;
        setValue('isManager', checked);
        if (!checked) {
            setValue('departmentScopeType', DepartmentScopeType.ALL);
            setValue('scopeDepartmentIds', []);
        }
        trigger('isManager');
    }, [canAssignManagerRole, setValue, trigger]);

    const handleDepartmentsChange = useCallback((values: string[]) => {
        if (isProfile) return;
        setValue('departmentIds', values);
        trigger('departmentIds');
    }, [isProfile, setValue, trigger]);

    const handleScopeTypeChange = useCallback((value: string) => {
        setValue('departmentScopeType', value as DepartmentScopeType);
        if (value === DepartmentScopeType.ALL) setValue('scopeDepartmentIds', []);
        trigger(['departmentScopeType', 'scopeDepartmentIds']);
    }, [setValue, trigger]);

    const handleScopeDepartmentsChange = useCallback((values: string[]) => {
        setValue('scopeDepartmentIds', values);
        trigger('scopeDepartmentIds');
    }, [setValue, trigger]);

    const handleSectionsChange = useCallback((values: string[]) => {
        if (isProfile) return;
        setValue('sectionIds', values);
        trigger('sectionIds');
    }, [isProfile, setValue, trigger]);

    const handlePhotoReady = useCallback((file: File) => {
        setPendingPhoto(file);
    }, []);

    const handleCancel = useCallback(() => {
        router.back();
    }, [router]);

    const onSubmit: SubmitHandler<TeacherCreateFormData | TeacherUpdateFormData | TeacherProfileFormData> = async (data) => {
        dispatch({ type: 'UI_START_PROCESSING', payload: 'teacher-submit' });
        try {
            const { password, ...rest } = data;

            const payload: CreateTeacherRequest | UpdateTeacherRequest = {
                ...rest,
                ...(teacherId ? (password ? { password } : {}) : { password }),
            };

            let savedTeacher: Teacher;
            if (isProfile) {
                savedTeacher = await api.org.updateProfile<Teacher>(payload as UpdateTeacherRequest, token!);
            } else if (teacherId) {
                savedTeacher = await api.org.updateTeacher(teacherId, payload as UpdateTeacherRequest, token!);
            } else {
                savedTeacher = await api.org.createTeacher(payload as CreateTeacherRequest, token!);
            }

            // Sync global auth state if the updated teacher is the current user.
            if ((isProfile || teacherId === initialData?.id) && currentUser?.id === savedTeacher.userId) {
                updateUser({
                    name: savedTeacher.user.name,
                    email: savedTeacher.user.email,
                });
                dispatch({ type: 'AUTH_SET_PROFILE', payload: savedTeacher });
            }

            if (pendingPhoto && savedTeacher.userId) {
                try {
                    const updatedUser = await api.org.uploadAvatar(savedTeacher.userId, pendingPhoto, token!);
                    // Sync local auth state if the updated user is the current user.
                    if (currentUser?.id === savedTeacher.userId) {
                        updateUser({
                            avatarUrl: updatedUser.avatarUrl,
                            avatarUpdatedAt: updatedUser.avatarUpdatedAt?.toString(),
                        });
                    }
                } catch {
                    dispatch({ type: 'TOAST_ADD', payload: { message: 'Profile updated, but photo upload failed', type: 'info' } });
                }
            }

            window.dispatchEvent(new Event('stats-updated'));
            dispatch({ type: 'TOAST_ADD', payload: { message: `${isProfile ? 'Profile' : 'Teacher account'} ${teacherId || isProfile ? 'updated' : 'created'} successfully`, type: 'success' } });
            if (isProfile) {
                router.back();
            } else {
                router.push(listHref);
            }

            mutate(matchesCacheKeyPrefix('teachers'));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to save teacher';

            if (Array.isArray(message)) {
                message.forEach((m: string) => dispatch({ type: 'TOAST_ADD', payload: { message: m, type: 'error' } }));
            } else {
                dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            }
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'teacher-submit' });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <FormSection
                title="Account & Credentials"
                description="Core identity, sign-in details, and current account availability."
                icon={User}
            >
                <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
                    <div className="flex shrink-0 flex-col items-center border-b border-border/60 pb-5 lg:w-44 lg:border-b-0 lg:border-r lg:pr-6">
                        <PhotoUploadPicker
                            onFileReady={handlePhotoReady}
                            type="user"
                            currentImageUrl={initialData?.user?.avatarUrl || currentUserAvatarUrl}
                            updatedAt={initialData?.user?.avatarUpdatedAt}
                            hint={teacherId ? 'Update photo before saving changes.' : 'Add a square profile photo.'}
                            sizeClassName="h-28 w-28"
                        />
                    </div>

                    <div className="flex-1 space-y-5">
                        <FormGrid>
                            <FormField label="Full Name" error={errors.name?.message}>
                                <Input
                                    type="text"
                                    {...register('name')}
                                    readOnly={isProfile}
                                    error={!!errors.name}
                                    disabled={isProfile}
                                    icon={User}
                                    placeholder="Dr. Sarah Wilson"
                                    className={editableClass}
                                />
                            </FormField>

                            <FormField label="Status" error={errors.status?.message}>
                                <CustomSelect
                                    options={TEACHER_STATUS_OPTIONS}
                                    value={watchedStatus || TeacherStatus.ACTIVE}
                                    onChange={handleStatusChange}
                                    error={!!errors.status}
                                    disabled={isStatusLocked}
                                    icon={teacherStatusIcon(watchedStatus)}
                                />
                            </FormField>

                            <FormField label="Email Address" error={errors.email?.message}>
                                <Input
                                    type="email"
                                    {...register('email')}
                                    readOnly={!!teacherId || isProfile}
                                    error={!!errors.email}
                                    disabled={!!teacherId || isProfile}
                                    icon={Mail}
                                    placeholder="sarah.wilson@school.com"
                                    className={teacherId || isProfile ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                                />
                            </FormField>

                            <FormField label="Account Password" error={errors.password?.message}>
                                <Input
                                    type="password"
                                    {...register('password')}
                                    error={!!errors.password}
                                    icon={Lock}
                                    placeholder={teacherId ? 'Leave blank to keep current' : 'Min 8 chars, 1 upper, 1 lower, 1 num'}
                                    className={FORM_INPUT_CLASS}
                                />
                            </FormField>
                        </FormGrid>

                        <FormGrid columns={3}>
                            <FormField label="Education / Degree" required error={errors.education?.message}>
                                <Input
                                    type="text"
                                    {...register('education')}
                                    readOnly={isProfile}
                                    error={!!errors.education}
                                    disabled={isProfile}
                                    icon={BookOpen}
                                    placeholder="Ph.D. in Computer Science"
                                    className={editableClass}
                                />
                            </FormField>

                            <FormField label="Designation" required error={errors.designation?.message}>
                                <Input
                                    type="text"
                                    {...register('designation')}
                                    readOnly={isProfile}
                                    error={!!errors.designation}
                                    disabled={isProfile}
                                    icon={User}
                                    placeholder="Senior Faculty / HOD"
                                    className={editableClass}
                                />
                            </FormField>

                            <FormField label="Subject Expertise" required error={errors.subject?.message}>
                                <Input
                                    type="text"
                                    {...register('subject')}
                                    readOnly={isProfile}
                                    error={!!errors.subject}
                                    disabled={isProfile}
                                    icon={BookOpen}
                                    placeholder="Mathematics / AI / Physics"
                                    className={editableClass}
                                />
                            </FormField>
                        </FormGrid>
                    </div>
                </div>
            </FormSection>

            <FormSection
                title="Workplace Details"
                description="Department placement, joining date, and administrative access."
                icon={BriefcaseBusiness}
            >
                <FormGrid>
                    <FormField label="Departments" error={errors.departmentIds?.message}>
                        <CustomMultiSelect
                            options={departmentOptions}
                            values={watchedDepartmentIds || []}
                            onChange={handleDepartmentsChange}
                            placeholder="Choose departments..."
                            error={!!errors.departmentIds}
                            disabled={isProfile}
                        />
                    </FormField>

                    <FormField label="Joining Date" error={errors.joiningDate?.message}>
                        <Input
                            type="date"
                            {...register('joiningDate')}
                            readOnly={isProfile}
                            error={!!errors.joiningDate}
                            disabled={isProfile}
                            className={isProfile ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                        />
                    </FormField>
                </FormGrid>

                <div className={`mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4 transition-colors ${isManagerLocked ? 'cursor-not-allowed' : 'hover:border-primary/35'}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className={isManagerLocked ? 'pointer-events-none opacity-70' : ''}>
                            <Toggle
                                checked={!!watchedIsManager}
                                onCheckedChange={handleManagerChange}
                                disabled={isManagerLocked}
                                size="lg"
                                label="Administrative Privileges"
                                description="Allow this teacher to manage assigned academic sections, students, attendance, grades, and assessments"
                            />
                        </div>
                        {watchedIsManager && (
                            <Badge title="" variant="success">
                                Manager Privileges Active
                            </Badge>
                        )}
                    </div>
                </div>

                {watchedIsManager && (
                    <FormGrid className="mt-5">
                        <FormField label="Department Scope" error={errors.departmentScopeType?.message}>
                            <CustomSelect
                                options={[
                                    { value: DepartmentScopeType.ALL, label: 'All Departments' },
                                    { value: DepartmentScopeType.SELECTED, label: 'Selected Departments' },
                                ]}
                                value={watchedDepartmentScopeType || DepartmentScopeType.ALL}
                                onChange={handleScopeTypeChange}
                                disabled={isManagerLocked}
                                icon={BriefcaseBusiness}
                            />
                        </FormField>

                        {watchedDepartmentScopeType === DepartmentScopeType.SELECTED && (
                            <FormField label="Scoped Departments" error={errors.scopeDepartmentIds?.message}>
                                <CustomMultiSelect
                                    options={departmentOptions}
                                    values={watchedScopeDepartmentIds || []}
                                    onChange={handleScopeDepartmentsChange}
                                    placeholder="Choose departments this manager can access..."
                                    error={!!errors.scopeDepartmentIds}
                                    disabled={isManagerLocked}
                                />
                            </FormField>
                        )}
                    </FormGrid>
                )}
            </FormSection>

            <FormSection
                title="Section Assignments"
                description={<>Attach this teacher to sections they can manage. <DocsLink href="/docs/teachers#teacher-assignments">Read assignment rules</DocsLink></>}
                icon={Plus}
            >
                <FormField
                    label="Assign to Sections"
                    error={errors.sectionIds?.message}
                    helper={<>Teacher can manage selected sections and can be chosen for their schedules. <DocsLink href="/docs/timetable#schedule-teacher">Schedule rules</DocsLink></>}
                    className="max-w-2xl"
                >
                    <CustomMultiSelect
                        options={sectionOptions}
                        values={watchedSectionIds || []}
                        onChange={handleSectionsChange}
                        placeholder="Choose one or more sections..."
                        error={!!errors.sectionIds}
                        disabled={isProfile}
                    />
                </FormField>
            </FormSection>

            <FormSection
                title="Personal Details"
                description="Contact, emergency, and residential information."
                icon={Phone}
            >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-4">
                        <FormField label="Contact Phone" required error={errors.phone?.message}>
                            <Input
                                type="text"
                                {...register('phone')}
                                error={!!errors.phone}
                                icon={Phone}
                                placeholder="+1 555-0123"
                                className={FORM_INPUT_CLASS}
                            />
                        </FormField>

                        <FormField label="Emergency Contact" error={errors.emergencyContact?.message}>
                            <Input
                                type="text"
                                {...register('emergencyContact')}
                                error={!!errors.emergencyContact}
                                icon={Phone}
                                placeholder="Name - Relation - Phone"
                                className={FORM_INPUT_CLASS}
                            />
                        </FormField>

                        <FormField label="Blood Group" error={errors.bloodGroup?.message}>
                            <Input
                                type="text"
                                {...register('bloodGroup')}
                                error={!!errors.bloodGroup}
                                icon={Plus}
                                placeholder="O+, A-, etc."
                                className={FORM_INPUT_CLASS}
                            />
                        </FormField>
                    </div>

                    <FormField label="Residential Address" error={errors.address?.message}>
                        <Textarea
                            {...register('address')}
                            error={!!errors.address}
                            icon={MapPin}
                            placeholder="123 Education Lane, Learning City"
                            className="min-h-40 font-medium"
                        />
                    </FormField>
                </div>
            </FormSection>

            <FormActions
                onCancel={handleCancel}
                loadingId="teacher-submit"
                loadingText="Saving..."
                title={isProfile ? 'Save profile changes' : 'Save faculty record'}
                description="Photo, account, assignment, and contact changes are applied together."
                submitText={isProfile ? 'Update Profile' : (teacherId ? 'Update Faculty Member' : 'Create Faculty Account')}
            />
        </form>
    );
}
