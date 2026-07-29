'use client';

import { useState } from 'react';
import {
    KeyRound,
    Loader2,
    ShieldCheck,
    ShieldOff,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
    Role,
    type ManagedTwoFactorStatus,
} from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { useAccess } from '@/hooks/useAccess';
import { usePasswordResetLinkAction } from '@/hooks/usePasswordResetLinkAction';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';

interface UserSecurityActionsProps {
    targetUserId: string;
    targetName?: string | null;
    targetEmail?: string | null;
    targetRole: Role;
}

export function UserSecurityActions({
    targetUserId,
    targetName,
    targetEmail,
    targetRole,
}: UserSecurityActionsProps) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { canWrite } = useAccess();
    const {
        generatePasswordResetLink,
        generatingResetUserId,
    } = usePasswordResetLinkAction(token);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoadingStatus, setIsLoadingStatus] = useState(false);
    const [isResettingTwoFactor, setIsResettingTwoFactor] =
        useState(false);
    const [confirmResetOpen, setConfirmResetOpen] = useState(false);
    const [statusLoadFailed, setStatusLoadFailed] = useState(false);
    const [twoFactorStatus, setTwoFactorStatus] =
        useState<ManagedTwoFactorStatus | null>(null);
    const canManage =
        user?.role === Role.ORG_ADMIN ||
        (user?.role === Role.SUB_ADMIN &&
            targetRole !== Role.ORG_ADMIN &&
            targetRole !== Role.SUB_ADMIN);
    const displayName = targetName || targetEmail || 'this user';
    const isGeneratingPasswordReset =
        generatingResetUserId === targetUserId;

    if (!canManage) return null;

    const open = async () => {
        if (!token || !canWrite) return;
        setIsOpen(true);
        setIsLoadingStatus(true);
        setStatusLoadFailed(false);
        setTwoFactorStatus(null);
        try {
            setTwoFactorStatus(
                await api.auth.getManagedTwoFactorStatus(
                    targetUserId,
                    token,
                ),
            );
        } catch (error) {
            setStatusLoadFailed(true);
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unable to load this user’s security settings.',
                    type: 'error',
                },
            });
        } finally {
            setIsLoadingStatus(false);
        }
    };

    const resetTwoFactor = async () => {
        if (!token || !twoFactorStatus?.enabled) return;
        setIsResettingTwoFactor(true);
        try {
            const result = await api.auth.resetManagedTwoFactor(
                targetUserId,
                token,
            );
            setTwoFactorStatus(result);
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: result.message, type: 'success' },
            });
        } catch (error) {
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unable to reset two-step verification.',
                    type: 'error',
                },
            });
        } finally {
            setIsResettingTwoFactor(false);
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
                disabled={!canWrite}
                className="inline-flex h-7 items-center justify-center rounded-lg border border-info/25 p-2 text-info shadow-xs transition-colors hover:bg-info/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                title={
                    canWrite
                        ? 'Account recovery and security'
                        : 'Account recovery and security (Read-only)'
                }
                aria-label={`Open account recovery options for ${displayName}`}
            >
                <ShieldCheck className="h-4 w-4" />
            </button>

            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Account recovery"
                subtitle={`Security options for ${displayName}`}
                maxWidth="max-w-xl"
                mobileMode="dialog"
            >
                <div className="space-y-4">
                    <p className="text-sm font-medium leading-6 text-muted-foreground">
                        Use these options only after confirming that the
                        account owner asked for help. Neither option lets you
                        see their password or sign in as them.
                    </p>

                    <section className="rounded-xl border border-border/70 bg-background/55 p-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-warning/10 p-2 text-warning">
                                <KeyRound className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-black text-foreground">
                                    Password reset link
                                </h3>
                                <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">
                                    Creates a private, time-limited link for
                                    the user to choose a new password. The link
                                    is copied so you can share it directly,
                                    and EduVerse also tries to email it.
                                </p>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="mt-3 w-full sm:w-auto"
                                    onClick={() =>
                                        void generatePasswordResetLink(
                                            targetUserId,
                                        )
                                    }
                                    isLoading={isGeneratingPasswordReset}
                                    loadingText="Creating link"
                                >
                                    Copy password reset link
                                </Button>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-border/70 bg-background/55 p-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-danger/10 p-2 text-danger">
                                <ShieldOff className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-black text-foreground">
                                        Reset two-step verification
                                    </h3>
                                    {isLoadingStatus ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    ) : statusLoadFailed ? (
                                        <Badge variant="warning" size="sm">
                                            Status unavailable
                                        </Badge>
                                    ) : (
                                        <Badge
                                            variant={
                                                twoFactorStatus?.enabled
                                                    ? 'success'
                                                    : 'secondary'
                                            }
                                            size="sm"
                                        >
                                            {twoFactorStatus?.enabled
                                                ? 'Currently on'
                                                : 'Currently off'}
                                        </Badge>
                                    )}
                                </div>
                                <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">
                                    Turns off the extra sign-in check when the
                                    user has lost access to their email or
                                    trusted devices. It does not change their
                                    password, sessions, or trusted devices.
                                </p>
                                <Button
                                    type="button"
                                    variant="danger"
                                    className="mt-3 w-full sm:w-auto"
                                    disabled={
                                        isLoadingStatus ||
                                        !twoFactorStatus?.enabled
                                    }
                                    isLoading={isResettingTwoFactor}
                                    loadingText="Resetting"
                                    onClick={() =>
                                        setConfirmResetOpen(true)
                                    }
                                >
                                    {twoFactorStatus?.enabled
                                        ? 'Reset two-step verification'
                                        : 'Two-step verification is already off'}
                                </Button>
                            </div>
                        </div>
                    </section>
                </div>
            </Modal>

            <ConfirmDialog
                isOpen={confirmResetOpen}
                onClose={() => setConfirmResetOpen(false)}
                onConfirm={resetTwoFactor}
                title={`Reset two-step verification for ${displayName}?`}
                description="The user will be able to sign in with their password without an extra verification check. Ask them to set up two-step verification again after they regain access."
                confirmText="Reset verification"
                isDestructive
            />
        </>
    );
}
