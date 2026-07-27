'use client';

import { useEffect, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import type { Organization } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ModalOverlay } from '@/components/ui/Modal';

interface OrganizationContactRecoveryDialogProps {
    organization: Organization | null;
    token?: string | null;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
}

export function OrganizationContactRecoveryDialog({
    organization,
    token,
    onClose,
    onSaved,
}: OrganizationContactRecoveryDialogProps) {
    const { dispatch } = useGlobal();
    const [email, setEmail] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setEmail(organization?.contactEmail || organization?.email || '');
        setError(null);
    }, [organization]);

    const save = async () => {
        if (!organization || !token || !email.trim()) return;
        setIsSaving(true);
        setError(null);
        try {
            await api.admin.setOrganizationContactEmail(organization.id, email.trim(), token);
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: 'The organization recovery contact email was updated and marked verified.',
                    type: 'success',
                },
            });
            await onSaved();
            onClose();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Unable to update the recovery contact email.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <ModalOverlay
            isOpen={Boolean(organization)}
            onBack={onClose}
            backLabel="Set organization recovery contact email"
            maxWidth="max-w-md"
            className="p-5 sm:p-6"
            mobileMode="dialog"
            ariaLabel="Set organization recovery contact email"
            closeOnBackdrop={!isSaving}
            closeOnEscape={!isSaving}
        >
            <div className="flex items-start gap-3">
                <div className="rounded-lg bg-warning/10 p-2 text-warning">
                    <MailCheck className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-lg font-black text-foreground">Set recovery contact email?</h3>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-muted-foreground">
                        This replaces the verified contact email for <span className="font-black text-foreground">{organization?.name}</span>. Use this only after confirming the recovery request through the support process.
                    </p>
                </div>
            </div>
            <div className="mt-5 space-y-2">
                <label htmlFor="organization-recovery-email" className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    New verified contact email
                </label>
                <Input
                    id="organization-recovery-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@example.com"
                />
                {error && <p className="text-xs font-bold text-danger">{error}</p>}
            </div>
            <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
                <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
                    Cancel
                </Button>
                <Button
                    type="button"
                    onClick={() => void save()}
                    disabled={!email.trim()}
                    loadingId={isSaving ? `recover-contact-${organization?.id}` : undefined}
                >
                    Set verified email
                </Button>
            </div>
        </ModalOverlay>
    );
}
