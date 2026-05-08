'use client';

import { mutate } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, BookOpen, DollarSign, Phone, Plus, ShieldCheck, UserX, CalendarClock, MapPin, UserLock } from 'lucide-react';
import { api } from '@/lib/api';
import { useGlobal } from '@/context/GlobalContext';
import { Section, Teacher, TeacherStatus, Role, CreateTeacherRequest, UpdateTeacherRequest } from '@/types';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { teacherCreateSchema, teacherUpdateSchema, teacherProfileSchema, TeacherCreateFormData, TeacherUpdateFormData, TeacherProfileFormData } from '@/lib/schemas';
import { Toggle } from '@/components/ui/Toggle';
import { Badge } from '../ui/Badge';

interface TeacherFormProps {
    teacherId?: string;
    initialData?: Teacher;
    isProfile?: boolean;
}

export default function TeacherForm({ teacherId, initialData, isProfile }: TeacherFormProps) {
    const { token, user: currentUser, updateUser } = useAuth();
    const router = useRouter();
    const { dispatch } = useGlobal();
    const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);

    const [sections, setSections] = useState<Section[]>([]);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        trigger,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(isProfile ? teacherProfileSchema : (teacherId ? teacherUpdateSchema : teacherCreateSchema)),
        defaultValues: initialData ? {
            name: initialData.user?.name || '',
            phone: initialData.user?.phone || '',
            email: initialData.user?.email || '',
            password: '',
            education: initialData.education || '',
            designation: initialData.designation || '',
            subject: initialData.subject || '',
            salary: initialData.salary?.toString() || '',
            isManager: !!(initialData.user?.role === Role.ORG_MANAGER),
            department: initialData.department || '',
            joiningDate: initialData.joiningDate ? new Date(initialData.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            address: initialData.address || '',
            emergencyContact: initialData.emergencyContact || '',
            bloodGroup: initialData.bloodGroup || '',
            status: initialData.status as TeacherStatus || TeacherStatus.ACTIVE,
            sectionIds: initialData.sections?.map(s => s.id) || []
        } : {
            name: '',
            phone: '',
            email: '',
            password: '',
            education: '',
            designation: '',
            subject: '',
            salary: '',
            isManager: false,
            department: '',
            joiningDate: new Date().toISOString().split('T')[0],
            address: '',
            emergencyContact: '',
            bloodGroup: '',
            status: TeacherStatus.ACTIVE,
            sectionIds: []
        }
    });

    useEffect(() => {
        if (initialData) {
            reset({
                name: initialData.user?.name || '',
                phone: initialData.user?.phone || '',
                email: initialData.user?.email || '',
                password: '',
                education: initialData.education || '',
                designation: initialData.designation || '',
                subject: initialData.subject || '',
                salary: initialData.salary?.toString() || '',
                isManager: !!(initialData.user?.role === Role.ORG_MANAGER),
                department: initialData.department || '',
                joiningDate: initialData.joiningDate ? new Date(initialData.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                address: initialData.address || '',
                emergencyContact: initialData.emergencyContact || '',
                bloodGroup: initialData.bloodGroup || '',
                status: initialData.status as TeacherStatus || TeacherStatus.ACTIVE,
                sectionIds: initialData.sections?.map(s => s.id) || []
            });
        }
    }, [initialData, reset]);

    const formData = watch();

    const onSubmit: SubmitHandler<TeacherCreateFormData | TeacherUpdateFormData | TeacherProfileFormData> = async (data) => {
        dispatch({ type: 'UI_START_PROCESSING', payload: 'teacher-submit' });
        try {
            const { password, salary, ...rest } = data;

            const payload: CreateTeacherRequest | UpdateTeacherRequest = {
                ...rest,
                salary: salary ? Number(salary) : null,
                ...(teacherId ? (password ? { password } : {}) : { password })
            };

            let savedTeacher: Teacher;
            if (isProfile) {
                savedTeacher = await api.org.updateProfile<Teacher>(payload as UpdateTeacherRequest, token!);
            } else if (teacherId) {
                savedTeacher = await api.org.updateTeacher(teacherId, payload as UpdateTeacherRequest, token!);
            } else {
                savedTeacher = await api.org.createTeacher(payload as CreateTeacherRequest, token!);
            }

            // Sync global auth state if the updated teacher is the current user
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
                    // Sync local auth state if the updated user is the current user
                    if (currentUser?.id === savedTeacher.userId) {
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
            dispatch({ type: 'TOAST_ADD', payload: { message: `${isProfile ? 'Profile' : 'Teacher account'} ${teacherId || isProfile ? 'updated' : 'created'} successfully`, type: 'success' } });
            if (isProfile) {
                router.back();
            } else {
                router.push('/teachers');
            }

            // Invalidate all teacher lists (paginated, filtered, etc.)
            mutate(matchesCacheKeyPrefix('teachers'));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to save teacher';

            if (Array.isArray(message)) {
                message.forEach((m: string) => dispatch({ type: 'TOAST_ADD', payload: { message: m, type: 'error' } }));
            } else {
                dispatch({ type: 'TOAST_ADD', payload: { message: message, type: 'error' } });
            }
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'teacher-submit' });
        }
    };

    useEffect(() => {
        if (token) {
            api.org.getSections(token).then(res => setSections(res.data || [])).catch(console.error);
        }
    }, [token]);

    const handlePhotoReady = useCallback((file: File) => {
        setPendingPhoto(file);
    }, []);

    const currentUserAvatarUrl = isProfile ? currentUser?.avatarUrl : '';

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 md:space-y-12" noValidate>
            {/* Mandatory Information */}
            <div className="bg-linear-to-br from-card via-card/95 to-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
                <div className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start mb-8 md:mb-10">
                        <div className="shrink-0 group relative mx-auto md:mx-0">
                            <PhotoUploadPicker
                                onFileReady={handlePhotoReady}
                                type="user"
                                currentImageUrl={initialData?.user?.avatarUrl || currentUserAvatarUrl}
                                updatedAt={initialData?.user?.avatarUpdatedAt}
                            />
                            <p className="mt-3 text-xs text-center font-semibold tracking-wider text-muted-foreground group-hover:text-primary transition-colors">
                                {teacherId ? 'Update Photo' : 'Upload Photo'}
                            </p>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
                            <div className="space-y-2 md:space-y-3">
                                <Label>Full Name</Label>
                                <Input
                                    type="text"
                                    {...register('name')}
                                    onChange={isProfile ? undefined : register('name').onChange}
                                    readOnly={isProfile}
                                    value={watch('name') || ''}
                                    error={!!errors.name}
                                    disabled={isProfile}
                                    icon={User}
                                    placeholder="Dr. Sarah Wilson"
                                    className={isProfile ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                                />
                                {errors.name && <p className="mt-1 text-xs text-danger font-semibold">{errors.name.message}</p>}
                            </div>

                            <div className="space-y-2 md:space-y-3">
                                <Label>Status</Label>
                                <CustomSelect
                                    options={[
                                        { value: TeacherStatus.ACTIVE, label: 'Active', icon: ShieldCheck },
                                        { value: TeacherStatus.SUSPENDED, label: 'Suspended', icon: UserX },
                                        { value: TeacherStatus.ON_LEAVE, label: 'On Leave', icon: CalendarClock },
                                        { value: TeacherStatus.EMERITUS, label: 'Emeritus', icon: UserLock }
                                    ]}
                                    value={formData.status}
                                    onChange={(val) => {
                                        if (isProfile) return;
                                        setValue('status', val as TeacherStatus);
                                        trigger('status');
                                    }}
                                    error={!!errors.status}
                                    disabled={isProfile || (
                                        currentUser?.role === Role.ORG_MANAGER &&
                                        (initialData?.user?.role === Role.ORG_MANAGER || currentUser?.id === initialData?.userId)
                                    )}
                                    icon={
                                        formData.status === TeacherStatus.ACTIVE ? ShieldCheck :
                                            formData.status === TeacherStatus.SUSPENDED ? UserX :
                                                formData.status === TeacherStatus.EMERITUS ? UserLock : CalendarClock
                                    }
                                />
                                {errors.status && <p className="mt-1 text-xs text-danger font-semibold">{errors.status.message}</p>}
                            </div>

                            <div className="space-y-2 md:space-y-3">
                                <Label>Email Address</Label>
                                <Input
                                    type="email"
                                    {...register('email')}
                                    onChange={(!!teacherId || isProfile) ? undefined : register('email').onChange}
                                    readOnly={!!teacherId || isProfile}
                                    value={watch('email') || ''}
                                    error={!!errors.email}
                                    disabled={!!teacherId || isProfile}
                                    icon={Mail}
                                    placeholder="sarah.wilson@school.com"
                                    className={teacherId || isProfile ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                                />
                                {errors.email && <p className="mt-1 text-xs text-danger font-semibold">{errors.email.message}</p>}
                            </div>

                            <div className="space-y-2 md:space-y-3">
                                <Label>Account Password</Label>
                                <Input
                                    type="password"
                                    {...register('password')}
                                    error={!!errors.password}
                                    icon={Lock}
                                    placeholder={teacherId ? "Leave blank to keep current" : "Min 8 chars, 1 upper, 1 lower, 1 num"}
                                    className="font-medium"
                                />
                                {errors.password && <p className="mt-1 text-xs text-danger font-semibold">{errors.password.message}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        <div className="space-y-2 md:space-y-3">
                            <Label>Education / Degree <span className="text-danger">*</span></Label>
                            <Input
                                type="text"
                                {...register('education')}
                                onChange={isProfile ? undefined : register('education').onChange}
                                readOnly={isProfile}
                                value={watch('education') || ''}
                                error={!!errors.education}
                                disabled={isProfile}
                                icon={BookOpen}
                                placeholder="Ph.D. in Computer Science"
                                className={isProfile ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                            />
                            {errors.education && <p className="mt-1 text-xs text-danger font-semibold">{errors.education.message}</p>}
                        </div>
                        <div className="space-y-2 md:space-y-3">
                            <Label>Designation <span className="text-danger">*</span></Label>
                            <Input
                                type="text"
                                {...register('designation')}
                                onChange={isProfile ? undefined : register('designation').onChange}
                                readOnly={isProfile}
                                value={watch('designation') || ''}
                                error={!!errors.designation}
                                disabled={isProfile}
                                icon={User}
                                placeholder="Senior Faculty / HOD"
                                className={isProfile ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                            />
                            {errors.designation && <p className="mt-1 text-xs text-danger font-semibold">{errors.designation.message}</p>}
                        </div>
                        <div className="space-y-2 md:space-y-3">
                            <Label>Subject Expertise <span className="text-danger">*</span></Label>
                            <Input
                                type="text"
                                {...register('subject')}
                                onChange={isProfile ? undefined : register('subject').onChange}
                                readOnly={isProfile}
                                value={watch('subject') || ''}
                                error={!!errors.subject}
                                disabled={isProfile}
                                icon={BookOpen}
                                placeholder="Mathematics / AI / Physics"
                                className={isProfile ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                            />
                            {errors.subject && <p className="mt-1 text-xs text-danger font-semibold">{errors.subject.message}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Workplace & Compensation */}
            <div className="bg-linear-to-br from-card via-card/95 to-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
                <div className="bg-linear-to-r from-primary/5 via-primary/10 to-transparent p-6 md:p-8 border-b border-primary/10">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <div className="relative p-3 bg-linear-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 shadow-lg">
                                <ShieldCheck className="w-6 h-6 text-primary" />
                            </div>
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-foreground">Workplace & Compensation</h3>
                    </div>
                </div>

                <div className="p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        <div className="space-y-2 md:space-y-3">
                            <Label>Monthly Salary <span className="text-danger">*</span></Label>
                            <Input
                                type="number"
                                {...register('salary')}
                                onChange={isProfile ? undefined : register('salary').onChange}
                                readOnly={isProfile}
                                value={watch('salary') || ''}
                                error={!!errors.salary}
                                disabled={isProfile}
                                icon={DollarSign}
                                placeholder="5000"
                                className={isProfile ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                            />
                            {errors.salary && <p className="mt-1 text-xs text-danger font-semibold">{errors.salary.message}</p>}
                        </div>
                        <div className="space-y-2 md:space-y-3">
                            <Label>Department</Label>
                            <Input
                                type="text"
                                {...register('department')}
                                error={!!errors.department}
                                icon={BookOpen}
                                placeholder="Computer Science"
                                className="font-medium"
                            />
                            {errors.department && <p className="mt-1 text-xs text-danger font-semibold">{errors.department.message}</p>}
                        </div>
                        <div className="space-y-2 md:space-y-3">
                            <Label>Joining Date</Label>
                            <Input
                                type="date"
                                {...register('joiningDate')}
                                onChange={isProfile ? undefined : register('joiningDate').onChange}
                                readOnly={isProfile}
                                value={watch('joiningDate') || ''}
                                error={!!errors.joiningDate}
                                disabled={isProfile}
                                className={isProfile ? 'opacity-70 cursor-not-allowed bg-muted/40' : 'font-medium'}
                            />
                            {errors.joiningDate && <p className="mt-1 text-xs text-danger font-semibold">{errors.joiningDate.message}</p>}
                        </div>
                    </div>

                    <div className={`mt-6 md:mt-8 p-4 md:p-5 bg-linear-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all select-none ${currentUser?.role !== Role.ORG_ADMIN ? 'cursor-not-allowed' : 'hover:border-primary/30'}`}>
                        <div className={`flex items-start sm:items-center flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto ${currentUser?.role !== Role.ORG_ADMIN ? 'pointer-events-none opacity-70' : ''}`}>
                            <Toggle
                                checked={formData.isManager}
                                onCheckedChange={(checked) => {
                                    if (currentUser?.role !== Role.ORG_ADMIN) return;
                                    setValue('isManager', checked);
                                    trigger('isManager');
                                }}
                                disabled={currentUser?.role !== Role.ORG_ADMIN}
                                size="lg"
                                label="Administrative Privileges"
                                description="Allow this teacher to manage school settings and users"
                            />
                        </div>
                        {formData.isManager && (
                            <Badge title='' variant='success'>
                                Manager Mode Active
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            {/* Assignments */}
            <div className="bg-linear-to-br from-card via-card/95 to-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
                <div className="bg-linear-to-r from-primary/5 via-primary/10 to-transparent p-6 md:p-8 border-b border-primary/10">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <div className="relative p-3 bg-linear-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 shadow-lg">
                                <Plus className="w-6 h-6 text-primary" />
                            </div>
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-foreground">Section Assignments</h3>
                    </div>
                </div>

                <div className="p-6 md:p-8">
                    <div className="space-y-2 md:space-y-3 max-w-2xl">
                        <Label>Assign to Sections</Label>
                        <CustomMultiSelect
                            options={sections.map(s => ({
                                value: s.id,
                                label: `${s.name} ${s.course?.name ? `(${s.course.name})` : ''}`
                            }))}
                            values={formData.sectionIds || []}
                            onChange={(vals) => {
                                if (isProfile) return;
                                setValue('sectionIds', vals);
                                trigger('sectionIds');
                            }}
                            placeholder="Choose one or more sections..."
                            error={!!errors.sectionIds}
                            disabled={isProfile}
                        />
                        {errors.sectionIds && <p className="mt-1 text-xs text-danger font-semibold">{errors.sectionIds.message}</p>}
                        <p className="text-xs text-muted-foreground font-medium pt-2">
                            Teacher will be able to manage students and grading for selected sections.
                        </p>
                    </div>
                </div>
            </div>

            {/* Personal Details */}
            <div className="bg-linear-to-br from-card via-card/95 to-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
                <div className="bg-linear-to-r from-primary/5 via-primary/10 to-transparent p-6 md:p-8 border-b border-primary/10">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <div className="relative p-3 bg-linear-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 shadow-lg">
                                <User className="w-6 h-6 text-primary" />
                            </div>
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-foreground">Personal Details</h3>
                    </div>
                </div>

                <div className="p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        <div className="space-y-4 md:space-y-6">
                            <div className="space-y-2 md:space-y-3">
                                <Label>Contact Phone <span className="text-danger">*</span></Label>
                                <Input
                                    type="text"
                                    {...register('phone')}
                                    error={!!errors.phone}
                                    icon={Phone}
                                    placeholder="+1 555-0123"
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
                                    icon={Phone}
                                    placeholder="Name - Relation - Phone"
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
                                    icon={Plus}
                                    placeholder="O+, A-, etc."
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
                    Cancel
                </Button>
                <Button type="submit" loadingId="teacher-submit" loadingText="Saving..." className="w-full sm:w-auto h-12 font-semibold">
                    {isProfile ? 'Update Profile' : (teacherId ? 'Update Faculty Member' : 'Create Faculty Account')}
                </Button>
            </div>
        </form>
    );
}
