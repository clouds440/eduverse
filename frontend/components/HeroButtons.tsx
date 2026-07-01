'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { BookOpen, LayoutDashboard, LogOut } from 'lucide-react';
import { getRoleDashboardPath, getRoleLabel } from '@/lib/roles';

export function HeroButtons() {
    const { user, loading, logout } = useAuth();

    if (loading) {
        return <div className="h-12"></div>; // Placeholder to avoid layout shift
    }

    if (user) {
        const dashboardHref = getRoleDashboardPath(user);

        return (
            <div className="flex flex-col items-center justify-center gap-3">
                <div className="inline-flex max-w-full items-center rounded-md border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-sm backdrop-blur-sm">
                    <span className="truncate">
                        Logged in as <span className="text-foreground">{user.name || user.email || getRoleLabel(user.role)}</span>
                    </span>
                </div>
                <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                    <Link
                        href={dashboardHref}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-center font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-primary/80 sm:px-8"
                    >
                        <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span>Go to Your Dashboard</span>
                    </Link>
                    <button
                        type="button"
                        onClick={logout}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card/80 px-6 py-3 text-center font-semibold text-foreground shadow-lg backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-muted/70 sm:px-8"
                    >
                        <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span>Log Out</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
                href="/register"
                className="bg-primary text-white px-8 py-3 text-center rounded-lg font-semibold hover:bg-primary/80 hover:-translate-y-0.5 transition-all shadow-lg"
            >
                Start Free Trial
            </Link>
            <Link
                href="#features"
                className="flex text-center bg-card/80 backdrop-blur-sm text-foreground px-8 py-3 rounded-lg font-semibold border border-border hover:bg-card/80 hover:-translate-y-0.5 transition-all shadow-lg"
            >
                <span className="flex space-x-2 mx-auto">
                    <BookOpen className='w-5 h-5 text-foreground mt-0.5' />
                    <span>
                        Learn More
                    </span>
                </span>
            </Link>
        </div>
    );
}
