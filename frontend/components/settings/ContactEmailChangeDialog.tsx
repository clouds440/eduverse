'use client';

import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ModalOverlay } from '@/components/ui/Modal';

interface ContactEmailChangeDialogProps {
    isOpen: boolean;
    currentEmail: string;
    code: string;
    error?: string | null;
    isConfirming?: boolean;
    onCodeChange: (code: string) => void;
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
}

export function ContactEmailChangeDialog({
    isOpen,
    currentEmail,
    code,
    error,
    isConfirming = false,
    onCodeChange,
    onConfirm,
    onClose,
}: ContactEmailChangeDialogProps) {
    return (
        <ModalOverlay
            isOpen={isOpen}
            onBack={onClose}
            backLabel="Confirm current contact email"
            maxWidth="max-w-md"
            className="p-5 sm:p-6"
            mobileMode="dialog"
            ariaLabel="Confirm current contact email"
            closeOnBackdrop={!isConfirming}
            closeOnEscape={!isConfirming}
        >
            <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <MailCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-lg font-black text-foreground">Confirm your current email</h3>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-muted-foreground">
                        Enter the six-digit code sent to <span className="font-black text-foreground">{currentEmail}</span>. This only unlocks email changes in this signed-in session.
                    </p>
                </div>
            </div>
            <div className="mt-5 space-y-3">
                <Input
                    aria-label="Current email confirmation code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit code"
                />
                {error && (
                    <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs font-bold text-danger">
                        {error}
                    </p>
                )}
            </div>
            <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
                <Button type="button" variant="secondary" onClick={onClose} disabled={isConfirming}>
                    Cancel
                </Button>
                <Button
                    type="button"
                    onClick={() => void onConfirm()}
                    disabled={code.length !== 6}
                    loadingId={isConfirming ? 'confirm-current-contact-email' : undefined}
                >
                    Confirm email
                </Button>
            </div>
        </ModalOverlay>
    );
}
