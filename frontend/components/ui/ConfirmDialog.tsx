'use client';

import React from 'react';
import { ModalOverlay } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void> | null;
    title: React.ReactNode;
    description: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    hideConfirm?: boolean;
    isDestructive?: boolean;
    loadingId?: string;
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    hideConfirm = false,
    isDestructive = false,
    loadingId,
    children,
}: ConfirmDialogProps & { children?: React.ReactNode }) {
    return (
        <ModalOverlay
            isOpen={isOpen}
            onBack={onClose}
            backLabel="Confirmation dialog"
            maxWidth="max-w-md"
            className="p-5 sm:p-6"
            mobileMode="dialog"
            ariaLabel="Confirmation dialog"
        >
            <div className="mb-4 flex items-start gap-3">
                <div className={`rounded-md p-2 ${isDestructive ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
            </div>

            {children && <div className="mb-5">{children}</div>}

            <div className="flex shrink-0 flex-col-reverse justify-end gap-3 sm:flex-row">
                <Button
                    variant="secondary"
                    onClick={onClose}
                    className="w-full sm:w-auto"
                >
                    {cancelText}
                </Button>
                {!hideConfirm && (
                    <Button
                        variant={isDestructive ? 'danger' : 'primary'}
                        loadingId={loadingId}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="w-full sm:w-auto"
                    >
                        {confirmText}
                    </Button>
                )}
            </div>
        </ModalOverlay>
    );
}
