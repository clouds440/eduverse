'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Role, type ManagedTwoFactorStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { useAccess } from '@/hooks/useAccess';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ManagedTwoFactorActionProps {
    targetUserId: string;
    targetName?: string | null;
    targetRole: Role;
}

export function ManagedTwoFactorAction({
    targetUserId,
    targetName,
    targetRole,
}: ManagedTwoFactorActionProps) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { canWrite } = useAccess();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<ManagedTwoFactorStatus | null>(null);
    const canManage =
        user?.role === Role.ORG_ADMIN ||
        (user?.role === Role.SUB_ADMIN &&
            targetRole !== Role.ORG_ADMIN &&
            targetRole !== Role.SUB_ADMIN);

    if (!canManage) return null;

    const open = async () => {
        if (!token || !canWrite) return;
        setIsLoading(true);
        try {
            setStatus(await api.auth.getManagedTwoFactorStatus(targetUserId, token));
            setIsOpen(true);
        } catch (error) {
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: error instanceof Error ? error.message : 'Unable to load two-step verification.',
                    type: 'error',
                },
            });
        } finally {
            setIsLoading(false);
        }
    };

    const toggle = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const result = await api.auth.toggleManagedTwoFactor(targetUserId, token);
            setStatus(result);
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: result.message, type: 'success' },
            });
        } catch (error) {
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: error instanceof Error ? error.message : 'Unable to change two-step verification.',
                    type: 'error',
                },
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    void open();
                }}
                disabled={!canWrite || isLoading}
                className={cn(
                    'inline-flex h-7 items-center justify-center rounded-lg border border-info/25 p-2 text-info shadow-xs transition-colors hover:bg-info/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
                )}
                title={canWrite ? 'Toggle two-step verification' : 'Toggle two-step verification (Read-only)'}
                aria-label={`Toggle two-step verification for ${targetName || 'user'}`}
            >
                {isLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <ShieldCheck className="h-4 w-4" />}
            </button>
            <ConfirmDialog
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onConfirm={toggle}
                title={`${status?.enabled ? 'Disable' : 'Enable'} two-step verification for ${targetName || 'this user'}?`}
                description={status?.enabled
                    ? 'The user will be able to sign in with their password without an extra verification check. Use this when they have lost access to their verification options.'
                    : 'All verified options already available to this user will be enabled. If no verified contact email or trusted browser is available, nothing will change.'}
                confirmText={status?.enabled ? 'Disable verification' : 'Enable verification'}
                isDestructive={status?.enabled}
                loadingId={isLoading ? `managed-two-factor-${targetUserId}` : undefined}
            />
        </>
    );
}
