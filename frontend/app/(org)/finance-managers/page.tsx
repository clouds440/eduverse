'use client';

import { api } from '@/lib/api';
import RoleAccountListPage from '@/components/role-accounts/RoleAccountListPage';
import { Role } from '@/types';

export default function FinanceManagersPage() {
    return (
        <RoleAccountListPage
            labelSingular="Finance Manager"
            labelPlural="Finance Managers"
            description="Create and maintain finance-only operator accounts for ledger and payment work."
            routeBase="/finance-managers"
            cacheKeyPrefix="finance-managers"
            pageSizeKey="edu-finance-managers-limit"
            getAccounts={api.org.getFinanceManagers}
            restoreAccount={api.org.restoreFinanceManager}
            deleteAccount={api.org.deleteFinanceManager}
            allowedRoles={[Role.ORG_ADMIN, Role.SUB_ADMIN]}
        />
    );
}
