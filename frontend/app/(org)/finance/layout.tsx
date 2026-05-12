'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, ListTree, Receipt, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Role } from '@/types';

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user } = useAuth();

    const isStudentOrTeacher = user?.role === Role.STUDENT || user?.role === Role.TEACHER;

    const tabs = [
        { name: 'Overview', href: '/finance', icon: Wallet, exact: true, hidden: isStudentOrTeacher },
        { name: 'Structures', href: '/finance/structures', icon: ListTree, exact: false, hidden: false },
        { name: 'Entries', href: '/finance/entries', icon: Receipt, exact: false, hidden: false },
        { name: 'Transactions', href: '/finance/transactions', icon: FileText, exact: false, hidden: false },
    ];

    return (
        <div className="flex flex-col h-full bg-theme-bg">
            <div className="bg-card border-b border-border shrink-0 p-4 pb-0 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Wallet className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-card-foreground tracking-tight">Financial Ledger</h1>
                        <p className="text-sm text-muted-foreground font-medium">Manage agreements, billing, and transactions.</p>
                    </div>
                </div>

                {/* Sub Navigation */}
                <div className="flex space-x-1 overflow-x-auto scrollbar-none pt-2">
                    {tabs.filter(t => !t.hidden).map((tab) => {
                        const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
                        return (
                            <Link
                                key={tab.name}
                                href={tab.href}
                                className={`
                                    flex items-center px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap gap-2
                                    ${isActive 
                                        ? 'border-primary text-primary' 
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}
                                `}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.name}
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative">
                {children}
            </div>
        </div>
    );
}
