'use client';

import React from 'react';
import { ModalOverlay } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: React.ReactNode;
    description: React.ReactNode;
    confirmText?: string;
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
    isDestructive = false,
    loadingId,
    children,
}: ConfirmDialogProps & { children?: React.ReactNode }) {
    return (
        <ModalOverlay isOpen={isOpen} maxWidth="max-w-md" className="p-6 sm:p-8 md:p-10 animate-scale-in">
            <h3 className="text-xl sm:text-2xl font-black mb-3 sm:mb-4 leading-tight">{title}</h3>
            <p className="opacity-70 text-base sm:text-lg mb-6 sm:mb-8 md:mb-10 leading-relaxed font-medium">{description}</p>

            {children && <div className="mb-6 sm:mb-8">{children}</div>}

            <div className="flex gap-3 sm:gap-4 justify-end shrink-0 flex-col-reverse sm:flex-row">
                <Button
                    variant="secondary"
                    onClick={onClose}
                    className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-semibold shadow-sm"
                >
                    Cancel
                </Button>
                <Button
                    variant={isDestructive ? 'danger' : 'primary'}
                    loadingId={loadingId}
                    onClick={() => {
                        onConfirm();
                        onClose();
                    }}
                    className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-semibold border-none ${!isDestructive ? 'shadow-[0_8px_16px_var(--shadow-color)]' : 'shadow-danger30'}`}
                >
                    {confirmText}
                </Button>
            </div>
        </ModalOverlay>
    );
}
