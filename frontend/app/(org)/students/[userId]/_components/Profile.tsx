'use client';

import { Student } from '@/types';
import StudentForm from '@/components/forms/StudentForm';
import SessionManagement from '@/components/SessionManagement';
import { Settings, UserCircle } from 'lucide-react';

export default function Profile({ profile }: { profile: Student | null }) {
    return (
        <div className="flex flex-col w-full gap-6 md:gap-8">
            {/* Profile Section */}
            <div className="bg-linear-to-br from-card via-card/95 to-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
                {/* Header */}
                <div className="bg-linear-to-r from-primary/5 via-primary/10 to-transparent p-6 md:p-8 border-b border-primary/10">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <div className="relative p-4 bg-linear-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 shadow-lg">
                                <UserCircle className="w-10 h-10 text-primary" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                                Account Settings
                            </h2>
                            <p className="text-sm md:text-base text-muted-foreground font-medium mt-1 flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                Update your personal information and student record details
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 md:p-8">
                    {profile ? (
                        <StudentForm
                            initialData={profile}
                            isProfile={true}
                        />
                    ) : (
                        <div className="py-20 text-center">
                            <div className="text-danger/10 mb-4">
                                <UserCircle className="w-16 h-16 mx-auto" />
                            </div>
                            <p className="text-danger font-semibold">Failed to load profile data</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Session Management */}
            {profile && (
                <div id="sessions">
                    <SessionManagement userId={profile.id} />
                </div>
            )}
        </div>
    );
}
