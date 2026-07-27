'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Mail, Save, UserCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    FormField,
    FormGrid,
    FORM_INPUT_CLASS,
    FORM_READONLY_INPUT_CLASS,
} from '@/components/ui/FormLayout';
import { SettingsSection } from '../SettingsSection';

export function AdminProfileSettingsTab() {
    const { token, user, updateUser } = useAuth();
    const { dispatch } = useGlobal();
    const [name, setName] = useState(user?.name || '');
    const [error, setError] = useState<string>();

    useEffect(() => {
        setName(user?.name || '');
    }, [user?.name]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token || !user) return;

        const trimmedName = name.trim();
        if (!trimmedName) {
            setError('Full name is required');
            return;
        }

        dispatch({ type: 'UI_START_PROCESSING', payload: 'admin-profile-submit' });
        try {
            await api.auth.updateProfile({ name: trimmedName }, token);
            updateUser({ name: trimmedName });
            setError(undefined);
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: 'Profile updated successfully', type: 'success' },
            });
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'Failed to update profile';
            setError(message);
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'admin-profile-submit' });
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate>
            <SettingsSection
                icon={UserCircle}
                title="Profile"
                description="Basic identity for your platform administrator account."
                action={
                    <Button
                        type="submit"
                        icon={Save}
                        loadingId="admin-profile-submit"
                        className="h-10 px-4 text-xs"
                    >
                        Save Profile
                    </Button>
                }
            >
                <FormGrid>
                    <FormField label="Full Name" required error={error}>
                        <Input
                            type="text"
                            value={name}
                            onChange={(event) => {
                                setName(event.target.value);
                                setError(undefined);
                            }}
                            error={!!error}
                            icon={UserCircle}
                            placeholder="Platform admin"
                            className={FORM_INPUT_CLASS}
                        />
                    </FormField>

                    <FormField label="Email Address">
                        <Input
                            type="email"
                            value={user?.email || ''}
                            readOnly
                            disabled
                            icon={Mail}
                            className={FORM_READONLY_INPUT_CLASS}
                        />
                    </FormField>
                </FormGrid>
            </SettingsSection>
        </form>
    );
}
