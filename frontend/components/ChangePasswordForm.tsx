'use client';

import { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { useGlobal } from '@/context/GlobalContext';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import PasswordStrength from '@/components/ui/PasswordStrength';

interface ChangePasswordFormProps {
    title?: string;
    description?: string;
    onSubmit: (oldPassword: string, newPassword: string) => Promise<void>;
    onSuccess?: () => void;
}

export default function ChangePasswordForm({
    title = 'Change Password',
    description = 'Update your account password.',
    onSubmit,
    onSuccess
}: ChangePasswordFormProps) {
    const { dispatch } = useGlobal();

    const [formData, setFormData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [errors, setErrors] = useState<{ oldPassword?: string; newPassword?: string; confirmPassword?: string }>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        let hasError = false;
        const newErrors: typeof errors = {};

        if (formData.newPassword !== formData.confirmPassword) {
            newErrors.confirmPassword = 'New passwords do not match';
            hasError = true;
        }

        if (formData.newPassword.length < 8) {
            newErrors.newPassword = 'Password must be at least 8 characters long';
            hasError = true;
        }

        if (hasError) {
            setErrors(newErrors);
            return;
        }

        dispatch({ type: 'UI_START_PROCESSING', payload: 'password-change-submit' });
        try {
            await onSubmit(formData.oldPassword, formData.newPassword);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Password changed successfully', type: 'success' } });
            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Failed to change password';
            if (message.toLowerCase().includes('old password') || message.toLowerCase().includes('current password')) {
                setErrors({ oldPassword: message });
            } else {
                dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            }
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'password-change-submit' });
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="w-full max-w-lg space-y-8 bg-linear-to-br from-card/80 via-card/60 to-card/80 backdrop-blur-xl p-8 md:p-12 rounded-2xl shadow-2xl border border-border/50 relative z-10 mx-auto transition-all duration-500">
            <div className="text-center">
                <div className="relative mx-auto w-20 h-20 mb-8">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                    <div className="relative w-full h-full bg-linear-to-br from-primary/10 to-primary/5 rounded-full flex items-center justify-center border border-primary/20 shadow-lg">
                        <ShieldCheck className="w-10 h-10 text-primary" />
                    </div>
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight mb-4">
                    {title}
                </h2>
                <p className="text-muted-foreground font-medium text-base md:text-lg">
                    {description}
                </p>
            </div>

            <form className="mt-8 space-y-5 md:space-y-6" onSubmit={handleSubmit} noValidate>
                <div className="space-y-4 md:space-y-5">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold tracking-wider text-muted-foreground opacity-70">Current Password</Label>
                        <Input
                            name="oldPassword"
                            type="password"
                            required
                            placeholder="••••••••"
                            icon={Lock}
                            value={formData.oldPassword}
                            onChange={handleChange}
                            error={!!errors.oldPassword}
                            tabIndex={1}
                            className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                        />
                        {errors.oldPassword && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.oldPassword}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold tracking-wider text-muted-foreground opacity-70">New Password</Label>
                        <Input
                            name="newPassword"
                            type="password"
                            required
                            placeholder="••••••••"
                            icon={Lock}
                            value={formData.newPassword}
                            onChange={handleChange}
                            error={!!errors.newPassword}
                            tabIndex={2}
                            className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                        />
                        {errors.newPassword && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.newPassword}</p>}
                        <PasswordStrength password={formData.newPassword} className="mt-3 px-1" />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold tracking-wider text-muted-foreground opacity-70">Confirm New Password</Label>
                        <Input
                            name="confirmPassword"
                            type="password"
                            required
                            placeholder="••••••••"
                            icon={Lock}
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            error={!!errors.confirmPassword}
                            tabIndex={3}
                            className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                        />
                        {errors.confirmPassword && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.confirmPassword}</p>}
                    </div>
                </div>

                <div>
                    <Button type="submit" loadingId="password-change-submit" loadingText="CHANGING..." className="w-full h-12 md:h-14 font-semibold shadow-lg hover:shadow-xl transition-shadow">
                        Change Password
                    </Button>
                </div>
            </form>
        </div>
    );
}
