'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home, Lock, Mail, Phone, User, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { Role } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { FormActions, FormField, FormGrid, FormPageHeader, FormPageShell, FormSection } from '@/components/ui/FormLayout';

export default function AddGuardianPage() {
    const { token, user } = useAuth();
    const router = useRouter();
    const { dispatch } = useGlobal();
    const canAccess = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        address: '',
        relationshipLabel: '',
    });

    const update = (key: keyof typeof form, value: string) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'guardian-create' });
        try {
            await api.org.createGuardian({
                name: form.name.trim(),
                email: form.email.trim(),
                password: form.password,
                phone: form.phone.trim() || undefined,
                address: form.address.trim() || undefined,
                relationshipLabel: form.relationshipLabel.trim() || undefined,
            }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Guardian created successfully.', type: 'success' } });
            router.push('/guardians');
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Failed to create guardian', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'guardian-create' });
        }
    };

    if (!canAccess) {
        return (
            <FormPageShell>
                <EmptyState icon={Users} title="Access restricted" description="Guardian creation is available to Admin and Sub Admin accounts." />
            </FormPageShell>
        );
    }

    return (
        <FormPageShell>
            <FormPageHeader
                title="Add Guardian"
                description="Create a guardian login account. Link students from the student edit form after creation."
                icon={Users}
            />

            <form onSubmit={submit} className="space-y-6">
                <FormSection title="Guardian Account" description="Basic sign-in and contact details." icon={User}>
                    <FormGrid>
                        <FormField label="Full Name">
                            <Input value={form.name} onChange={(event) => update('name', event.target.value)} icon={User} required />
                        </FormField>
                        <FormField label="Email">
                            <Input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} icon={Mail} required />
                        </FormField>
                        <FormField label="Temporary Password">
                            <Input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} icon={Lock} required />
                        </FormField>
                        <FormField label="Phone">
                            <Input value={form.phone} onChange={(event) => update('phone', event.target.value)} icon={Phone} />
                        </FormField>
                        <FormField label="Default Relationship">
                            <Input value={form.relationshipLabel} onChange={(event) => update('relationshipLabel', event.target.value)} icon={Users} placeholder="Father, Mother, Guardian..." />
                        </FormField>
                    </FormGrid>
                    <FormField label="Address">
                        <Textarea value={form.address} onChange={(event) => update('address', event.target.value)} icon={Home} className="min-h-24" />
                    </FormField>
                </FormSection>

                <FormActions
                    onCancel={() => router.push('/guardians')}
                    submitText="Create Guardian"
                    loadingId="guardian-create"
                    title="Create guardian"
                    description="The guardian can sign in after this account is created."
                />
            </form>
        </FormPageShell>
    );
}
