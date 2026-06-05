'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import ChangePasswordForm from '@/components/ChangePasswordForm';

export default function AdminChangePasswordPage() {
    const router = useRouter();
    const { token, login, user } = useAuth();

    const handleSubmit = async (oldPassword: string, newPassword: string) => {
        if (!token) return;
        const res = await api.auth.changePassword(oldPassword, newPassword, token);
        // This will update the GlobalState and user object
        await login(res.access_token);
    };

    return (
        <div className="flex flex-col w-full max-w-4xl mx-auto">
            <ChangePasswordForm
                title={user?.isFirstLogin ? 'Security Required' : 'Security Settings'}
                description={user?.isFirstLogin
                    ? 'For security reasons, you must change the default super admin password before accessing the dashboard.'
                    : 'Update your super admin administrative password'}
                isRequired={Boolean(user?.isFirstLogin)}
                onSubmit={handleSubmit}
                onSuccess={() => {
                    setTimeout(() => router.push('/admin'), 100);
                }}
            />
        </div>
    );
}
