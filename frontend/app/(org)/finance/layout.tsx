'use client';

import React, { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Wallet, ListTree, Receipt, FileText, ScrollText, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Role } from '@/types';
import { PageHeader, PageTabs } from '@/components/ui/PageShell';
import { PageActionsHostProvider } from '@/components/ui/PageActionsHost';
import { FinanceHeaderActionsProvider } from './FinanceHeaderActionsContext';

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user } = useAuth();
    const [headerActions, setHeaderActions] = useState<ReactNode>(null);
    const [tabActions, setTabActions] = useState<ReactNode>(null);

    const isStudentOrTeacher = user?.role === Role.STUDENT || user?.role === Role.TEACHER;

    const tabs = [
        { value: 'overview', label: 'Overview', href: '/finance', icon: Wallet, exact: true, hidden: isStudentOrTeacher },
        { value: 'structures', label: 'Structures', href: '/finance/structures', icon: ListTree, exact: false, hidden: false },
        { value: 'entries', label: 'Entries', href: '/finance/entries', icon: Receipt, exact: false, hidden: false },
        { value: 'transactions', label: 'Transactions', href: '/finance/transactions', icon: FileText, exact: false, hidden: false },
        { value: 'payroll', label: 'Payroll', href: '/finance/payroll', icon: Users, exact: false, hidden: isStudentOrTeacher },
        { value: 'audit', label: 'Audit Logs', href: '/finance/audit-logs', icon: ScrollText, exact: false, hidden: isStudentOrTeacher },
    ] as const;
    const activeTab = tabs.find((tab) => tab.exact ? pathname === tab.href : pathname.startsWith(tab.href))?.value || 'overview';

    const combinedHeaderActions = (
        <>
            {headerActions}
            {tabActions}
        </>
    );

    return (
        <FinanceHeaderActionsProvider setActions={setHeaderActions}>
            <PageActionsHostProvider setActions={setTabActions}>
                <div className="flex h-full min-h-0 flex-col">
                    <div className="shrink-0 space-y-0.5">
                        <PageHeader
                            title="Financial Ledger"
                            description="Manage agreements, billing, and transactions."
                            icon={Wallet}
                            actions={headerActions || tabActions ? combinedHeaderActions : undefined}
                        />

                        <PageTabs
                            ariaLabel="Finance navigation"
                            items={tabs}
                            activeValue={activeTab}
                            size="sm"
                            hideOnScroll
                        />
                    </div>

                    <div className="relative min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                        {children}
                    </div>
                </div>
            </PageActionsHostProvider>
        </FinanceHeaderActionsProvider>
    );
}


