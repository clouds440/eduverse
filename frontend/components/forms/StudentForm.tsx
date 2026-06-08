'use client';

import useSWR, { mutate } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Hash, ShieldCheck, UserX, GraduationCap, BookOpen, MapPin, Phone, Plus, Users, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import { useGlobal } from '@/context/GlobalContext';
import { Section, Student, StudentStatus, CreateStudentRequest, UpdateStudentRequest, Role, Cohort, AcademicCycle } from '@/types';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { FormActions, FormField, FormGrid, FormSection, FORM_INPUT_CLASS, FORM_READONLY_INPUT_CLASS } from '@/components/ui/FormLayout';
import { DocsLink } from '@/components/ui/DocsLink';
import { formatCourseSectionLabel } from '@/lib/utils';
import { useForm, SubmitHandler, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { studentCreateSchema, studentUpdateSchema, studentProfileSchema, StudentCreateFormData, StudentUpdateFormData, StudentProfileFormData } from '@/lib/schemas';

interface StudentFormProps {
    studentId?: string;
    initialData?: Student;
    isProfile?: boolean;
}

const STUDENT_STATUS_OPTIONS = [
    { value: StudentStatus.ACTIVE, label: 'Active', icon: ShieldCheck },
    { value: StudentStatus.SUSPENDED, label: 'Suspended', icon: UserX },
    { value: StudentStatus.ALUMNI, label: 'Alumni', icon: GraduationCap },
];

const GENDER_OPTIONS = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
];

function todayInputValue() {
    return new Date().toISOString().split('T')[0];
}

function dateInputValue(value?: string | Date | null, fallback = '') {
    return value ? new Date(value).toISOString().split('T')[0] : fallback;
}

function getStudentDefaults(initialData?: Student) {
    return initialData ? {
        name: initialData.user?.name || '',
        email: initialData.user?.email || '',
        password: '',
        registrationNumber: initialData.registrationNumber || '',
        rollNumber: initialData.rollNumber || '',
        admissionDate: dateInputValue(initialData.admissionDate, todayInputValue()),
        status: initialData.status as StudentStatus || StudentStatus.ACTIVE,
        sectionIds: initialData.enrollments?.filter(e => e.source !== 'COHORT').map(e => e.section.id) || [],
        major: initialData.major || '',
        department: initialData.department || '',
        fatherName: initialData.fatherName || '',
        age: initialData.age?.toString() || '',
        gender: initialData.gender || '',
        graduationDate: dateInputValue(initialData.graduationDate),
        phone: initialData.user?.phone || '',
        emergencyContact: initialData.emergencyContact || '',
        bloodGroup: initialData.bloodGroup || '',
        address: initialData.address || '',
        cohortId: initialData.cohortId || '',
    } : {
        name: '',
        email: '',
        password: '',
        registrationNumber: '',
        rollNumber: '',
        admissionDate: todayInputValue(),
        status: StudentStatus.ACTIVE,
        sectionIds: [],
        major: '',
        department: '',
        fatherName: '',
        age: '',
        gender: '',
        graduationDate: '',
        phone: '',
        emergencyContact: '',
        bloodGroup: '',
        address: '',
        cohortId: '',
    };
}

function studentStatusIcon(status?: StudentStatus) {
    if (status === StudentStatus.ACTIVE) return ShieldCheck;
    if (status === StudentStatus.SUSPENDED) return UserX;
    return GraduationCap;
}

