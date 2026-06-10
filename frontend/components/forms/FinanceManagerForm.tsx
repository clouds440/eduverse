'use client';

import { api } from '@/lib/api';
import { financeManagerCreateSchema, financeManagerUpdateSchema } from '@/lib/schemas';
import { User } from '@/types';
import RoleAccountForm from '@/components/role-accounts/RoleAccountForm';

interface FinanceManagerFormProps {
    financeManagerId?: string;
    initialData?: User;
}

export default function FinanceManagerForm({ financeManagerId, initialData }: FinanceManagerFormProps) {
    return (
        <RoleAccountForm
            accountId={financeManagerId}
            initialData={initialData}
            label="Finance Manager"
            description="Create a finance-only operator account for ledger, payment claim, and transaction work."
            cacheKeyPrefix="finance-managers"
            createSchema={financeManagerCreateSchema}
            updateSchema={financeManagerUpdateSchema}
            createAccount={api.org.createFinanceManager}
            updateAccount={api.org.updateFinanceManager}
            listHref="/finance-managers"
        />
    );
}
