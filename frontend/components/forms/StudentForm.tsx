'use client';

import useSWR, { mutate } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Hash, ShieldCheck, UserX, GraduationCap, BookOpen, MapPin, Phone, Plus, Users, DollarSign } from 'lucide-react';
import { api } from '@/lib/api';
import { useGlobal } from '@/context/GlobalContext';
import { Section, Student, StudentStatus, CreateStudentRequest, UpdateStudentRequest, Role, Cohort, AcademicCycle } from '@/types';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { studentCreateSchema, studentUpdateSchema, studentProfileSchema, StudentCreateFormData, StudentUpdateFormData, StudentProfileFormData } from '@/lib/schemas';

interface StudentFormProps {
    studentId?: string;
    initialData?: Student;
    isProfile?: boolean;
}

export default function StudentForm({ studentId, initialData, isProfile }: StudentFormProps) {
    const { token, user: currentUser, updateUser } = useAuth();
    const router = useRouter();
    const { dispatch } = useGlobal();

    const [sections, setSections] = useState<Section[]>([]);
    const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        trigger,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(isProfile ? studentProfileSchema : (studentId ? studentUpdateSchema : studentCreateSchema)),
        defaultValues: initialData ? {
            name: initialData.user?.name || '',
            email: initialData.user?.email || '',
            password: '',
            registrationNumber: initialData.registrationNumber || '',
            rollNumber: initialData.rollNumber || '',
            admissionDate: initialData.admissionDate ? new Date(initialData.admissionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            status: initialData.status as StudentStatus || StudentStatus.ACTIVE,
            sectionIds: initialData.enrollments?.map(e => e.section.id) || [],
            major: initialData.major || '',
            department: initialData.department || '',
            fatherName: initialData.fatherName || '',
            age: initialData.age?.toString() || '',
            gender: initialData.gender || '',
            fee: initialData.fee?.toString() || '',
            feePlan: initialData.feePlan || '',
            graduationDate: initialData.graduationDate ? new Date(initialData.graduationDate).toISOString().split('T')[0] : '',
            phone: initialData.user?.phone || '',
            emergencyContact: initialData.emergencyContact || '',
            bloodGroup: initialData.bloodGroup || '',
            address: initialData.address || '',
            cohortId: initialData.cohortId || ''
        } : {
            name: '',
            email: '',
            password: '',
            registrationNumber: '',
            rollNumber: '',
            admissionDate: new Date().toISOString().split('T')[0],
            status: StudentStatus.ACTIVE,
            sectionIds: [],
            major: '',
            department: '',
            fatherName: '',
            age: '',
            gender: '',
            fee: '',
            feePlan: '',
            graduationDate: '',
            phone: '',
            emergencyContact: '',
            bloodGroup: '',
            address: '',
            cohortId: ''
        }
    });

    useEffect(() => {
        if (initialData) {
            reset({
                name: initialData.user?.name || '',
                email: initialData.user?.email || '',
                password: '',
                registrationNumber: initialData.registrationNumber || '',
                rollNumber: initialData.rollNumber || '',
                admissionDate: initialData.admissionDate ? new Date(initialData.admissionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                status: initialData.status as StudentStatus || StudentStatus.ACTIVE,
                sectionIds: initialData.enrollments?.map(e => e.section.id) || [],
                major: initialData.major || '',
                department: initialData.department || '',
                fatherName: initialData.fatherName || '',
                age: initialData.age?.toString() || '',
                gender: initialData.gender || '',
                fee: initialData.fee?.toString() || '',
                feePlan: initialData.feePlan || '',
                graduationDate: initialData.graduationDate ? new Date(initialData.graduationDate).toISOString().split('T')[0] : '',
                phone: initialData.user?.phone || '',
                emergencyContact: initialData.emergencyContact || '',
                bloodGroup: initialData.bloodGroup || '',
                address: initialData.address || '',
                cohortId: initialData.cohortId || ''
            });
        }
    }, [initialData, reset]);

    const formData = watch();

    const onSubmit: SubmitHandler<StudentCreateFormData | StudentUpdateFormData | StudentProfileFormData> = async (data) => {
        dispatch({ type: 'UI_START_PROCESSING', payload: 'student-submit' });
        try {
            const { password, fee, age, ...rest } = data;

            const payload: CreateStudentRequest | UpdateStudentRequest = {
                ...rest,
                fee: fee ? Number(fee) : null,
                age: age ? Number(age) : null,
                ...(studentId ? (password ? { password } : {}) : { password })
            };

            let savedStudent: Student;
            if (isProfile) {
                savedStudent = await api.org.updateProfile<Student>(payload as UpdateStudentRequest, token!);
            } else if (studentId) {
                savedStudent = await api.org.updateStudent(studentId, payload as UpdateStudentRequest, token!);
            } else {
                savedStudent = await api.org.createStudent(payload as CreateStudentRequest, token!);
            }

            // Sync global auth state if the updated student is the current user
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
                    // Sync local auth state if the updated user is the current user
                    if (currentUser?.id === savedStudent.userId) {
                        updateUser({
                            avatarUrl: updatedUser.avatarUrl,
                            avatarUpdatedAt: updatedUser.avatarUpdatedAt?.toString()
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

            // Invalidate all student lists
            mutate(matchesCacheKeyPrefix('students'));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to save student';

            if (Array.isArray(message)) {
                message.forEach((m: string) => dispatch({ type: 'TOAST_ADD', payload: { message: m, type: 'error' } }));
            } else {
                dispatch({ type: 'TOAST_ADD', payload: { message: message, type: 'error' } });
            }
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'student-submit' });
        }
    };

    const { data: cohortsData } = useSWR<{ data: (Cohort & { academicCycle?: AcademicCycle })[] }>(token ? ['cohorts', { limit: 500 }] : null);

    useEffect(() => {
        if (token) {
            api.org.getSections(token).then(res => setSections(res.data || [])).catch(console.error);
        }
    }, [token]);

    const handlePhotoReady = useCallback((file: File) => {
        setPendingPhoto(file);
    }, []);

    const isWatchMode = !isProfile && currentUser?.role === Role.TEACHER;
    const currentUserAvatarUrl = isProfile ? currentUser?.avatarUrl : '';

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 md:space-y-12" noValidate>
            {/* Enrollment Details */}
            <div className="bg-linear-to-br from-card via-card/95 to-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
                <div className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start mb-8 md:mb-10">
                        <div className="shrink-0 group relative mx-auto md:mx-0">
                            <PhotoUploadPicker
                                onFileReady={handlePhotoReady}
                                type="user"
                                currentImageUrl={initialData?.user?.avatarUrl || currentUserAvatarUrl}
                                updatedAt={initialData?.user?.avatarUpdatedAt}
                                disabled={isWatchMode}
                            />
                            {!isWatchMode && (
                                <p className="mt-3 text-xs text-center font-semibold tracking-wider text-muted-foreground group-hover:text-primary transition-colors">
                                    {studentId ? 'Update Photo' : 'Upload Photo'}
                                </p>
                            )}
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
                            <div className="space-y-2 md:space-y-3">
                                <Label>Full Name</Label>
                                <Input
                                    type="text"
                                    {...register('name')}
                                    onChange={(isProfile || isWatchMode) ? undefined : register('name').onChange}
                                    readOnly={isProfile || isWatchMode}
                                    value={watch('name') || ''}
                                    error={!!errors.name}
                                    disabled={isProfile || isWatchMode}
                                    icon={User}
                                    placeholder="Alex Johnson"
                                    className={isProfile || isWatchMode ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                                />
                                {errors.name && <p className="mt-1 text-xs text-danger font-semibold">{errors.name.message}</p>}
                            </div>

                            <div className="space-y-2 md:space-y-3">
                                <Label>Account Email</Label>
                                <Input
                                    type="email"
                                    {...register('email')}
                                    onChange={(!!studentId || isProfile || isWatchMode) ? undefined : register('email').onChange}
                                    readOnly={!!studentId || isProfile || isWatchMode}
                                    value={watch('email') || ''}
                                    error={!!errors.email}
                                    disabled={!!studentId || isProfile || isWatchMode}
                                    icon={Mail}
                                    placeholder="alex.j@example.com"
                                    className={studentId || isProfile || isWatchMode ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                                />
                                {errors.email && <p className="mt-1 text-xs text-danger font-semibold">{errors.email.message}</p>}
                            </div>

                            <div className="space-y-2 md:space-y-3">
                                <Label>Login Password</Label>
                                <Input
                                    type="password"
                                    {...register('password')}
                                    error={!!errors.password}
                                    disabled={isWatchMode}
                                    icon={Lock}
                                    placeholder={studentId ? "Leave blank to keep current" : "Min 8 chars, 1 upper, 1 lower, 1 num"}
                                    className="font-medium"
                                />
                                {errors.password && <p className="mt-1 text-xs text-danger font-semibold">{errors.password.message}</p>}
                            </div>

                            <div className="space-y-2 md:space-y-3">
                                <Label>Registration Number <span className="text-danger">*</span></Label>
                                <Input
                                    type="text"
                                    {...register('registrationNumber')}
                                    onChange={(isProfile || isWatchMode || (!!studentId && currentUser?.role !== Role.ORG_ADMIN)) ? undefined : register('registrationNumber').onChange}
                                    readOnly={isProfile || isWatchMode || (!!studentId && currentUser?.role !== Role.ORG_ADMIN)}
                                    value={watch('registrationNumber') || ''}
                                    error={!!errors.registrationNumber}
                                    disabled={isProfile || isWatchMode || (!!studentId && currentUser?.role !== Role.ORG_ADMIN)}
                                    icon={Hash}
                                    placeholder="ST-2026-001"
                                    className={isProfile || isWatchMode || (!!studentId && currentUser?.role !== Role.ORG_ADMIN) ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                                />
                                {errors.registrationNumber && <p className="mt-1 text-xs text-danger font-semibold">{errors.registrationNumber.message}</p>}
                            </div>

                            <div className="space-y-2 md:space-y-3">
                                <Label>Roll Number <span className="text-danger">*</span></Label>
                                <Input
                                    type="text"
                                    {...register('rollNumber')}
                                    onChange={(isProfile || isWatchMode || (!!studentId && currentUser?.role !== Role.ORG_ADMIN)) ? undefined : register('rollNumber').onChange}
                                    readOnly={isProfile || isWatchMode || (!!studentId && currentUser?.role !== Role.ORG_ADMIN)}
                                    value={watch('rollNumber') || ''}
                                    error={!!errors.rollNumber}
                                    disabled={isProfile || isWatchMode || (!!studentId && currentUser?.role !== Role.ORG_ADMIN)}
                                    icon={Hash}
                                    placeholder="2026-001"
                                    className={isProfile || isWatchMode || (!!studentId && currentUser?.role !== Role.ORG_ADMIN) ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                                />
                                {errors.rollNumber && <p className="mt-1 text-xs text-danger font-semibold">{errors.rollNumber.message}</p>}
                            </div>

                            <div className="space-y-2 md:space-y-3">
                                <Label>Admission Date</Label>
                                <Input
                                    type="date"
                                    {...register('admissionDate')}
                                    onChange={(isProfile || isWatchMode) ? undefined : register('admissionDate').onChange}
                                    readOnly={isProfile || isWatchMode}
                                    value={watch('admissionDate') || ''}
                                    error={!!errors.admissionDate}
                                    disabled={isProfile || isWatchMode}
                                    className={isProfile || isWatchMode ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                                />
                                {errors.admissionDate && <p className="mt-1 text-xs text-danger font-semibold">{errors.admissionDate.message}</p>}
                            </div>

                            <div className="space-y-2 md:space-y-3">
                                <Label>Student Status</Label>
                                <CustomSelect
                                    options={[
                                        { value: StudentStatus.ACTIVE, label: 'Active', icon: ShieldCheck },
                                        { value: StudentStatus.SUSPENDED, label: 'Suspended', icon: UserX },
                                        { value: StudentStatus.ALUMNI, label: 'Alumni', icon: GraduationCap }
                                    ]}
                                    value={formData.status}
                                    onChange={(val) => {
                                        if (isProfile || isWatchMode) return;
                                        setValue('status', val as StudentStatus);
                                        trigger('status');
                                    }}
                                    error={!!errors.status}
                                    disabled={isProfile || isWatchMode}
                                    icon={
                                        formData.status === StudentStatus.ACTIVE ? ShieldCheck :
                                            formData.status === StudentStatus.SUSPENDED ? UserX : GraduationCap
                                    }
                                />
                                {errors.status && <p className="mt-1 text-xs text-danger font-semibold">{errors.status.message}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="space-y-2 md:space-y-3">
                            <Label>Major / Program <span className="text-danger">*</span></Label>
                            <Input
                                type="text"
                                {...register('major')}
                                onChange={(isProfile || isWatchMode) ? undefined : register('major').onChange}
                                readOnly={isProfile || isWatchMode}
                                value={watch('major') || ''}
                                error={!!errors.major}
                                disabled={isProfile || isWatchMode}
                                icon={GraduationCap}
                                placeholder="Computer Science"
                                className={isProfile || isWatchMode ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                            />
                            {errors.major && <p className="mt-1 text-xs text-danger font-semibold">{errors.major.message}</p>}
                        </div>
                        <div className="space-y-2 md:space-y-3">
                            <Label>Department</Label>
                            <Input
                                type="text"
                                {...register('department')}
                                onChange={(isProfile || isWatchMode) ? undefined : register('department').onChange}
                                readOnly={isProfile || isWatchMode}
                                value={watch('department') || ''}
                                error={!!errors.department}
                                disabled={isProfile || isWatchMode}
                                icon={BookOpen}
                                placeholder="Engineering & Tech"
                                className={isProfile || isWatchMode ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                            />
                            {errors.department && <p className="mt-1 text-xs text-danger font-semibold">{errors.department.message}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Academic Placement */}
            <div className="bg-linear-to-br from-card via-card/95 to-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
                <div className="bg-linear-to-r from-primary/5 via-primary/10 to-transparent p-6 md:p-8 border-b border-primary/10">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <div className="relative p-3 bg-linear-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 shadow-lg">
                                <Plus className="w-6 h-6 text-primary" />
                            </div>
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-foreground">Academic Placement</h3>
                    </div>
                </div>

                <div className="p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div className="space-y-2 md:space-y-3">
                            <Label>Enroll in Cohort</Label>
                            <CustomSelect
                                options={[
                                    { label: 'No Cohort', value: '' },
                                    ...(cohortsData?.data?.map((c: Cohort) => ({
                                        value: c.id,
                                        label: `${c.name} (${c.academicCycle?.name || 'No Cycle'})`
                                    })) || [])
                                ]}
                                value={formData.cohortId || ''}
                                onChange={(val) => {
                                    if (isProfile || isWatchMode) return;
                                    setValue('cohortId', val);
                                    trigger('cohortId');
                                }}
                                placeholder="Select a cohort..."
                                error={!!errors.cohortId}
                                disabled={isProfile || isWatchMode}
                                icon={Users}
                            />
                            {errors.cohortId && <p className="mt-1 text-xs text-danger font-semibold">{errors.cohortId.message}</p>}
                        </div>

                        <div className="space-y-2 md:space-y-3">
                            <Label>Enroll in Individual Sections</Label>
                            <CustomMultiSelect
                                options={sections.map(s => ({
                                    value: s.id,
                                    label: `${s.name} ${s.course?.name ? `(${s.course.name})` : ''}`
                                }))}
                                values={formData.sectionIds || []}
                                onChange={(vals) => {
                                    if (isProfile || isWatchMode) return;
                                    setValue('sectionIds', vals);
                                    trigger('sectionIds');
                                }}
                                placeholder="Select one or more sections..."
                                error={!!errors.sectionIds}
                                disabled={isProfile || isWatchMode}
                            />
                            {errors.sectionIds && <p className="mt-1 text-xs text-danger font-semibold">{errors.sectionIds.message}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Billing & Progress */}
            <div className="bg-linear-to-br from-card via-card/95 to-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
                <div className="bg-linear-to-r from-primary/5 via-primary/10 to-transparent p-6 md:p-8 border-b border-primary/10">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <div className="relative p-3 bg-linear-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 shadow-lg">
                                <DollarSign className="w-6 h-6 text-primary" />
                            </div>
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-foreground">Billing & Expected Progress</h3>
                    </div>
                </div>

                <div className="p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        <div className="space-y-2 md:space-y-3">
                            <Label>Annual/Semester Fee <span className="text-danger">*</span></Label>
                            <Input
                                type="number"
                                {...register('fee')}
                                onChange={(isProfile || isWatchMode) ? undefined : register('fee').onChange}
                                readOnly={isProfile || isWatchMode}
                                value={watch('fee') || ''}
                                error={!!errors.fee}
                                disabled={isProfile || isWatchMode}
                                icon={DollarSign}
                                placeholder="12000"
                                className={isProfile || isWatchMode ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                            />
                            {errors.fee && <p className="mt-1 text-xs text-danger font-semibold">{errors.fee.message}</p>}
                        </div>
                        <div className="space-y-2 md:space-y-3">
                            <Label>Fee Plan <span className="text-danger">*</span></Label>
                            <Input
                                type="text"
                                {...register('feePlan')}
                                onChange={(isProfile || isWatchMode) ? undefined : register('feePlan').onChange}
                                readOnly={isProfile || isWatchMode}
                                value={watch('feePlan') || ''}
                                error={!!errors.feePlan}
                                disabled={isProfile || isWatchMode}
                                icon={BookOpen}
                                placeholder="Standard / Installments"
                                className={isProfile || isWatchMode ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                            />
                            {errors.feePlan && <p className="mt-1 text-xs text-danger font-semibold">{errors.feePlan.message}</p>}
                        </div>
                        <div className="space-y-2 md:space-y-3">
                            <Label>Exp. Graduation</Label>
                            <Input
                                type="date"
                                {...register('graduationDate')}
                                onChange={(isProfile || isWatchMode) ? undefined : register('graduationDate').onChange}
                                readOnly={isProfile || isWatchMode}
                                value={watch('graduationDate') || ''}
                                error={!!errors.graduationDate}
                                disabled={isProfile || isWatchMode}
                                className={isProfile || isWatchMode ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                            />
                            {errors.graduationDate && <p className="mt-1 text-xs text-danger font-semibold">{errors.graduationDate.message}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile & Contact */}
            <div className="bg-linear-to-br from-card via-card/95 to-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
                <div className="bg-linear-to-r from-primary/5 via-primary/10 to-transparent p-6 md:p-8 border-b border-primary/10">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <div className="relative p-3 bg-linear-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 shadow-lg">
                                <User className="w-6 h-6 text-primary" />
                            </div>
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-foreground">Personal Profile</h3>
                    </div>
                </div>

                <div className="p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                        <div className="space-y-2 md:space-y-3">
                            <Label>Father / Guardian Name</Label>
                            <Input
                                type="text"
                                {...register('fatherName')}
                                error={!!errors.fatherName}
                                disabled={isWatchMode}
                                icon={User}
                                placeholder="Michael Johnson"
                                className="font-medium"
                            />
                            {errors.fatherName && <p className="mt-1 text-xs text-danger font-semibold">{errors.fatherName.message}</p>}
                        </div>
                        <div className="space-y-2 md:space-y-3">
                            <Label>Current Age</Label>
                            <Input
                                type="number"
                                {...register('age')}
                                error={!!errors.age}
                                disabled={isWatchMode}
                                icon={User}
                                placeholder="16"
                                className="font-medium"
                            />
                            {errors.age && <p className="mt-1 text-xs text-danger font-semibold">{errors.age.message}</p>}
                        </div>
                        <div className="space-y-2 md:space-y-3">
                            <Label>Gender Identification <span className="text-danger">*</span></Label>
                            <CustomSelect
                                options={[
                                    { value: 'Male', label: 'Male' },
                                    { value: 'Female', label: 'Female' },
                                    { value: 'Other', label: 'Other' }
                                ]}
                                value={formData.gender || ''}
                                onChange={(val) => {
                                    if (isProfile || isWatchMode) return;
                                    setValue('gender', val);
                                    trigger('gender');
                                }}
                                error={!!errors.gender}
                                disabled={isProfile || isWatchMode}
                                icon={Users}
                                placeholder="Gender"
                            />
                            {errors.gender && <p className="mt-1 text-xs text-danger font-semibold">{errors.gender.message}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        <div className="space-y-4 md:space-y-6">
                            <div className="space-y-2 md:space-y-3">
                                <Label>Contact Phone</Label>
                                <Input
                                    type="text"
                                    {...register('phone')}
                                    error={!!errors.phone}
                                    disabled={isWatchMode}
                                    icon={Phone}
                                    placeholder="+1 555-0100"
                                    className="font-medium"
                                />
                                {errors.phone && <p className="mt-1 text-xs text-danger font-semibold">{errors.phone.message}</p>}
                            </div>
                            <div className="space-y-2 md:space-y-3">
                                <Label>Emergency Contact</Label>
                                <Input
                                    type="text"
                                    {...register('emergencyContact')}
                                    error={!!errors.emergencyContact}
                                    disabled={isWatchMode}
                                    icon={Phone}
                                    placeholder="Relationship - Phone"
                                    className="font-medium"
                                />
                                {errors.emergencyContact && <p className="mt-1 text-xs text-danger font-semibold">{errors.emergencyContact.message}</p>}
                            </div>
                            <div className="space-y-2 md:space-y-3">
                                <Label>Blood Group</Label>
                                <Input
                                    type="text"
                                    {...register('bloodGroup')}
                                    error={!!errors.bloodGroup}
                                    disabled={isWatchMode}
                                    icon={Plus}
                                    placeholder="A+, B-, etc."
                                    className="font-medium"
                                />
                                {errors.bloodGroup && <p className="mt-1 text-xs text-danger font-semibold">{errors.bloodGroup.message}</p>}
                            </div>
                        </div>

                        <div className="space-y-2 md:space-y-3">
                            <Label>Residential Address</Label>
                            <div>
                                <Textarea
                                    {...register('address')}
                                    disabled={isWatchMode}
                                    error={!!errors.address}
                                    icon={MapPin}
                                    placeholder="123 Education Lane, Learning City"
                                    className="min-h-32 md:min-h-40 font-medium"
                                />
                            </div>
                            {errors.address && <p className="mt-1 text-xs text-danger font-semibold">{errors.address.message}</p>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-6 border-t border-border/50">
                <Button type="button" variant="secondary" onClick={() => router.back()} className="w-full sm:w-auto h-12 font-semibold">
                    {isWatchMode ? 'Go Back' : 'Cancel'}
                </Button>
                {!isWatchMode && (
                    <Button type="submit" loadingId="student-submit" loadingText="Saving..." className="w-full sm:w-auto h-12 font-semibold">
                        {isProfile ? 'Update Profile' : (studentId ? 'Update Student Record' : 'Register Student')}
                    </Button>
                )}
            </div>
        </form>
    );
}