export default function StudentForm({ studentId, initialData, isProfile }: StudentFormProps) {
    const { token, user: currentUser, updateUser } = useAuth();
    const router = useRouter();
    const { dispatch } = useGlobal();
    const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);

    const resolver = useMemo(
        () => zodResolver(isProfile ? studentProfileSchema : (studentId ? studentUpdateSchema : studentCreateSchema)),
        [isProfile, studentId]
    );
    const defaultValues = useMemo(() => getStudentDefaults(initialData), [initialData]);

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
            reset(getStudentDefaults(initialData));
        }
    }, [initialData, reset]);

    const watchedStatus = useWatch({ control, name: 'status' }) as StudentStatus | undefined;
    const watchedSectionIds = useWatch({ control, name: 'sectionIds' }) as string[] | undefined;
    const watchedCohortId = useWatch({ control, name: 'cohortId' }) as string | undefined;
    const watchedGender = useWatch({ control, name: 'gender' }) as string | undefined;

    const { data: sectionsData } = useSWR<{ data: Section[] }>(token ? ['sections', { limit: 1000 }] as const : null);
    const { data: cohortsData } = useSWR<{ data: (Cohort & { academicCycle?: AcademicCycle })[] }>(token ? ['cohorts', { limit: 500 }] as const : null);

    const sectionOptions = useMemo(() => (sectionsData?.data || []).map(section => ({
        value: section.id,
        label: formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name }),
    })), [sectionsData?.data]);

    const cohortOptions = useMemo(() => [
        { label: 'No Cohort', value: '' },
        ...(cohortsData?.data?.map(cohort => ({
            value: cohort.id,
            label: `${cohort.name} (${cohort.academicCycle?.name || 'No Cycle'})`,
        })) || []),
    ], [cohortsData?.data]);

    const isWatchMode = !isProfile && currentUser?.role === Role.TEACHER;
    const identityLocked = isProfile || isWatchMode;
    const registrationLocked = isProfile || isWatchMode || (!!studentId && currentUser?.role !== Role.ORG_ADMIN);
    const currentUserAvatarUrl = isProfile ? currentUser?.avatarUrl : '';

    const handleStatusChange = useCallback((value: string) => {
        if (isProfile || isWatchMode) return;
        setValue('status', value as StudentStatus);
        trigger('status');
    }, [isProfile, isWatchMode, setValue, trigger]);

    const handleCohortChange = useCallback((value: string) => {
        if (isProfile || isWatchMode) return;
        setValue('cohortId', value);
        trigger('cohortId');
    }, [isProfile, isWatchMode, setValue, trigger]);

    const handleSectionsChange = useCallback((values: string[]) => {
        if (isProfile || isWatchMode) return;
        setValue('sectionIds', values);
        trigger('sectionIds');
    }, [isProfile, isWatchMode, setValue, trigger]);

    const handleGenderChange = useCallback((value: string) => {
        if (isProfile || isWatchMode) return;
        setValue('gender', value);
        trigger('gender');
    }, [isProfile, isWatchMode, setValue, trigger]);

    const handlePhotoReady = useCallback((file: File) => {
        setPendingPhoto(file);
    }, []);

    const handleCancel = useCallback(() => {
        router.back();
    }, [router]);

    const onSubmit: SubmitHandler<StudentCreateFormData | StudentUpdateFormData | StudentProfileFormData> = async (data) => {
        dispatch({ type: 'UI_START_PROCESSING', payload: 'student-submit' });
        try {
            const { password, age, ...rest } = data;

            const payload: CreateStudentRequest | UpdateStudentRequest = {
                ...rest,
                age: age ? Number(age) : null,
                ...(studentId ? (password ? { password } : {}) : { password }),
            };

            let savedStudent: Student;
            if (isProfile) {
                savedStudent = await api.org.updateProfile<Student>(payload as UpdateStudentRequest, token!);
            } else if (studentId) {
                savedStudent = await api.org.updateStudent(studentId, payload as UpdateStudentRequest, token!);
            } else {
                savedStudent = await api.org.createStudent(payload as CreateStudentRequest, token!);
            }

            // Sync global auth state if the updated student is the current user.
            if ((isProfile || studentId === initialData?.id) && currentUser?.id === savedStudent.userId) {
                updateUser({
                    name: savedStudent.user.name,
                    email: savedStudent.user.email,
                });
                dispatch({ type: 'AUTH_SET_PROFILE', payload: savedStudent });
            }

            if (pendingPhoto && savedStudent.userId) {
                try {
                    const updatedUser = await api.org.uploadAvatar(savedStudent.userId, pendingPhoto, token!);
                    // Sync local auth state if the updated user is the current user.
                    if (currentUser?.id === savedStudent.userId) {
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
            dispatch({ type: 'TOAST_ADD', payload: { message: `${isProfile ? 'Profile' : (studentId ? 'Record' : 'Student')} ${studentId || isProfile ? 'updated' : 'registered'} successfully.`, type: 'success' } });
            if (isProfile) {
                router.refresh();
            } else {
                router.push('/students');
            }

            mutate(matchesCacheKeyPrefix('students'));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to save student';

            if (Array.isArray(message)) {
                message.forEach((m: string) => dispatch({ type: 'TOAST_ADD', payload: { message: m, type: 'error' } }));
            } else {
                dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            }
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'student-submit' });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <FormSection
                title="Enrollment & Account"
                description="Student identity, login credentials, admission status, and enrollment numbers."
                icon={GraduationCap}
            >
                <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
                    <div className="flex shrink-0 flex-col items-center border-b border-border/60 pb-5 lg:w-44 lg:border-b-0 lg:border-r lg:pr-6">
                        <PhotoUploadPicker
                            onFileReady={handlePhotoReady}
                            type="user"
                            currentImageUrl={initialData?.user?.avatarUrl || currentUserAvatarUrl}
                            updatedAt={initialData?.user?.avatarUpdatedAt}
                            disabled={isWatchMode}
                            hint={isWatchMode ? 'Photo is locked in read-only mode.' : studentId ? 'Update photo before saving changes.' : 'Add a square profile photo.'}
                            sizeClassName="h-28 w-28"
                        />
                    </div>

                    <div className="flex-1 space-y-5">
                        <FormGrid>
                            <FormField label="Full Name" error={errors.name?.message}>
                                <Input
                                    type="text"
                                    {...register('name')}
                                    readOnly={identityLocked}
                                    error={!!errors.name}
                                    disabled={identityLocked}
                                    icon={User}
                                    placeholder="Alex Johnson"
                                    className={identityLocked ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                                />
                            </FormField>

                            <FormField label="Account Email" error={errors.email?.message}>
                                <Input
                                    type="email"
                                    {...register('email')}
                                    readOnly={!!studentId || identityLocked}
                                    error={!!errors.email}
                                    disabled={!!studentId || identityLocked}
                                    icon={Mail}
                                    placeholder="alex.j@example.com"
                                    className={studentId || identityLocked ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                                />
                            </FormField>

                            <FormField label="Login Password" error={errors.password?.message}>
                                <Input
                                    type="password"
                                    {...register('password')}
                                    error={!!errors.password}
                                    disabled={isWatchMode}
                                    icon={Lock}
                                    placeholder={studentId ? 'Leave blank to keep current' : 'Min 8 chars, 1 upper, 1 lower, 1 num'}
                                    className={FORM_INPUT_CLASS}
                                />
                            </FormField>

                            <FormField label="Registration Number" required error={errors.registrationNumber?.message}>
                                <Input
                                    type="text"
                                    {...register('registrationNumber')}
                                    readOnly={registrationLocked}
                                    error={!!errors.registrationNumber}
                                    disabled={registrationLocked}
                                    icon={Hash}
                                    placeholder="ST-2026-001"
                                    className={registrationLocked ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                                />
                            </FormField>

                            <FormField label="Roll Number" required error={errors.rollNumber?.message}>
                                <Input
                                    type="text"
                                    {...register('rollNumber')}
                                    readOnly={registrationLocked}
                                    error={!!errors.rollNumber}
                                    disabled={registrationLocked}
                                    icon={Hash}
                                    placeholder="2026-001"
                                    className={registrationLocked ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                                />
                            </FormField>

                            <FormField label="Admission Date" error={errors.admissionDate?.message}>
                                <Input
                                    type="date"
                                    {...register('admissionDate')}
                                    readOnly={identityLocked}
                                    error={!!errors.admissionDate}
                                    disabled={identityLocked}
                                    className={identityLocked ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                                />
                            </FormField>

                            <FormField label="Student Status" error={errors.status?.message}>
                                <CustomSelect
                                    options={STUDENT_STATUS_OPTIONS}
                                    value={watchedStatus || StudentStatus.ACTIVE}
                                    onChange={handleStatusChange}
                                    error={!!errors.status}
                                    disabled={identityLocked}
                                    icon={studentStatusIcon(watchedStatus)}
                                />
                            </FormField>
                        </FormGrid>

                        <FormGrid>
                            <FormField label="Major / Program" required error={errors.major?.message}>
                                <Input
                                    type="text"
                                    {...register('major')}
                                    readOnly={identityLocked}
                                    error={!!errors.major}
                                    disabled={identityLocked}
                                    icon={GraduationCap}
                                    placeholder="Computer Science"
                                    className={identityLocked ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                                />
                            </FormField>

                            <FormField label="Department" error={errors.department?.message}>
                                <Input
                                    type="text"
                                    {...register('department')}
                                    readOnly={identityLocked}
                                    error={!!errors.department}
                                    disabled={identityLocked}
                                    icon={BookOpen}
                                    placeholder="Engineering & Tech"
                                    className={identityLocked ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                                />
                            </FormField>
                        </FormGrid>
                    </div>
                </div>
            </FormSection>

            <FormSection
                title="Academic Placement"
                description={<>Cohort and individual section placement. <DocsLink href="/docs/students#student-academic-placement">Read placement rules</DocsLink></>}
                icon={Users}
            >
                <FormGrid className="items-start">
                    <FormField label="Enroll in Cohort" error={errors.cohortId?.message}>
                        <CustomSelect
                            options={cohortOptions}
                            value={watchedCohortId || ''}
                            onChange={handleCohortChange}
                            placeholder="Select a cohort..."
                            error={!!errors.cohortId}
                            disabled={identityLocked}
                            icon={Users}
                        />
                    </FormField>

                    <FormField label="Enroll in Individual Sections" error={errors.sectionIds?.message}>
                        <CustomMultiSelect
                            options={sectionOptions}
                            values={watchedSectionIds || []}
                            onChange={handleSectionsChange}
                            placeholder="Select one or more sections..."
                            error={!!errors.sectionIds}
                            disabled={identityLocked}
                        />
                    </FormField>
                </FormGrid>
            </FormSection>

            <FormSection
                title="Expected Progress"
                description="Projected graduation timeline for the learner."
                icon={CalendarClock}
            >
                <FormGrid columns={1}>
                    <FormField label="Exp. Graduation" error={errors.graduationDate?.message} className="max-w-xl">
                        <Input
                            type="date"
                            {...register('graduationDate')}
                            readOnly={identityLocked}
                            error={!!errors.graduationDate}
                            disabled={identityLocked}
                            className={identityLocked ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                        />
                    </FormField>
                </FormGrid>
            </FormSection>

            <FormSection
                title="Personal Profile"
                description="Guardian, demographic, contact, and residential information."
                icon={User}
            >
                <FormGrid columns={3} className="mb-5">
                    <FormField label="Father / Guardian Name" error={errors.fatherName?.message}>
                        <Input
                            type="text"
                            {...register('fatherName')}
                            error={!!errors.fatherName}
                            disabled={isWatchMode}
                            icon={User}
                            placeholder="Michael Johnson"
                            className={isWatchMode ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                        />
                    </FormField>

                    <FormField label="Current Age" error={errors.age?.message}>
                        <Input
                            type="number"
                            {...register('age')}
                            error={!!errors.age}
                            disabled={isWatchMode}
                            icon={User}
                            placeholder="16"
                            className={isWatchMode ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                        />
                    </FormField>

                    <FormField label="Gender Identification" required error={errors.gender?.message}>
                        <CustomSelect
                            options={GENDER_OPTIONS}
                            value={watchedGender || ''}
                            onChange={handleGenderChange}
                            error={!!errors.gender}
                            disabled={identityLocked}
                            icon={Users}
                            placeholder="Gender"
                        />
                    </FormField>
                </FormGrid>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-4">
                        <FormField label="Contact Phone" error={errors.phone?.message}>
                            <Input
                                type="text"
                                {...register('phone')}
                                error={!!errors.phone}
                                disabled={isWatchMode}
                                icon={Phone}
                                placeholder="+1 555-0100"
                                className={isWatchMode ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                            />
                        </FormField>

                        <FormField label="Emergency Contact" error={errors.emergencyContact?.message}>
                            <Input
                                type="text"
                                {...register('emergencyContact')}
                                error={!!errors.emergencyContact}
                                disabled={isWatchMode}
                                icon={Phone}
                                placeholder="Relationship - Phone"
                                className={isWatchMode ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                            />
                        </FormField>

                        <FormField label="Blood Group" error={errors.bloodGroup?.message}>
                            <Input
                                type="text"
                                {...register('bloodGroup')}
                                error={!!errors.bloodGroup}
                                disabled={isWatchMode}
                                icon={Plus}
                                placeholder="A+, B-, etc."
                                className={isWatchMode ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                            />
                        </FormField>
                    </div>

                    <FormField label="Residential Address" error={errors.address?.message}>
                        <Textarea
                            {...register('address')}
                            disabled={isWatchMode}
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
                cancelText={isWatchMode ? 'Go Back' : 'Cancel'}
                showSubmit={!isWatchMode}
                loadingId="student-submit"
                loadingText="Saving..."
                title={isWatchMode ? 'Student record' : 'Save student record'}
                description={isWatchMode ? 'This record is open in read-only mode.' : 'Photo, enrollment, academic, and contact changes are applied together.'}
                submitText={isProfile ? 'Update Profile' : (studentId ? 'Update Student Record' : 'Register Student')}
            />
        </form>
    );
}
