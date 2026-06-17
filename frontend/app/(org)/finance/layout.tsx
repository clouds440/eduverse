'use client';

import React, { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, ListTree, Receipt, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Role } from '@/types';
import { PageHeader } from '@/components/ui/PageShell';
import { cn } from '@/lib/utils';
import { FinanceHeaderActionsProvider } from './FinanceHeaderActionsContext';

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user } = useAuth();
    const [headerActions, setHeaderActions] = useState<ReactNode>(null);

    const isStudentOrTeacher = user?.role === Role.STUDENT || user?.role === Role.TEACHER;

    const tabs = [
        { name: 'Overview', href: '/finance', icon: Wallet, exact: true, hidden: isStudentOrTeacher },
        { name: 'Structures', href: '/finance/structures', icon: ListTree, exact: false, hidden: false },
        { name: 'Entries', href: '/finance/entries', icon: Receipt, exact: false, hidden: false },
        { name: 'Transactions', href: '/finance/transactions', icon: FileText, exact: false, hidden: false },
    ];

    return (
        <FinanceHeaderActionsProvider setActions={setHeaderActions}>
            <div className="flex h-full min-h-0 flex-col">
                <div className="shrink-0 space-y-2">
                    <PageHeader
                        title="Financial Ledger"
                        description="Manage agreements, billing, and transactions."
                        icon={Wallet}
                        actions={headerActions}
                    />

                    <nav
                        aria-label="Finance navigation"
                        className="flex gap-1 overflow-x-auto rounded-lg border border-border/70 bg-card/95 p-1 shadow-sm scrollbar-none"
                    >
                        {tabs.filter(t => !t.hidden).map((tab) => {
                            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
                            return (
                                <Link
                                    key={tab.name}
                                    href={tab.href}
                                    className={cn(
                                        'flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-black transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-w-28 sm:px-3',
                                        isActive
                                            ? 'bg-background text-foreground shadow-xs'
                                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                    )}
                                    aria-current={isActive ? 'page' : undefined}
                                >
                                    <tab.icon className="h-4 w-4" />
                                    {tab.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="relative min-h-0 flex-1 overflow-y-auto pt-2 custom-scrollbar">
                    {children}
                </div>
            </div>
        </FinanceHeaderActionsProvider>
    );
}
