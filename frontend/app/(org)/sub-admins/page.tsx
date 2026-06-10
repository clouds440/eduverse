'use client';

import { api } from '@/lib/api';
import RoleAccountListPage from '@/components/role-accounts/RoleAccountListPage';

export default function SubAdminsPage() {
    return (
        <RoleAccountListPage
            labelSingular="Sub Admin"
            labelPlural="Sub Admins"
            description="Create and maintain operational administrator accounts for this organization."
            routeBase="/sub-admins"
            cacheKeyPrefix="sub-admins"
            pageSizeKey="edu-sub-admins-limit"
            getAccounts={api.org.getSubAdmins}
            restoreAccount={api.org.restoreSubAdmin}
            deleteAccount={api.org.deleteSubAdmin}
        />
    );
}
