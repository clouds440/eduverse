'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { useGlobal } from '@/context/GlobalContext';

async function copyTextToClipboard(text: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        document.execCommand('copy');
    } finally {
        document.body.removeChild(textarea);
    }
}

export function usePasswordResetLinkAction(token?: string | null) {
    const { dispatch } = useGlobal();
    const [generatingResetUserId, setGeneratingResetUserId] = useState<string | null>(null);

    const generatePasswordResetLink = useCallback(async (userId: string) => {
        if (!token || generatingResetUserId) return;

        setGeneratingResetUserId(userId);

        try {
            const response = await api.auth.generatePasswordResetLink(userId, token);
            await copyTextToClipboard(response.resetUrl);

            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: response.warning || 'Password reset link copied. Share it directly with the user. EduVerse also tried to email it.',
                    type: response.warning ? 'info' : 'success',
                },
            });
        } catch (error: unknown) {
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: error instanceof Error ? error.message : 'Failed to generate password reset link',
                    type: 'error',
                },
            });
        } finally {
            setGeneratingResetUserId(null);
        }
    }, [dispatch, generatingResetUserId, token]);

    return { generatePasswordResetLink, generatingResetUserId };
}
