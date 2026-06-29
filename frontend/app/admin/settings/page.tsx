'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Settings, Shield } from 'lucide-react';
import { Role } from '@/types';
import SessionManagement from '@/components/SessionManagement';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';

export default function AdminSettingsPage() {
    const { user } = useAuth();
    const router = useRouter();

    // Scroll to section if hash is present
    useEffect(() => {
        const hash = window.location.hash;
        if (hash === '#sessions') {
            const element = document.getElementById('sessions');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, []);

    // Redirect non-admin users
    if (user && user.role !== Role.SUPER_ADMIN && user.role !== Role.PLATFORM_ADMIN) {
        router.push('/');
        return null;
    }

    if (!user) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loading size="md" />
            </div>
        );
    }

    return (
        <PageShell>
            <PageHeader
                title="Admin Settings"
                description="Platform administration and account security controls."
                icon={Settings}
                breadcrumbs={[
                    { label: 'Admin' },
                    { label: 'Settings' },
                ]}
            />

            <ResourcePanel className="overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-foreground">Device Session Management</h2>
                        <p className="text-xs md:text-sm text-muted-foreground font-medium opacity-70">Manage active login sessions across all devices</p>
                    </div>
                </div>

                <div id="sessions">
                    <SessionManagement userId={user.id} />
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
