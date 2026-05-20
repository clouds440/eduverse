'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { School, MapPin, Building, Mail, Lock, Phone, BookOpen, GraduationCap, Library, MonitorPlay, Pencil, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { RegisterRequest, OrganizationType, ApiError } from '@/types';
import { Input } from '@/components/ui/Input';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import PasswordStrength from '@/components/ui/PasswordStrength';
import { useGlobal } from '@/context/GlobalContext';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormData } from '@/lib/schemas';
import { PLATFORM_NAME } from '@/lib/constants';
import Image from 'next/image';
import { getDeviceId, getDeviceInfo } from '@/lib/deviceUtils';

export default function RegisterPage() {
    const router = useRouter();
    const { state, dispatch } = useGlobal();
    const [sameAsLoginEmail, setSameAsLoginEmail] = useState(false);
    const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        trigger,
        setError,
        formState: { errors },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            name: '',
            adminName: '',
            location: '',
            type: OrganizationType.HIGH_SCHOOL,
            email: '',
            contactEmail: '',
            phone: '',
            password: '',
        }
    });

    const formData = watch();

    useEffect(() => {
        if (sameAsLoginEmail) {
            setValue('contactEmail', formData.email);
            if (errors.contactEmail) trigger('contactEmail');
        }
    }, [formData.email, sameAsLoginEmail, setValue, trigger, errors.contactEmail]);

    const onSubmit: SubmitHandler<RegisterFormData> = async (data) => {
        if (state.ui.processing['register-submit']) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'register-submit' });
        try {
            const payload: RegisterRequest = {
                ...data,
                contactEmail: sameAsLoginEmail ? data.email : (data.contactEmail || data.email),
            };

            await api.auth.register(payload);

            let tempToken: string | undefined;
            if (pendingLogoFile) {
                try {
                    const deviceId = getDeviceId();
                    const deviceInfo = getDeviceInfo();
                    const loginRes = await api.auth.login({
                        email: data.email,
                        password: data.password,
                        deviceId,
                        deviceName: deviceInfo?.deviceName,
                        deviceType: deviceInfo?.deviceType,
                        browser: deviceInfo?.browser,
                        os: deviceInfo?.os,
                    });
                    tempToken = loginRes.access_token;
                    if (tempToken) {
                        await api.org.uploadLogo(pendingLogoFile, tempToken);
                    }
                } catch {
                    dispatch({ type: 'TOAST_ADD', payload: { message: 'Account created! Logo upload failed — you can add it from Settings.', type: 'info' } });
                } finally {
                    if (tempToken) {
                        await api.auth.logout(tempToken);
                    }
                }
            }

            dispatch({ type: 'TOAST_ADD', payload: { message: 'Registration successful! Please verify your contact email.', type: 'success' } });
            router.push('/login');
        } catch (error: unknown) {
            const apiError = error as ApiError;
            const message = (apiError?.response?.data?.message || (error instanceof Error ? error.message : 'Registration failed'));

            if (Array.isArray(message)) {
                message.forEach((m: string) => {
                    const msg = m.toLowerCase();
                    if (msg.includes('email')) setError('email', { message: m });
                    else if (msg.includes('name')) setError('name', { message: m });
                    else if (msg.includes('adminname')) setError('adminName', { message: m });
                    else if (msg.includes('password')) setError('password', { message: m });
                    else dispatch({ type: 'TOAST_ADD', payload: { message: m, type: 'error' } });
                });
            } else {
                const msg = String(message).toLowerCase();
                if (msg.includes('email')) setError('email', { message: String(message) });
                else if (msg.includes('name')) setError('name', { message: String(message) });
                else dispatch({ type: 'TOAST_ADD', payload: { message: String(message), type: 'error' } });
            }
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'register-submit' });
        }
    };

    const handleLogoReady = useCallback((file: File) => {
        setPendingLogoFile(file);
    }, []);

    return (
        <div className="min-h-fit h-screen bg-background py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-6 relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-background">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/8 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-primary/6 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '4s' }} />
            </div>

            {/* Grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[64px_64px]" />

            {/* Main content */}
            <div className="relative z-10 max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-3 sm:mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2">
                        <Image 
                            src={'/assets/eduverse-icon.png'}
                            alt='Eduverse Logo'
                            className="object-cover"
                            width={64}
                            height={64}
                        />
                    </div>
                    <h1 className="text-3xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight mb-3">
                        Create Your Organization
                    </h1>
                    <p className="text-muted-foreground font-medium text-sm sm:text-base max-w-xl mx-auto">
                        Start your digital transformation journey with {PLATFORM_NAME}. <br /> Already have an account?{' '}
                        <Link href="/login" className="text-primary font-bold hover:text-primary/80 transition-colors">
                            Sign in
                        </Link>
                    </p>
                </div>

                {/* Form */}
                <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Logo & Core Info Section */}
                        <div className="flex flex-col gap-6">
                            <div className="glass-card rounded-3xl p-6 sm:p-8 shadow-xl">
                                <div className="flex flex-col lg:flex-row items-start gap-4 lg:gap-6">
                                    <div className="flex flex-col items-center shrink-0 w-full lg:w-auto">
                                        <Label className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-4 block text-center">Logo</Label>
                                        <PhotoUploadPicker
                                            onFileReady={handleLogoReady}
                                            type="org"
                                            hint="Square PNG/JPG"
                                        />
                                    </div>

                                    <div className="flex-1 w-full space-y-5">
                                        <div className="space-y-2">
                                            <Label htmlFor="name" className="text-xs font-bold tracking-wider text-muted-foreground uppercase ml-1">School Name</Label>
                                            <Input
                                                id="name"
                                                {...register('name')}
                                                error={!!errors.name}
                                                icon={School}
                                                placeholder="EduPulse Academy"
                                                className="h-12 font-medium border-border/40 bg-background/60 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                            />
                                            {errors.name && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.name.message}</p>}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="adminName" className="text-xs font-bold tracking-wider text-muted-foreground uppercase ml-1">Admin Name</Label>
                                            <Input
                                                id="adminName"
                                                {...register('adminName')}
                                                error={!!errors.adminName}
                                                icon={BookOpen}
                                                placeholder="John Doe"
                                                className="h-12 font-medium border-border/40 bg-background/60 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                            />
                                            {errors.adminName && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.adminName.message}</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Metadata Section */}
                            <div className="glass-card h-full rounded-3xl p-6 sm:p-8 shadow-xl">
                                <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase border-l-4 border-primary/50 pl-4 mb-6">Organization Details</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="type" className="text-xs font-bold tracking-wider text-muted-foreground uppercase ml-1">Type</Label>
                                        <CustomSelect
                                            options={[
                                                { value: OrganizationType.KINDERGARTEN, label: 'Kindergarten', icon: Pencil },
                                                { value: OrganizationType.PRE_SCHOOL, label: 'Pre-School', icon: Pencil },
                                                { value: OrganizationType.PRIMARY_SCHOOL, label: 'Primary School', icon: BookOpen },
                                                { value: OrganizationType.MIDDLE_SCHOOL, label: 'Middle School', icon: BookOpen },
                                                { value: OrganizationType.HIGH_SCHOOL, label: 'High School', icon: School },
                                                { value: OrganizationType.COLLEGE, label: 'College', icon: Library },
                                                { value: OrganizationType.UNIVERSITY, label: 'University', icon: GraduationCap },
                                                { value: OrganizationType.VOCATIONAL_SCHOOL, label: 'Vocational School', icon: Building },
                                                { value: OrganizationType.INSTITUTE, label: 'Institute', icon: Building },
                                                { value: OrganizationType.ACADEMY, label: 'Academy', icon: Building },
                                                { value: OrganizationType.TUTORING_CENTER, label: 'Tutoring Center', icon: BookOpen },
                                                { value: OrganizationType.ONLINE_SCHOOL, label: 'Online School', icon: MonitorPlay },
                                                { value: OrganizationType.OTHER, label: 'Other', icon: Building },
                                            ]}
                                            value={formData.type}
                                            onChange={(val) => {
                                                setValue('type', val as OrganizationType);
                                                trigger('type');
                                            }}
                                            error={!!errors.type}
                                            placeholder="Select type"
                                            className="h-12 font-medium border-border/40"
                                        />
                                        {errors.type && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.type.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="location" className="text-xs font-bold tracking-wider text-muted-foreground uppercase ml-1">Location</Label>
                                        <Input
                                            id="location"
                                            {...register('location')}
                                            error={!!errors.location}
                                            icon={MapPin}
                                            placeholder="New York, USA"
                                            className="h-12 font-medium border-border/40 bg-background/60 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                        {errors.location && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.location.message}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Security Section */}
                        <div className="glass-card rounded-3xl p-6 sm:p-8 shadow-xl">
                            <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase border-l-4 border-primary/50 pl-4 mb-6">Security & Access</h3>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-xs font-bold tracking-wider text-muted-foreground uppercase ml-1">Admin Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        {...register('email')}
                                        error={!!errors.email}
                                        icon={Mail}
                                        placeholder="admin@school.com"
                                        className="h-12 font-medium border-border/40 bg-background/60 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                    />
                                    {errors.email && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.email.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between ml-1 gap-3">
                                        <Label htmlFor="contactEmail" className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Contact Email</Label>
                                        <label className="flex items-center gap-2 text-xs font-semibold text-primary cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-border accent-primary"
                                                checked={sameAsLoginEmail}
                                                onChange={(event) => {
                                                    const next = event.target.checked;
                                                    setSameAsLoginEmail(next);
                                                    if (next) {
                                                        setValue('contactEmail', formData.email);
                                                        trigger('contactEmail');
                                                    }
                                                }}
                                            />
                                            Use same as login email
                                        </label>
                                    </div>
                                    <Input
                                        id="contactEmail"
                                        type="email"
                                        {...register('contactEmail')}
                                        error={!!errors.contactEmail}
                                        disabled={sameAsLoginEmail}
                                        icon={Mail}
                                        placeholder="info@school.com"
                                        className={`h-12 font-medium border-border/40 bg-background/60 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all ${sameAsLoginEmail ? 'bg-muted/40 opacity-50 grayscale pointer-events-none' : ''}`}
                                    />
                                    {errors.contactEmail && !sameAsLoginEmail && (
                                        <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.contactEmail.message}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground font-medium ml-1">
                                        {sameAsLoginEmail
                                            ? 'This email will also be used for account recovery.'
                                            : 'Used for important organization notifications, password recovery, and security-related communication.'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="phone" className="text-xs font-bold tracking-wider text-muted-foreground uppercase ml-1">Phone</Label>
                                        <Input
                                            id="phone"
                                            {...register('phone')}
                                            error={!!errors.phone}
                                            icon={Phone}
                                            placeholder="+1 (555) 000-0000"
                                            className="h-12 font-medium border-border/40 bg-background/60 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                        {errors.phone && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.phone.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-xs font-bold tracking-wider text-muted-foreground uppercase ml-1">Password</Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            {...register('password')}
                                            error={!!errors.password}
                                            icon={Lock}
                                            placeholder="••••••••"
                                            className="h-12 font-medium border-border/40 bg-background/60 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                        {errors.password && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.password.message}</p>}
                                        <PasswordStrength password={formData.password} className="mt-2 px-1" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="space-y-4 items-center justify-center flex flex-col">
                        <Button
                            type="submit"
                            loadingId="register-submit"
                            icon={ArrowRight}
                            className="w-auto"
                            loadingText="Creating account..."
                        >
                            Create Organization
                        </Button>
                        <p className="text-center text-xs text-muted-foreground font-medium">
                            By registering, you agree to our <Link href="/terms" className="text-muted-foreground hover:text-primary underline">Terms</Link> and <Link href="/privacy" className="text-muted-foreground hover:text-primary underline">Privacy Policy</Link>.
                        </p>
                    </div>
                </form>

                {/* Footer */}
                <div className="text-center mt-12">
                    <p className="text-xs text-muted-foreground/60 font-medium">
                        © {new Date().getFullYear()} {PLATFORM_NAME}. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
}
