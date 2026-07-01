'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import { Role } from '@/types';

export default function OrganizationChangePasswordPage() {
    const router = useRouter();
    const { token, login, user } = useAuth();

    const handleSubmit = async (oldPassword: string, newPassword: string) => {
        if (!token) return;
        const res = await api.auth.changePassword(oldPassword, newPassword, token);
        await login(res.access_token);
    };

    return (
        <div className="flex flex-1 flex-col p-4 md:p-8 max-w-7xl mx-auto w-full">
            <div className="flex flex-1 items-center justify-center">
                <ChangePasswordForm
                    title={user?.isFirstLogin ? 'Security Required' : 'Change Password'}
                    description={
                        user?.isFirstLogin
                            ? 'Create a private password before using the dashboard.'
                            : (user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN || user?.role === Role.ORG_MANAGER || user?.role === Role.FINANCE_MANAGER)
                            ? `Update administrative password for ${user?.name || 'Organization'}`
                            : user?.role === Role.TEACHER
                                ? `Update teacher portal password for ${user?.name || 'User'}`
                                : user?.role === Role.GUARDIAN
                                    ? `Update guardian portal password for ${user?.name || 'User'}`
                                : `Update student portal password for ${user?.name || 'User'}`
                    }
                    isRequired={Boolean(user?.isFirstLogin)}
                    onSubmit={handleSubmit}
                    onSuccess={() => {
                        // Small delay to allow AuthContext state to sync with the new token
                        setTimeout(() => {
                            if (!user || !user.userName) {
                                router.push('/');
                                return;
                            }
    
                            const target = user.role === Role.ORG_ADMIN
                                ? '/settings'
                                : user.role === Role.SUB_ADMIN
                                    ? '/overview'
                                : user.role === Role.FINANCE_MANAGER
                                    ? '/finance'
                                : user.role === Role.STUDENT
                                    ? `/student/${user.id}`
                                : user.role === Role.GUARDIAN
                                    ? '/guardian'
                                    : `/teacher/${user.id}`;
                            router.push(target);
                        }, 100);
                    }}
                />
            </div>
        </div>
    );
}
