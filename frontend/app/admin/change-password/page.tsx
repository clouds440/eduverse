'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { ShieldCheck } from 'lucide-react';

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
        <PageShell>
            <PageHeader
                title={user?.isFirstLogin ? 'Security Required' : 'Security Settings'}
                description={user?.isFirstLogin
                    ? 'Change the default administrative password before accessing the dashboard.'
                    : 'Update your administrative password.'}
                icon={ShieldCheck}
                breadcrumbs={[
                    { label: 'Admin' },
                    { label: 'Password' },
                ]}
            />
            <ResourcePanel className="items-center overflow-y-auto p-4 sm:p-6 custom-scrollbar">
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
            </ResourcePanel>
        </PageShell>
    );
}
