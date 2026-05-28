'use client';

import React, { ReactNode, useId } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ModalFormProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    onSubmit: (e: React.FormEvent) => void;
    submitText?: string;
    isSubmitting?: boolean;
    loadingId?: string;
    variant?: 'primary' | 'danger' | 'warning' | 'success';
    showCancel?: boolean;
    showSubmit?: boolean;
    maxWidth?: string;
    modalClassName?: string;
    bodyClassName?: string;
    feedback?: ReactNode;
    requireWrite?: boolean;
}

export function ModalForm({
    isOpen,
    onClose,
    title,
    children,
    onSubmit,
    submitText = 'Save',
    isSubmitting = false,
    loadingId,
    variant = 'primary',
    showCancel = true,
    showSubmit = true,
    maxWidth = 'max-w-lg',
    modalClassName = 'animate-scale-in',
    bodyClassName = '',
    feedback,
    requireWrite
}: ModalFormProps) {
    const formId = useId();
    const footer = (showCancel || showSubmit) ? (
        <div className="flex justify-end gap-3 sm:gap-4 flex-col-reverse sm:flex-row">
            {showCancel && (
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    className="w-full sm:w-auto"
                >
                    Cancel
                </Button>
            )}
            {showSubmit && (
                <Button
                    type="submit"
                    form={formId}
                    isLoading={isSubmitting}
                    loadingId={loadingId}
                    requireWrite={requireWrite !== false}
                    variant={variant}
                    className="w-full sm:w-auto"
                >
                    {submitText}
                </Button>
            )}
        </div>
    ) : undefined;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            maxWidth={maxWidth}
            className={modalClassName}
            bodyClassName={bodyClassName}
            footer={footer}
        >
            <div className="flex flex-col h-full">
                {feedback && (
                    <div className="mb-3 sm:mb-4 shrink-0">
                        {feedback}
                    </div>
                )}

                <form id={formId} onSubmit={onSubmit} className="text-foreground" noValidate>
                    {children}
                </form>
            </div>
        </Modal>
    );
}
