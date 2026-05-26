'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBackStackEntry } from '@/context/BackNavigationContext';

let modalBodyLockCount = 0;

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: ReactNode;
    subtitle?: ReactNode;
    children: ReactNode;
    maxWidth?: string;
    /** If true, the modal won't render the default header, allowing custom headers to be passed as children instead */
    customHeader?: ReactNode;
    footer?: ReactNode;
    className?: string; // For the inner modal card
    bodyClassName?: string;
    backLabel?: string;
    backPriority?: number;
}

export function ModalOverlay({
    isOpen,
    children,
    maxWidth = 'max-w-4xl',
    className = '',
    onBack,
    backLabel = 'Modal',
    backPriority = 100,
}: {
    isOpen: boolean;
    children: ReactNode;
    maxWidth?: string;
    className?: string;
    onBack?: () => void;
    backLabel?: string;
    backPriority?: number;
}) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const raf = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(raf);
    }, []);

    useEffect(() => {
        if (!mounted || !isOpen) return;

        modalBodyLockCount += 1;
        document.body.style.overflow = 'hidden';

        return () => {
            modalBodyLockCount = Math.max(0, modalBodyLockCount - 1);
            if (modalBodyLockCount === 0) {
                document.body.style.overflow = 'unset';
            }
        };
    }, [isOpen, mounted]);

    useBackStackEntry({
        enabled: mounted && isOpen && !!onBack,
        label: backLabel,
        priority: backPriority,
        onBack: onBack || (() => { }),
    });

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-200 flex items-center justify-center overflow-y-auto bg-black/60 p-2 backdrop-blur-sm transition-all duration-300 sm:p-4 md:p-6">
            <div className={`bg-linear-to-br from-card/95 via-card/90 to-card/95 backdrop-blur-xl rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.3)] w-full ${maxWidth} transform transition-all border border-border/50 animate-scale-in flex flex-col max-h-[calc(100vh-1rem)] max-h-[calc(100dvh-1rem)] overflow-hidden sm:max-h-[calc(100vh-2rem)] sm:max-h-[calc(100dvh-2rem)] md:max-h-[calc(100vh-3rem)] md:max-h-[calc(100dvh-3rem)] ${className}`}>
                {children}
            </div>
        </div>,
        document.body
    );
}

export function Modal({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    maxWidth = 'max-w-4xl',
    customHeader,
    footer,
    className = '',
    bodyClassName = ''
}: ModalProps) {
    return (
        <ModalOverlay isOpen={isOpen} maxWidth={maxWidth} className={className} onBack={onClose} backLabel={typeof title === 'string' ? title : 'Modal'}>
            {customHeader !== undefined ? (
                customHeader
            ) : (
                title && (
                    <div className="flex justify-between items-start p-4 md:p-6 pb-2 md:pb-3 shrink-0 border-b border-border/50">
                        <div>
                            {typeof title === 'string' ? <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-primary tracking-tighter leading-none">{title}</h2> : title}
                            {subtitle && <div className="text-xs md:text-sm font-semibold text-muted-foreground mt-2 tracking-widest">{subtitle}</div>}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-2 cursor-pointer rounded-xl transition-all active:scale-95 shrink-0"
                        >
                            <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )
            )}

            <div className={`overflow-y-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 custom-scrollbar flex-1 relative ${bodyClassName}`}>
                {children}
            </div>

            {footer && (
                <div className="p-4 md:p-6 px-6 md:px-8 border-t border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
                    {footer}
                </div>
            )}
        </ModalOverlay>
    );
}
