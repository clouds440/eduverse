'use client';

import { Student } from '@/types';
import StudentForm from '@/components/forms/StudentForm';
import SessionManagement from '@/components/SessionManagement';
import { UserCircle } from 'lucide-react';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';

export default function Profile({ profile }: { profile: Student | null }) {
    return (
        <FormPageShell>
            <FormPageHeader
                title="Account Settings"
                description="Update your personal information and student record details."
                icon={UserCircle}
            />

            {profile ? (
                <StudentForm
                    initialData={profile}
                    isProfile={true}
                />
            ) : (
                <div className="rounded-lg border border-border/70 bg-card/90 px-6 py-16 text-center shadow-sm">
                    <div className="mb-4 text-danger/20">
                        <UserCircle className="mx-auto h-16 w-16" />
                    </div>
                    <p className="font-semibold text-danger">Failed to load profile data</p>
                </div>
            )}

            {/* Session Management */}
            {profile && (
                <div id="sessions">
                    <SessionManagement userId={profile.id} />
                </div>
            )}
        </FormPageShell>
    );
}
