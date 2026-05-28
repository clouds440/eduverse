'use client';

import React, { ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBackStackEntry } from '@/context/BackNavigationContext';
import { cn } from '@/lib/utils';

let modalBodyLockCount = 0;
let modalBodyPreviousOverflow = '';
const modalStack: symbol[] = [];
const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

type ModalMobileMode = 'dialog' | 'sheet' | 'full';

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
    closeOnEscape?: boolean;
    closeOnBackdrop?: boolean;
    mobileMode?: ModalMobileMode;
}

export function ModalOverlay({
    isOpen,
    children,
    maxWidth = 'max-w-4xl',
    className = '',
    onBack,
    backLabel = 'Modal',
    backPriority = 100,
    closeOnEscape = true,
    closeOnBackdrop = true,
    mobileMode = 'dialog',
    ariaLabel,
    ariaLabelledBy,
}: {
    isOpen: boolean;
    children: ReactNode;
    maxWidth?: string;
    className?: string;
    onBack?: () => void;
    backLabel?: string;
    backPriority?: number;
    closeOnEscape?: boolean;
    closeOnBackdrop?: boolean;
    mobileMode?: ModalMobileMode;
    ariaLabel?: string;
    ariaLabelledBy?: string;
}) {
    const [mounted, setMounted] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const modalIdRef = useRef(Symbol('modal'));
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const isTopModal = useCallback(() => (
        modalStack[modalStack.length - 1] === modalIdRef.current
    ), []);

    const closeTopModal = useCallback(() => {
        if (isTopModal()) onBack?.();
    }, [isTopModal, onBack]);

    useEffect(() => {
        const raf = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(raf);
    }, []);

    useEffect(() => {
        if (!mounted || !isOpen) return;

        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        modalStack.push(modalIdRef.current);
        modalBodyLockCount += 1;
        if (modalBodyLockCount === 1) {
            modalBodyPreviousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }

        const frameId = window.requestAnimationFrame(() => {
            const modalNode = modalRef.current;
            if (!modalNode || !isTopModal()) return;

            const firstFocusable = modalNode.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
            (firstFocusable || modalNode).focus({ preventScroll: true });
        });

        return () => {
            window.cancelAnimationFrame(frameId);
            const stackIndex = modalStack.indexOf(modalIdRef.current);
            if (stackIndex !== -1) modalStack.splice(stackIndex, 1);
            modalBodyLockCount = Math.max(0, modalBodyLockCount - 1);
            if (modalBodyLockCount === 0) {
                document.body.style.overflow = modalBodyPreviousOverflow;
            }
            previousFocusRef.current?.focus?.({ preventScroll: true });
        };
    }, [isOpen, isTopModal, mounted]);

    useEffect(() => {
        if (!mounted || !isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isTopModal()) return;

            if (event.key === 'Escape' && closeOnEscape) {
                event.preventDefault();
                closeTopModal();
                return;
            }

            if (event.key !== 'Tab') return;

            const modalNode = modalRef.current;
            if (!modalNode) return;

            const focusable = Array.from(modalNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
                .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
            if (focusable.length === 0) {
                event.preventDefault();
                modalNode.focus({ preventScroll: true });
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const activeElement = document.activeElement;

            if (event.shiftKey && activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [closeOnEscape, closeTopModal, isOpen, isTopModal, mounted]);

    useBackStackEntry({
        enabled: mounted && isOpen && !!onBack,
        label: backLabel,
        priority: backPriority,
        onBack: onBack || (() => { }),
    });

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div
            className={cn(
                "fixed inset-0 z-200 flex overflow-y-auto bg-[var(--app-surface-overlay)] p-2 backdrop-blur-sm transition-opacity duration-200 sm:p-4 md:p-6",
                mobileMode === 'sheet' ? "items-end justify-center sm:items-center" : "items-center justify-center",
                mobileMode === 'full' && "p-0 sm:p-4 md:p-6",
            )}
            onMouseDown={(event) => {
                if (closeOnBackdrop && event.target === event.currentTarget) closeTopModal();
            }}
        >
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                tabIndex={-1}
                className={cn(
                    "flex w-full transform flex-col overflow-hidden border border-border/60 bg-card text-card-foreground shadow-xl outline-none transition-all duration-200 animate-scale-in",
                    mobileMode === 'sheet'
                        ? "max-h-[calc(100dvh-0.75rem)] rounded-t-lg rounded-b-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-lg"
                        : "max-h-[calc(100dvh-1rem)] rounded-lg sm:max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-3rem)]",
                    mobileMode === 'full' && "h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-lg",
                    maxWidth,
                    className,
                )}
            >
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
    bodyClassName = '',
    closeOnEscape = true,
    closeOnBackdrop = true,
    mobileMode = 'sheet',
}: ModalProps) {
    const titleId = useId();
    const hasStringTitle = typeof title === 'string';
    const hasDefaultHeader = customHeader === undefined && Boolean(title);

    return (
        <ModalOverlay
            isOpen={isOpen}
            maxWidth={maxWidth}
            className={className}
            onBack={onClose}
            backLabel={hasStringTitle ? title : 'Modal'}
            closeOnEscape={closeOnEscape}
            closeOnBackdrop={closeOnBackdrop}
            mobileMode={mobileMode}
            ariaLabel={hasStringTitle ? title : undefined}
            ariaLabelledBy={hasDefaultHeader ? titleId : undefined}
        >
            {customHeader !== undefined ? (
                customHeader
            ) : (
                title && (
                    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 p-4 pb-3 sm:p-5">
                        <div className="min-w-0">
                            {hasStringTitle ? (
                                <h2 id={titleId} className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
                                    {title}
                                </h2>
                            ) : (
                                <div id={titleId}>{title}</div>
                            )}
                            {subtitle && <div className="mt-1.5 text-xs font-medium text-muted-foreground sm:text-sm">{subtitle}</div>}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            aria-label="Close modal"
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                )
            )}

            <div className={cn("relative flex-1 overflow-y-auto px-4 py-4 custom-scrollbar sm:px-5 sm:py-5", bodyClassName)}>
                {children}
            </div>

            {footer && (
                <div className="shrink-0 border-t border-border/60 bg-card/80 p-4 sm:p-5">
                    {footer}
                </div>
            )}
        </ModalOverlay>
    );
}
