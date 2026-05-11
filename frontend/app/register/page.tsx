'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { School, MapPin, Building, Mail, Lock, Phone, BookOpen, GraduationCap, Library, MonitorPlay, Pencil } from 'lucide-react';
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

            // 1. Register the org
            await api.auth.register(payload);

            // 2. Logo upload (optional, post-auth)
            if (pendingLogoFile) {
                try {
                    const loginRes = await api.auth.login({ email: data.email, password: data.password });
                    if (loginRes.access_token) {
                        await api.org.uploadLogo(pendingLogoFile, loginRes.access_token);
                    }
                } catch {
                    dispatch({ type: 'TOAST_ADD', payload: { message: 'Account created! Logo upload failed — you can add it from Settings.', type: 'info' } });
                }
            }

            dispatch({ type: 'TOAST_ADD', payload: { message: 'Registration successful! Please wait for approval.', type: 'success' } });
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
        <div className="flex min-h-full h-screen bg-background overflow-hidden font-sans">
            {/* Left Column: Vision & Branding (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-[40%] xl:w-[35%] relative flex-col items-center justify-center p-12 overflow-hidden bg-linear-to-br from-primary/5 via-background to-secondary/5">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/30 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/30 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 rounded-full mix-blend-screen filter blur-2xl opacity-10"></div>

                <div className="relative z-10 w-full max-w-sm space-y-16 animate-in fade-in slide-in-from-left duration-1000">
                    <div className="space-y-6">
                        <div className="relative inline-block">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <h1 className="relative text-4xl xl:text-5xl font-black text-foreground leading-[1.1] tracking-tight">
                                Grow your <br />
                                <span className="text-primary">Community.</span>
                            </h1>
                        </div>
                        <p className="text-base text-muted-foreground font-medium leading-relaxed">
                            Join hundreds of modern educational institutions managing their future with {PLATFORM_NAME}.
                        </p>
                    </div>

                    <div className="relative w-full aspect-square drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                        <div className="absolute inset-0 bg-linear-to-br from-primary/10 to-secondary/10 rounded-3xl blur-3xl animate-pulse" />
                        <Image
                            src="/assets/eduverse.png"
                            alt="Growth Illustration"
                            fill
                            className="object-contain dark:invert relative z-10"
                            sizes="(max-width: 1024px) 0px, 24rem"
                        />
                    </div>
                </div>
            </div>

            {/* Right Column: Registration Form */}
            <div className="w-full lg:w-[60%] xl:w-[65%] min-h-screen lg:h-auto flex items-center justify-center px-4 sm:px-12 md:px-16 py-10 sm:py-12 md:py-16 bg-linear-to-br from-background via-background to-secondary/5 relative overflow-y-auto custom-scrollbar animate-in fade-in duration-700">
                {/* Decorative elements */}
                <div className="absolute top-20 right-20 w-64 h-64 bg-primary/10 rounded-full mix-blend-screen filter blur-3xl opacity-20 hidden sm:block"></div>
                <div className="absolute bottom-20 left-20 w-64 h-64 bg-secondary/10 rounded-full mix-blend-screen filter blur-3xl opacity-20 hidden sm:block"></div>

                <div className="w-full max-w-2xl relative h-full z-10">
                    <div className="flex flex-col space-y-3 mb-10">
                        <h2 className="text-4xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
                            Register Organization
                        </h2>
                        <p className="text-sm md:text-base text-muted-foreground font-medium tracking-tight">
                            Start your digital transformation journey today with {PLATFORM_NAME}. Already have an account?{' '}
                            <Link href="/login" className="text-primary font-semibold hover:text-primary/80 underline underline-offset-4 decoration-2">
                                Sign in
                            </Link>
                        </p>
                    </div>

                    <form className="space-y-8 md:space-y-10" onSubmit={handleSubmit(onSubmit)} noValidate>
                        {/* Logo & Core Info Section */}
                        <div className="bg-linear-to-br from-muted/50 via-muted/30 to-muted/50 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-border/50 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10 shadow-lg">
                            <div className="flex flex-col items-center shrink-0">
                                <Label className="text-xs font-semibold tracking-wider text-muted-foreground mb-4 block">Organization Logo</Label>
                                <PhotoUploadPicker
                                    onFileReady={handleLogoReady}
                                    type="org"
                                    hint="Square PNG/JPG, max 5MB"
                                />
                            </div>

                            <div className="flex-1 w-full space-y-4 md:space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-xs font-semibold tracking-wider text-muted-foreground ml-1 opacity-70">Official School Name</Label>
                                    <Input
                                        id="name"
                                        {...register('name')}
                                        error={!!errors.name}
                                        icon={School}
                                        placeholder="EduPulse Academy"
                                        className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                                    />
                                    {errors.name && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.name.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="adminName" className="text-xs font-semibold tracking-wider text-muted-foreground ml-1 opacity-70">Administrator Full Name</Label>
                                    <Input
                                        id="adminName"
                                        {...register('adminName')}
                                        error={!!errors.adminName}
                                        icon={BookOpen}
                                        placeholder="John Doe"
                                        className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                                    />
                                    {errors.adminName && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.adminName.message}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Metadata Grid */}
                        <div className="space-y-6 md:space-y-8 px-2 md:px-4">
                            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground border-l-4 border-primary/50 pl-4">Metadata & Location</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                <div className="space-y-2">
                                    <Label htmlFor="type" className="text-xs font-semibold tracking-wider text-muted-foreground ml-1 opacity-70">Category</Label>
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
                                        placeholder="Select Type"
                                        className="h-12 md:h-14 font-medium border-border/50"
                                    />
                                    {errors.type && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.type.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="location" className="text-xs font-semibold tracking-wider text-muted-foreground ml-1 opacity-70">Location</Label>
                                    <Input
                                        id="location"
                                        {...register('location')}
                                        error={!!errors.location}
                                        icon={MapPin}
                                        placeholder="New York, USA"
                                        className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                                    />
                                    {errors.location && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.location.message}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Security & Access Section */}
                        <div className="space-y-6 md:space-y-8 px-2 md:px-4">
                            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground border-l-4 border-primary/50 pl-4">Security & Access</h3>

                            <div className="space-y-4 md:space-y-8">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-xs font-semibold tracking-wider text-muted-foreground ml-1 opacity-70">Admin Login Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        {...register('email')}
                                        error={!!errors.email}
                                        icon={Mail}
                                        placeholder="admin@school.com"
                                        className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                                    />
                                    {errors.email && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.email.message}</p>}
                                    <p className="mt-3 text-xs text-muted-foreground font-medium tracking-wider ml-1 opacity-60">
                                        Primary credentials used for administrator console access.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between ml-1">
                                        <Label htmlFor="contactEmail" className="text-xs font-semibold tracking-wider text-muted-foreground opacity-70">Public Contact Email</Label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next = !sameAsLoginEmail;
                                                setSameAsLoginEmail(next);
                                                if (next) {
                                                    setValue('contactEmail', formData.email);
                                                    trigger('contactEmail');
                                                }
                                            }}
                                            className="text-xs font-semibold tracking-wider text-primary hover:text-primary/80 transition-all"
                                        >
                                            {sameAsLoginEmail ? 'Different email' : 'Sync with Login'}
                                        </button>
                                    </div>
                                    <Input
                                        id="contactEmail"
                                        type="email"
                                        {...register('contactEmail')}
                                        error={!!errors.contactEmail}
                                        disabled={sameAsLoginEmail}
                                        icon={Mail}
                                        placeholder="info@school.com"
                                        className={`h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm ${sameAsLoginEmail ? 'bg-muted/40 opacity-50 grayscale pointer-events-none' : ''}`}
                                    />
                                    {errors.contactEmail && !sameAsLoginEmail && (
                                        <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.contactEmail.message}</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                    <div className="space-y-2">
                                        <Label htmlFor="phone" className="text-xs font-semibold tracking-wider text-muted-foreground ml-1 opacity-70">Phone Number</Label>
                                        <Input
                                            id="phone"
                                            {...register('phone')}
                                            error={!!errors.phone}
                                            icon={Phone}
                                            placeholder="+1 (555) 000-0000"
                                            className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                                        />
                                        {errors.phone && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.phone.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-xs font-semibold tracking-wider text-muted-foreground ml-1 opacity-70">Login Password</Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            {...register('password')}
                                            error={!!errors.password}
                                            icon={Lock}
                                            placeholder="••••••••"
                                            className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                                        />
                                        {errors.password && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.password.message}</p>}
                                        <PasswordStrength password={formData.password} className="mt-3 px-1" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 pb-44 mb-10">
                            <Button
                                type="submit"
                                loadingId="register-submit"
                                className="w-full h-12 md:h-14 font-semibold shadow-lg hover:shadow-xl transition-shadow"
                                loadingText="Creating account..."
                            >
                                Create Organization Account
                            </Button>
                            <p className="mt-6 text-center text-xs text-muted-foreground font-medium tracking-wider leading-relaxed max-w-sm mx-auto">
                                By registering, you agree to our <Link href="/terms" className="text-muted-foreground hover:text-primary underline">Terms of Service</Link> and <Link href="/privacy" className="text-muted-foreground hover:text-primary underline">Privacy Policy</Link>.
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
