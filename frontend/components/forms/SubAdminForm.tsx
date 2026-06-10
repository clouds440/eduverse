'use client';

import { api } from '@/lib/api';
import { subAdminCreateSchema, subAdminUpdateSchema } from '@/lib/schemas';
import { User } from '@/types';
import RoleAccountForm from '@/components/role-accounts/RoleAccountForm';

interface SubAdminFormProps {
    subAdminId?: string;
    initialData?: User;
}

export default function SubAdminForm({ subAdminId, initialData }: SubAdminFormProps) {
    return (
        <RoleAccountForm
            accountId={subAdminId}
            initialData={initialData}
            label="Sub Admin"
            description="Create an operational administrator account under the main organization admin."
            cacheKeyPrefix="sub-admins"
            createSchema={subAdminCreateSchema}
            updateSchema={subAdminUpdateSchema}
            createAccount={api.org.createSubAdmin}
            updateAccount={api.org.updateSubAdmin}
            listHref="/sub-admins"
        />
    );
}
