'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Role } from '@/types';
import { BookOpen } from 'lucide-react';

export function HeroButtons() {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="h-12"></div>; // Placeholder to avoid layout shift
    }

    if (user) {
        return (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                    href={
                        user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN
                            ? '/admin'
                            : user.role === Role.ORG_ADMIN
                                ? '/overview'
                                : user.role === Role.TEACHER || user.role === Role.ORG_MANAGER
                                    ? `/teachers/${user.id}`
                                    : `/students/${user.id}`
                    }
                    className="bg-primary text-white px-8 py-3 text-center rounded-lg font-semibold hover:bg-primary/80 hover:-translate-y-0.5 transition-all shadow-lg"
                >
                    Go to Your Dashboard
                </Link>
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
                className="flex space-x-2 text-center bg-card/80 backdrop-blur-sm text-foreground px-8 py-3 rounded-lg font-semibold border border-border hover:bg-card/80 hover:-translate-y-0.5 transition-all shadow-lg"
            >
                <BookOpen className='w-5 h-5 text-foreground mt-0.5' />
                <span>
                    Learn More
                </span>
            </Link>
        </div>
    );
}
