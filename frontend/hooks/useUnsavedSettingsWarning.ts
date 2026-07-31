'use client';

import { createElement, useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const DEFAULT_MESSAGE = 'You have unsaved settings changes. Leave this page and discard them?';

function isModifiedClick(event: MouseEvent) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function useUnsavedSettingsWarning(
    hasUnsavedChanges: boolean,
    message = DEFAULT_MESSAGE,
): ReactElement {
    const router = useRouter();
    const [pendingHref, setPendingHref] = useState<string | null>(null);

    const handleConfirmNavigation = useCallback(() => {
        if (!pendingHref || typeof window === 'undefined') return;

        const nextUrl = new URL(pendingHref, window.location.href);
        setPendingHref(null);
        router.push(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }, [pendingHref, router]);

    useEffect(() => {
        if (!hasUnsavedChanges) {
            setPendingHref(null);
        }
    }, [hasUnsavedChanges]);

    useEffect(() => {
        if (!hasUnsavedChanges || typeof window === 'undefined') return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = message;
            return message;
        };

        const handleDocumentClick = (event: MouseEvent) => {
            if (!hasUnsavedChanges || event.defaultPrevented || isModifiedClick(event)) return;
            const target = event.target;
            if (!(target instanceof Element)) return;

            const anchor = target.closest('a[href]');
            if (!(anchor instanceof HTMLAnchorElement)) return;
            if (anchor.target && anchor.target !== '_self') return;

            const nextUrl = new URL(anchor.href, window.location.href);
            if (nextUrl.origin !== window.location.origin) return;
            if (nextUrl.pathname.startsWith('/settings/')) return;
            if (nextUrl.pathname === '/settings') return;
            if (nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search) return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            setPendingHref(nextUrl.href);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('click', handleDocumentClick, true);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('click', handleDocumentClick, true);
        };
    }, [hasUnsavedChanges, message]);

    return createElement(ConfirmDialog, {
        isOpen: Boolean(pendingHref),
        onClose: () => setPendingHref(null),
        onConfirm: handleConfirmNavigation,
        title: 'Discard unsaved changes?',
        description: message,
        confirmText: 'Leave page',
        cancelText: 'Stay here',
        isDestructive: true,
    });
}
